//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

// Hardhat
import "hardhat/console.sol";

// standard strategy interface
import "../interfaces/ICSStrategy.sol";

// Libraries
import {Vault} from "../libraries/Vault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CSVault} from "../core/CSVault.sol";
import {DecimalMath} from "@lyrafinance/protocol/contracts/synthetix/DecimalMath.sol";
import {SignedDecimalMath} from "@lyrafinance/protocol/contracts/synthetix/SignedDecimalMath.sol";

// StrategyBase to inherit
import {CSStrategyBase} from "./CSStrategyBase.sol";

contract CSStrategy is CSStrategyBase {
  using DecimalMath for uint;
  using SignedDecimalMath for int;

  //uint public optionSize;

  ///////////
  // ADMIN //
  ///////////

  constructor(CSVault _vault) CSStrategyBase(_vault) {}

  function initialize(CSVault _vault) public initializer {
    CSStrategyBase.initializeBase(_vault);
  }

  ///////////////////
  // VAULT ACTIONS //
  ///////////////////

  // TODO: Update docs
  /**
   * @notice sell a fix aomunt of options and collect premium
   * @dev the vault should pass in a strike id, and the strategy would verify if the strike is valid on-chain.
   * @return positionId1
   * @return positionId2
   * @return premiumsReceived
   * @return premiumsExchangeValue
   */
  function doTrade(uint tradeSize)
    external
    onlyVault
    returns (
      uint positionId1,
      uint positionId2,
      uint premiumsReceived,
      uint premiumsExchangeValue
    )
  {
    // TODO: redefine premiumsReceived, premiumExchangeValue etc
    // We sell options we get premiums
    // We sell premiums we get additional premium
    // premiumsReceived doesnt reflect the stratrgy sUSD balance since we exchange it

    // EXCHANGE sUSD in strategy if bal>0
    uint quoteBal = quoteAsset.balanceOf(address(this));
    if (quoteBal > 0) _exchangeQuoteToBaseWithLimit(quoteBal);

    // TRADE STRIKE
    (Strike memory strike1, Strike memory strike2) = _getTradeStrikes();

    // PRINCIPAL TRADE PART
    (positionId1, positionId2, premiumsReceived) = _tradeStrikes(strike1, strike2, tradeSize);

    // PREMIUMS TRADE PART
    // TODO: Calling _exchangeQuoteToBaseWithLimit twice maybe we can just exchange our whole balance here and trade premiums
    premiumsExchangeValue = _exchangeQuoteToBaseWithLimit(premiumsReceived);

    if (premiumsExchangeValue > 0) {
      uint premiumTradeSize = premiumsExchangeValue / 2;
      uint additionalPremium;
      (, , additionalPremium) = _tradeStrikes(strike1, strike2, premiumTradeSize);
      premiumsReceived += additionalPremium;
    }

    lastTradeTimestamp[strike1.id] = block.timestamp;
    lastTradeTimestamp[strike2.id] = block.timestamp;
  }

  function _tradeStrikes(
    Strike memory strike1,
    Strike memory strike2,
    uint tradeSize
  )
    internal
    returns (
      uint positionId1,
      uint positionId2,
      uint premiumsReceived
    )
  {
    //console.log("trying first strike");
    uint premiumReceived1;
    (positionId1, premiumReceived1) = _tradeStrike(strike1, tradeSize);
    //console.log("traded first");

    //console.log("trying second strike");
    uint premiumReceived2;
    (positionId2, premiumReceived2) = _tradeStrike(strike2, tradeSize);

    premiumsReceived = premiumReceived1 + premiumReceived2;
  }

  function _tradeStrike(Strike memory strike, uint tradeSize) internal returns (uint positionId, uint premiumReceived) {
    uint setCollateralTo;
    setCollateralTo = getRequiredCollateral(strike, tradeSize);

    (positionId, premiumReceived) = _sellStrike(strike, tradeSize, setCollateralTo);
  }

  /////////////////////////////
  // Trade Parameter Helpers //
  /////////////////////////////

  /**
   * @dev calculate required collateral to add in the next trade.
   * sell size is fixed as strategyDetail.size
   * only add collateral if the additional sell will make the position out of buffer range
   * never remove collateral from an existing position
   */
  function getRequiredCollateral(Strike memory strike, uint tradeSize) public view returns (uint setCollateralTo) {
    //TODO: use _isActiveStrike to conform with code structure
    uint positionId = strikeToPositionId[strike.id];
    if (positionId == 0) {
      setCollateralTo = tradeSize;
    } else {
      OptionPosition memory currentPosition = _getPositions(_toDynamic(positionId))[0];
      uint currentCollateral = currentPosition.collateral;
      setCollateralTo = tradeSize + currentCollateral;
    }
  }

  /**
   * @dev perform the trade
   * @param strike strike detail
   * @param setCollateralTo target collateral amount
   * @return positionId
   * @return premiumReceived
   */
  function _sellStrike(
    Strike memory strike,
    uint tradeSize,
    uint setCollateralTo
  ) internal returns (uint, uint) {
    // TODO: fix this part with min expected premium and strategy min vol
    // get minimum expected premium based on minIv
    // uint256 minExpectedPremium = _getPremiumLimit(
    //     strike,
    //     strategyDetail.minVol,
    //     tradeSize
    // );

    uint initIv = strike.boardIv.multiplyDecimal(strike.skew);

    //console.log(">>> SET COLLATERAL TO");
    //console.log(setCollateralTo);
    //console.log(tradeSize);

    // perform trade
    TradeResult memory result = _openPosition(
      TradeInputParameters({
        strikeId: strike.id,
        positionId: strikeToPositionId[strike.id],
        iterations: 4, // strategy.iterations
        optionType: optionType,
        amount: tradeSize,
        setCollateralTo: setCollateralTo,
        minTotalCost: 0,
        maxTotalCost: type(uint).max,
        rewardRecipient: lyraRewardRecipient // set to zero address if don't want to wait for whitelist
      })
    );
    Strike memory finalStrike = _getStrikes(_toDynamic(strike.id))[0];
    uint finalIv = finalStrike.boardIv.multiplyDecimal(finalStrike.skew);
    require(initIv - finalIv < ivLimit, "IV_LIMIT_HIT");

    // update active strikes
    _addActiveStrike(strike.id, result.positionId);

    return (result.positionId, result.totalCost);
  }

  /////////////////////////////
  // Trade Parameter Helpers //
  /////////////////////////////

  /**
   * @dev return delta gap
   * @return deltaGap delta gap in abs value
   * TODO: Remake internal after tests
   */
  function _getDeltaGap(Strike memory strike, bool isSmallStrike) public view returns (uint deltaGap, int callDelta) {
    int targetDelta = isSmallStrike ? strategyDetail.maxtargetDelta : strategyDetail.mintargetDelta;
    uint[] memory strikeId = _toDynamic(strike.id);
    callDelta = _getDeltas(strikeId)[0];

    int delta = _isCall() ? callDelta : callDelta - SignedDecimalMath.UNIT;
    deltaGap = _abs(targetDelta - delta);
  }

  function _getTradeStrikes() public view returns (Strike memory smallStrike, Strike memory bigStrike) {
    // get all strike Ids for current board
    uint[] memory strikeIds = optionMarket.getBoardStrikes(currentBoardId);

    // get small and big strike Ids
    uint smallStrikeId = strikeIds[0];
    uint bigStrikeId = strikeIds[0];

    // init strikes
    smallStrike = _getStrikes(_toDynamic(smallStrikeId))[0];
    bigStrike = _getStrikes(_toDynamic(bigStrikeId))[0];

    (uint smallDeltaGap, ) = _getDeltaGap(smallStrike, true);
    (uint bigDeltaGap, ) = _getDeltaGap(bigStrike, false);

    for (uint i = 1; i < strikeIds.length - 1; i++) {
      // Get current Strike
      uint currentStrikeId = strikeIds[i];
      Strike memory currentStrike = _getStrikes(_toDynamic(currentStrikeId))[0];

      // Get current delta gaps
      (uint currentSmallDeltaGap, ) = _getDeltaGap(currentStrike, true);
      (uint currentBigDeltaGap, ) = _getDeltaGap(currentStrike, false);

      if (currentSmallDeltaGap < smallDeltaGap) {
        smallStrike = currentStrike;
        smallDeltaGap = currentSmallDeltaGap;
      }
      if (currentBigDeltaGap < bigDeltaGap) {
        bigStrike = currentStrike;
        bigDeltaGap = currentBigDeltaGap;
      }
    }

    // final checks
    require(smallDeltaGap <= strategyDetail.maxDeltaGap, "smallDeltaGap out of bound!");
    require(bigDeltaGap <= strategyDetail.maxDeltaGap, "smallDeltaGap out");
  }

  function _exchangeQuoteToBaseWithLimit(uint quoteAmount) internal returns (uint baseReceived) {
    ExchangeRateParams memory exchangeParams = _getExchangeParams();

    if (exchangeParams.baseQuoteFeeRate <= strategyDetail.maxExchangeFeeRate) {
      uint minQuoteExpected = quoteAmount.divideDecimal(exchangeParams.spotPrice).multiplyDecimal(
        DecimalMath.UNIT - exchangeParams.baseQuoteFeeRate
      );
      baseReceived = _exchangeFromExactQuote(quoteAmount, minQuoteExpected);
    }
    //TODO: Add event emission
  }

  /////////////////
  // Getters //////
  /////////////////

  // FIXME: Remove
  function getPositions(uint[] memory positionIds) public view returns (OptionPosition[] memory) {
    return _getPositions(positionIds);
  }
}
