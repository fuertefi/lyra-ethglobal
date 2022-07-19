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
    using DecimalMath for uint256;
    using SignedDecimalMath for int256;

    //uint public optionSize;

    ///////////
    // ADMIN //
    ///////////

    constructor(CSVault _vault) CSStrategyBase(_vault) {}

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
    function doTrade(uint256 tradeSize)
        external
        onlyVault
        returns (
            uint256 positionId1,
            uint256 positionId2,
            uint256 premiumsReceived,
            uint256 premiumsExchangeValue
        )
    {
        // TODO: redefinie premiumsReceived, premiumExchangeValue etc
        // We sell options we get premiums
        // We sell premiums we get additional premium
        // premiumsReceived doesnt reflect the stratrgy sUSD balance since we echange it

        // EXCHANGE sUSD in strategy if bal>0
        uint quoteBal = quoteAsset.balanceOf(address(this));
        if (quoteBal > 0) _exchangeQuoteToBaseWithLimit(quoteBal);

        // TRADE STRIKE
        (Strike memory strike1, Strike memory strike2) = _getTradeStrikes();

        // PRINCIPAL TRADE PART
        (positionId1, positionId2, premiumsReceived) = _tradeStrikes(
            strike1,
            strike2,
            tradeSize
        );

        // PREMIUMS TRADE PART
        // TODO: Calling _exchangeQuoteToBaseWithLimit twice maybe we can just exchange our whole balance here and trade premiums
        premiumsExchangeValue = _exchangeQuoteToBaseWithLimit(premiumsReceived);

        if (premiumsExchangeValue > 0) {
            uint256 premiumTradeSize = premiumsExchangeValue / 2;
            uint256 additionalPremium;
            (, , additionalPremium) = _tradeStrikes(
                strike1,
                strike2,
                premiumTradeSize
            );
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
            uint256 positionId1,
            uint positionId2,
            uint256 premiumsReceived
        )
    //uint256 collateralToAdd
    {
        uint premiumReceived1;
        (positionId1, premiumReceived1) = _tradeStrike(strike1, tradeSize);

        uint premiumReceived2;
        (positionId2, premiumReceived2) = _tradeStrike(strike2, tradeSize);

        premiumsReceived = premiumReceived1 + premiumReceived2;
    }

    function _tradeStrike(Strike memory strike, uint tradeSize)
        internal
        returns (uint256 positionId, uint256 premiumReceived)
    {
        uint setCollateralTo;
        setCollateralTo = getRequiredCollateral(strike, tradeSize);

        (positionId, premiumReceived) = _sellStrike(
            strike,
            tradeSize,
            setCollateralTo
        );
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
    function getRequiredCollateral(Strike memory strike, uint tradeSize)
        public
        view
        returns (uint256 setCollateralTo)
    {
        uint positionId = strikeToPositionId[strike.id];
        if (positionId == 0) {
            setCollateralTo = tradeSize;
        } else {
            OptionPosition memory currentPosition = _getPositions(
                _toDynamic(positionId)
            )[0];
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
    ) internal returns (uint256, uint256) {
        // TODO: fixi this part with min expected premium and strategy min vol
        // get minimum expected premium based on minIv
        // uint256 minExpectedPremium = _getPremiumLimit(
        //     strike,
        //     strategyDetail.minVol,
        //     tradeSize
        // );

        uint256 initIv = strike.boardIv.multiplyDecimal(strike.skew);

        // perform trade
        TradeResult memory result = _openPosition(
            TradeInputParameters({
                strikeId: strike.id,
                positionId: strikeToPositionId[strike.id],
                iterations: 4,
                optionType: optionType,
                amount: tradeSize,
                setCollateralTo: setCollateralTo,
                minTotalCost: 0,
                maxTotalCost: type(uint256).max,
                rewardRecipient: lyraRewardRecipient // set to zero address if don't want to wait for whitelist
            })
        );
        Strike memory finalStrike = _getStrikes(_toDynamic(strike.id))[0];
        uint256 finalIv = finalStrike.boardIv.multiplyDecimal(finalStrike.skew);
        require(initIv - finalIv < ivLimit, "IV_LIMIT_HIT");

        // lastTradeTimestamp[strike.id] = block.timestamp;

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
     */
    function _getDeltaGap(Strike memory strike, bool isSmallStrike)
        public
        view
        returns (uint256 deltaGap, int256 callDelta)
    {
        int256 targetDelta = isSmallStrike
            ? strategyDetail.maxtargetDelta
            : strategyDetail.mintargetDelta;
        uint256[] memory strikeId = _toDynamic(strike.id);
        callDelta = _getDeltas(strikeId)[0];

        int256 delta = _isCall()
            ? callDelta
            : callDelta - SignedDecimalMath.UNIT;
        deltaGap = _abs(targetDelta - delta);
    }

    function _getTradeStrikes()
        public
        view
        returns (Strike memory smallStrike, Strike memory bigStrike)
    {
        // get all strike Ids for current board
        uint256[] memory strikeIds = optionMarket.getBoardStrikes(
            currentBoardId
        );

        // get small and big strike Ids
        uint256 smallStrikeId = strikeIds[0];
        uint256 bigStrikeId = strikeIds[0];

        // init strikes
        smallStrike = _getStrikes(_toDynamic(smallStrikeId))[0];
        bigStrike = _getStrikes(_toDynamic(bigStrikeId))[0];

        (uint256 smallDeltaGap, ) = _getDeltaGap(smallStrike, true);
        (uint256 bigDeltaGap, ) = _getDeltaGap(bigStrike, false);

        for (uint256 i = 1; i < strikeIds.length - 1; i++) {
            // Get current Strike
            uint256 currentStrikeId = strikeIds[i];
            Strike memory currentStrike = _getStrikes(
                _toDynamic(currentStrikeId)
            )[0];

            // Get current delta gaps
            (uint256 currentSmallDeltaGap, ) = _getDeltaGap(
                currentStrike,
                true
            );
            (uint256 currentBigDeltaGap, ) = _getDeltaGap(currentStrike, false);

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
        require(
            smallDeltaGap <= strategyDetail.maxDeltaGap,
            "smallDeltaGap out of bound!"
        );
        require(bigDeltaGap <= strategyDetail.maxDeltaGap, "smallDeltaGap out");
    }

    function _exchangeQuoteToBaseWithLimit(uint256 quoteAmount)
        internal
        returns (uint256 baseReceived)
    {
        ExchangeRateParams memory exchangeParams = _getExchangeParams();

        if (
            exchangeParams.baseQuoteFeeRate <= strategyDetail.maxExchangeFeeRate
        ) {
            uint256 minQuoteExpected = quoteAmount
                .divideDecimal(exchangeParams.spotPrice)
                .multiplyDecimal(
                    DecimalMath.UNIT - exchangeParams.baseQuoteFeeRate
                );
            baseReceived = _exchangeFromExactQuote(
                quoteAmount,
                minQuoteExpected
            );
        }
        //TODO: Add event emission
    }

    /////////////////
    // Getters //////
    /////////////////

    // FIXME: Remove
    function getPositions(uint256[] memory positionIds)
        public
        view
        returns (OptionPosition[] memory)
    {
        return _getPositions(positionIds);
    }
}
