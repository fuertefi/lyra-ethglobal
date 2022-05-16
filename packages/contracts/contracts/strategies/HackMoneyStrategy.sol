//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

// Hardhat
import "hardhat/console.sol";

// standard strategy interface
import "../interfaces/IHackMoneyStrategy.sol";

// Lyra
import {VaultAdapter} from "@lyrafinance/protocol/contracts/periphery/VaultAdapter.sol";
import {GWAVOracle} from "@lyrafinance/protocol/contracts/periphery/GWAVOracle.sol";

// Libraries
import {Vault} from "../libraries/Vault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {HackMoneyVault} from "../core/HackMoneyVault.sol";
import {DecimalMath} from "@lyrafinance/protocol/contracts/synthetix/DecimalMath.sol";
import {SignedDecimalMath} from "@lyrafinance/protocol/contracts/synthetix/SignedDecimalMath.sol";

// StrategyBase to inherit
import {HackMoneyStrategyBase} from "./HackMoneyStrategyBase.sol";

contract HackMoneyStrategy is HackMoneyStrategyBase, IHackMoneyStrategy {
  using DecimalMath for uint;
  using SignedDecimalMath for int;

  // example strategy detail
  struct HackMoneyStrategyDetail {
    uint minTimeToExpiry;
    uint maxTimeToExpiry;
    int mintargetDelta; // 15%
    int maxtargetDelta; // 85%
    uint maxDeltaGap; // 5% ?
    uint minVol; // 80%
    uint maxVol; // 130%
    uint size; // 15
    uint maxVolVariance; // 10%
    uint gwavPeriod;
  }

  HackMoneyStrategyDetail public strategyDetail;
  uint public activeExpiry;
  uint public currentBoardId;

  ///////////
  // ADMIN //
  ///////////

  constructor(
    HackMoneyVault _vault,
    OptionType _optionType,
    GWAVOracle _gwavOracle
  ) HackMoneyStrategyBase(_vault, _optionType, _gwavOracle) {}

  /**
   * @dev update the strategy detail for the new round.
   */
  function setStrategyDetail(HackMoneyStrategyDetail memory _deltaStrategy) external onlyOwner {
    (, , , , , , , bool roundInProgress) = vault.vaultState();
    require(!roundInProgress, "cannot change strategy if round is active");
    strategyDetail = _deltaStrategy;
  }

  ///////////////////
  // VAULT ACTIONS //
  ///////////////////

  /**
   * @dev set the board id that will be traded for the next round
   * @param boardId lyra board Id.
   */
  function setBoard(uint boardId) external onlyVault {
    Board memory board = getBoard(boardId);
    require(_isValidExpiry(board.expiry), "invalid board");
    activeExpiry = board.expiry;
    currentBoardId = boardId;
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
   * @notice sell a fix aomunt of options and collect premium
   * @dev the vault should pass in a strike id, and the strategy would verify if the strike is valid on-chain.
   * @param lyraRewardRecipient address to receive trading reward. This need to be whitelisted
   * @return positionId1
   * @return positionId2
   * @return premiumReceived
   * @return collateralToAdd
   */
  function doTrade(
    uint,
    uint,
    address lyraRewardRecipient
  )
    external
    onlyVault
    returns (
      uint positionId1,
      uint positionId2,
      uint premiumReceived,
      uint collateralToAdd
    )
  {
    (Strike memory strike1, Strike memory strike2) = _getTradeStrikes();

    //uint setCollateralTo1;
    uint collateralToAdd1;
    (collateralToAdd1, ) = getRequiredCollateral(strike1);

    //uint setCollateralTo2;
    uint collateralToAdd2;
    (collateralToAdd2, ) = getRequiredCollateral(strike2);

    collateralToAdd = collateralToAdd1 + collateralToAdd2;

    require(
      collateralAsset.transferFrom(address(vault), address(this), collateralToAdd),
      "collateral transfer from vault failed"
    );

    uint premiumReceived1;
    (positionId1, premiumReceived1) = _sellStrike(strike1, collateralToAdd1, lyraRewardRecipient);
    uint premiumReceived2;
    (positionId2, premiumReceived2) = _sellStrike(strike2, collateralToAdd2, lyraRewardRecipient);

    premiumReceived = premiumReceived1 + premiumReceived2;
  }

  /**
   * @notice sell a fix aomunt of options and collect premium
   * @dev the vault should pass in a strike id, and the strategy would verify if the strike is valid on-chain.
   * @param strikeId1 lyra strikeId to trade
   * @param strikeId2 lyra strikeId to trade
   * @param lyraRewardRecipient address to receive trading reward. This need to be whitelisted
   * @return positionId1
   * @return positionId2
   * @return premiumReceived
   */
  // function doTrade(
  //   uint strikeId1,
  //   uint strikeId2,
  //   address lyraRewardRecipient
  // )
  //   external
  //   onlyVault
  //   returns (
  //     uint positionId1,
  //     uint positionId2,
  //     uint premiumReceived,
  //     uint collateralToAdd
  //   )
  // {
  //   Strike memory k1 = getStrikes(_toDynamic(strikeId1))[0];
  //   Strike memory k2 = getStrikes(_toDynamic(strikeId2))[0];

  //   Strike memory strike1;
  //   Strike memory strike2;

  //   if (k1.strikePrice < k2.strikePrice) {
  //     strike1 = k1;
  //     strike2 = k2;
  //   } else {
  //     strike1 = k2;
  //     strike2 = k1;
  //   }

  //   require(isValidStrike(strike1, true), "invalid strike");
  //   require(isValidStrike(strike2, false), "invalid strike");

  //   //uint setCollateralTo1;
  //   uint collateralToAdd1;
  //   (collateralToAdd1, ) = getRequiredCollateral(strike1);

  //   //uint setCollateralTo2;
  //   uint collateralToAdd2;
  //   (collateralToAdd2, ) = getRequiredCollateral(strike2);

  //   collateralToAdd = collateralToAdd1 + collateralToAdd2;

  //   require(
  //     collateralAsset.transferFrom(address(vault), address(this), collateralToAdd),
  //     "collateral transfer from vault failed"
  //   );

  //   uint premiumReceived1;
  //   (positionId1, premiumReceived1) = _sellStrike(strike1, collateralToAdd1, lyraRewardRecipient);
  //   uint premiumReceived2;
  //   (positionId2, premiumReceived2) = _sellStrike(strike2, collateralToAdd2, lyraRewardRecipient);

  //   premiumReceived = premiumReceived1 + premiumReceived2;
  // }

  /////////////////////////////
  // Trade Parameter Helpers //
  /////////////////////////////

  /**
   * @dev calculate required collateral to add in the next trade.
   * sell size is fixed as strategyDetail.size
   * only add collateral if the additional sell will make the position out of buffer range
   * never remove collateral from an existing position
   */
  function getRequiredCollateral(Strike memory strike)
    public
    view
    returns (uint collateralToAdd, uint setCollateralTo)
  {
    uint sellAmount = strategyDetail.size;
    collateralToAdd = _getFullCollateral(strike.strikePrice, sellAmount);
    setCollateralTo = collateralToAdd;
  }

  /**
   * @dev perform the trade
   * @param strike strike detail
   * @param setCollateralTo target collateral amount
   * @param lyraRewardRecipient address to receive lyra trading reward
   * @return positionId
   * @return premiumReceived
   */
  function _sellStrike(
    Strike memory strike,
    uint setCollateralTo,
    address lyraRewardRecipient
  ) internal returns (uint, uint) {
    // get minimum expected premium based on minIv
    uint minExpectedPremium = _getPremiumLimit(strike, strategyDetail.minVol, strategyDetail.size);
    // perform trade
    TradeResult memory result = openPosition(
      TradeInputParameters({
        strikeId: strike.id,
        positionId: strikeToPositionId[strike.id],
        iterations: 4,
        optionType: optionType,
        amount: strategyDetail.size,
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

  /**
   * @dev use premium in strategy to reduce position size if collateral ratio is out of range
   */
  function reducePosition(
    uint,
    uint,
    address
  ) external pure {
    revert("not supported");
  }

  function _getTradeStrikes() internal view returns (Strike memory smallStrike, Strike memory bigStrike) {
    // get all strike Ids for current board
    uint[] memory strikeIds = optionMarket.getBoardStrikes(currentBoardId);

    // get small and big strike Ids
    uint smallStrikeId = strikeIds[0];
    uint bigStrikeId = strikeIds[strikeIds.length - 1];

    // init strikes
    smallStrike = getStrikes(_toDynamic(smallStrikeId))[0];
    bigStrike = getStrikes(_toDynamic(bigStrikeId))[0];

    for (uint i = 1; i < strikeIds.length - 1; i++) {
      uint currentStrikeId = strikeIds[i];
      Strike memory currentStrike = getStrikes(_toDynamic(currentStrikeId))[0];
      if (isValidStrike(currentStrike, true)) smallStrike = currentStrike;
      if (isValidStrike(currentStrike, false)) bigStrike = currentStrike;
    }
  }

  /////////////////////////////
  // Trade Parameter Helpers //
  /////////////////////////////

  function _getFullCollateral(uint strikePrice, uint amount) internal view returns (uint fullCollat) {
    // calculate required collat based on collatBuffer and collatPercent
    fullCollat = _isBaseCollat() ? amount : amount.multiplyDecimal(strikePrice);
  }

  /////////////////
  // Validation ///
  /////////////////

  /**
   * @dev verify if the strike is valid for the strategy
   * @return isValid true if vol is withint [minVol, maxVol] and delta is within targetDelta +- maxDeltaGap
   */
  function isValidStrike(Strike memory strike, bool isSmallStrike) public view returns (bool isValid) {
    if (activeExpiry != strike.expiry) {
      return false;
    }

    int targetDelta = isSmallStrike ? strategyDetail.maxtargetDelta : strategyDetail.mintargetDelta;
    uint[] memory strikeId = _toDynamic(strike.id);
    int callDelta = getDeltas(strikeId)[0];
    int delta = _isCall() ? callDelta : callDelta - SignedDecimalMath.UNIT;
    uint deltaGap = _abs(targetDelta - delta);
    return deltaGap < strategyDetail.maxDeltaGap;
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
