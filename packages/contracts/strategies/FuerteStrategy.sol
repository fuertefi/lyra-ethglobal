//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

// Hardhat
import "hardhat/console.sol";

// standard strategy interface
import "../interfaces/IStrategyFuerte.sol";

// Lyra
import {VaultAdapter} from "@lyrafinance/protocol/contracts/periphery/VaultAdapter.sol";
import {GWAVOracle} from "@lyrafinance/protocol/contracts/periphery/GWAVOracle.sol";

// Libraries
import {Vault} from "../libraries/Vault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LyraVault} from "../core/LyraVault.sol";
import {DecimalMath} from "@lyrafinance/protocol/contracts/synthetix/DecimalMath.sol";
import {SignedDecimalMath} from "@lyrafinance/protocol/contracts/synthetix/SignedDecimalMath.sol";

// StrategyBase to inherit
import {StrategyBase} from "./StrategyBase.sol";

contract FuerteStrategy is StrategyBase, IStrategyFuerte {
  using DecimalMath for uint;
  using SignedDecimalMath for int;

  // example strategy detail
  struct FuerteStrategyDetail {
    uint minTimeToExpiry;
    uint maxTimeToExpiry;
    int targetDelta;
    uint maxDeltaGap;
    uint minVol;
    uint maxVol;
    uint callSize;
    uint putSize;
    uint maxVolVariance;
    uint gwavPeriod;
  }

  FuerteStrategyDetail public strategyDetail;
  uint public activeExpiry;

  ///////////
  // ADMIN //
  ///////////

  constructor(
    LyraVault _vault,
    //OptionType _optionType,
    GWAVOracle _gwavOracle
  ) StrategyBase(_vault, _gwavOracle) {}

  //   ) StrategyBase(_vault,  _optionType, _gwavOracle) {}

  /**
   * @dev update the strategy detail for the new round.
   */
  function setStrategyDetail(FuerteStrategyDetail memory _fuerteStrategy) external onlyOwner {
    (, , , , , , , bool roundInProgress) = vault.vaultState();
    require(!roundInProgress, "cannot change strategy if round is active");
    strategyDetail = _fuerteStrategy;
  }

  ///////////////////
  // VAULT ACTIONS //
  ///////////////////

  /**
   * @dev set the board id that will be traded for the next round
   * @param callBoardId lyra call board Id.
   * @param putBoardId lyra call board Id.
   */
  function setBoard(uint callBoardId, uint putBoardId) external onlyVault {
    Board memory callBoard = getBoard(callBoardId);
    Board memory putBoard = getBoard(putBoardId);
    require(_isValidExpiry(callBoard.expiry) && _isValidExpiry(putBoard.expiry), "invalid board");
    require(callBoard.expiry == putBoard.expiry, "!expiry");
    activeExpiry = callBoard.expiry;
  }

  /**
   * @dev convert premium in quote asset into collateral asset and send it back to the vault.
   */
  function returnFundsAndClearStrikes() external onlyVault {
    // exchange asset back to collateral asset and send it back to the vault
    _returnFundsToVaut();

    // keep internal storage data on old strikes and positions ids
    _clearAllActiveStrikes();
  }

  /**
   * @notice sell a fix amount of options and collect premium
   * @dev the vault should pass in a strike id, and the strategy would verify if the strike is valid on-chain.
   * @param callStrikeId lyra call strikeId to trade
   * @param putStrikeId lyra call strikeId to trade
   * @param lyraRewardRecipient address to receive trading reward. This need to be whitelisted
   * @return callPositionId
   * @return putPositionId
   * @return premiumReceived
   */
  function doTrade(
    uint callStrikeId,
    uint putStrikeId,
    address lyraRewardRecipient
  )
    external
    onlyVault
    returns (
      uint callPositionId,
      uint putPositionId,
      uint premiumReceived,
      uint callCollateral,
      uint putCollateral
    )
  {
    Strike memory callStrike = getStrikes(_toDynamic(callStrikeId))[0];
    Strike memory putStrike = getStrikes(_toDynamic(putStrikeId))[0];
    require(
      isValidStrike(callStrike, OptionType.SHORT_CALL_BASE) && isValidStrike(putStrike, OptionType.SHORT_PUT_QUOTE),
      "invalid strike"
    );

    callCollateral = getRequiredCollateral(callStrike, OptionType.SHORT_CALL_BASE); // base
    putCollateral = getRequiredCollateral(putStrike, OptionType.SHORT_PUT_QUOTE); // quote

    require(
      baseAsset.transferFrom(address(vault), address(this), callCollateral),
      "baseAsset transfer from vault failed"
    );

    require(
      quoteAsset.transferFrom(address(vault), address(this), putCollateral),
      "putCollateral transfer from vault failed"
    );

    uint callPremiumReceived;
    (callPositionId, callPremiumReceived) = _sellStrike(
      callStrike,
      OptionType.SHORT_CALL_BASE,
      callCollateral,
      lyraRewardRecipient
    );
    uint putPremiumReceived;
    (putPositionId, putPremiumReceived) = _sellStrike(
      putStrike,
      OptionType.SHORT_PUT_QUOTE,
      putCollateral,
      lyraRewardRecipient
    );
    premiumReceived = callPremiumReceived + putPremiumReceived;
  }

  /**
   * @dev calculate required collateral to add in the next trade.
   * sell size is fixed as strategyDetail.size
   * only add collateral if the additional sell will make the position out of buffer range
   * never remove collateral from an existing position
   */
  function getRequiredCollateral(Strike memory strike, OptionType optionType)
    public
    view
    returns (uint collateralToAdd)
  {
    uint sellAmount = optionType == OptionType.SHORT_CALL_BASE ? strategyDetail.callSize : strategyDetail.putSize;
    collateralToAdd = _getFullCollateral(strike.strikePrice, sellAmount, optionType);
  }

  /**
   * @dev perform the trade
   * @param strike strike detail
   * @param setCollateralTo target collateral amount
   * @param optionType optionType
   * @param lyraRewardRecipient address to receive lyra trading reward
   * @return positionId
   * @return premiumReceived
   */
  function _sellStrike(
    Strike memory strike,
    OptionType optionType,
    uint setCollateralTo,
    address lyraRewardRecipient
  ) internal returns (uint, uint) {
    // get minimum expected premium based on minIv
    uint size = optionType == OptionType.SHORT_CALL_BASE ? strategyDetail.callSize : strategyDetail.putSize;
    uint minExpectedPremium = _getPremiumLimit(strike, optionType, strategyDetail.minVol, size);
    // perform trade
    TradeResult memory result = openPosition(
      TradeInputParameters({
        strikeId: strike.id,
        positionId: strikeToPositionId[strike.id],
        iterations: 4,
        optionType: optionType,
        amount: size,
        setCollateralTo: setCollateralTo,
        minTotalCost: minExpectedPremium,
        maxTotalCost: type(uint).max,
        rewardRecipient: lyraRewardRecipient // set to zero address if don't want to wait for whitelist
      })
    );
    lastTradeTimestamp[strike.id] = block.timestamp;

    // update active strikes
    _addActiveStrike(strike.id, result.positionId);

    require(result.totalCost >= minExpectedPremium, "premium received is below min expected premium");

    return (result.positionId, result.totalCost);
  }

  function reducePosition(
    uint,
    uint,
    address
  ) external pure {
    revert("not supported");
  }

  /////////////////////////////
  // Trade Parameter Helpers //
  /////////////////////////////

  function _getFullCollateral(
    uint strikePrice,
    uint amount,
    OptionType optionType
  ) internal pure returns (uint fullCollat) {
    // calculate required collat based on collatBuffer and collatPercent
    fullCollat = _isBaseCollat(optionType) ? amount : amount.multiplyDecimal(strikePrice);
  }

  /////////////////
  // Validation ///
  /////////////////

  /**
   * @dev verify if the strike is valid for the strategy
   * @return isValid true if vol is withint [minVol, maxVol] and delta is within targetDelta +- maxDeltaGap
   */
  function isValidStrike(Strike memory strike, OptionType optionType) public view returns (bool isValid) {
    if (activeExpiry != strike.expiry) {
      return false;
    }

    uint[] memory strikeId = _toDynamic(strike.id);
    uint vol = getVols(strikeId)[0];
    int callDelta = getDeltas(strikeId)[0];
    int delta = _isCall(optionType) ? callDelta : callDelta - SignedDecimalMath.UNIT;
    uint deltaGap = _abs(strategyDetail.targetDelta - delta);
    return vol >= strategyDetail.minVol && vol <= strategyDetail.maxVol && deltaGap < strategyDetail.maxDeltaGap;
  }

  /**
   * @dev check if the vol variance for the given strike is within certain range
   */
  function _isValidVolVariance(uint strikeId) internal view returns (bool isValid) {
    uint volGWAV = gwavOracle.volGWAV(strikeId, strategyDetail.gwavPeriod);
    uint volSpot = getVols(_toDynamic(strikeId))[0];

    uint volDiff = (volGWAV >= volSpot) ? volGWAV - volSpot : volSpot - volGWAV;

    return isValid = volDiff < strategyDetail.maxVolVariance;
  }

  /**
   * @dev check if the expiry of the board is valid according to the strategy
   */
  function _isValidExpiry(uint expiry) public view returns (bool isValid) {
    uint secondsToExpiry = _getSecondsToExpiry(expiry);
    isValid = (secondsToExpiry >= strategyDetail.minTimeToExpiry && secondsToExpiry <= strategyDetail.maxTimeToExpiry);
  }
}
