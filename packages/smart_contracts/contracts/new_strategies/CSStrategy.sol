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

contract CSStrategy is CSStrategyBase, ICSStrategy {
    using DecimalMath for uint256;
    using SignedDecimalMath for int256;

    //uint public optionSize;

    ///////////
    // ADMIN //
    ///////////

    constructor(CSVault _vault, OptionType _optionType)
        CSStrategyBase(_vault, _optionType)
    {}

    /**
     * @dev update the strategy detail for the new round.
     */
    function setStrategyDetail(StrategyDetail memory _strategyDetail)
        external
        onlyOwner
    {
        (, , , , , , , bool roundInProgress) = vault.vaultState();
        require(!roundInProgress, "cannot change strategy if round is active");
        _strategyDetail = _strategyDetail;
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
     * @return premiumReceived
     */
    function doTrade(uint256 tradeSize)
        external
        onlyVault
        returns (
            uint256 positionId1,
            uint256 positionId2,
            uint256 premiumsReceived,
            uint256 premiumExchangeValue
        )
    {
        // trade size
        // FIXME: Weird to save this to strategy detail as we'd do multiple trades and override. Add parameter to _tradeOptions method?
        // Currently useless getRequiredCollateral being public due to this
        // LOT OF FALSE SHIT HERE EDIT
        //strategyDetail.size = size;

        (Strike memory strike1, Strike memory strike2) = _getTradeStrikes();

        (positionId1, positionId2, premiumsReceived) = _tradeStrikes(
            strike1,
            strike2,
            tradeSize
        );

        uint256 additionalPremium;
        (additionalPremium, premiumExchangeValue) = _tradePremiums(
            premiumsReceived
        );

        //collateralToAdd = collateralToAdd1 + collateralToAdd2; // + exchangeValue;
        premiumsReceived += additionalPremium;
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

    /**
     * @notice trade premiums received from a trade
     * @return premiumReceived
     */
    function _tradePremiums(uint256 premiumsReceived)
        internal
        returns (uint256 premiumReceived, uint256 exchangeValue)
    {
        // exchange susd to seth

        exchangeValue = _exchangeQuoteToBaseWithLimit(premiumsReceived);

        if (exchangeValue > 0) {
            uint256 premiumTradeSize = exchangeValue / 2;
            (Strike memory strike1, Strike memory strike2) = _getTradeStrikes();

            uint256 premiumReceived1;
            premiumReceived1 = _sellPremiums(strike1, premiumTradeSize);
            uint256 premiumReceived2;
            premiumReceived2 = _sellPremiums(strike2, premiumTradeSize);

            premiumReceived = premiumReceived1 + premiumReceived2;
        }
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

        lastTradeTimestamp[strike.id] = block.timestamp;

        // update active strikes
        _addActiveStrike(strike.id, result.positionId);

        return (result.positionId, result.totalCost);
    }

    /**
     * @dev perform the trade
     * @param strike strike detail
     * @return positionId
     * @return premiumReceived
     */
    function _sellPremiums(Strike memory strike, uint256 premiumTradeSize)
        internal
        returns (uint256)
    {
        // get minimum expected premium based on minIv
        // uint256 minExpectedPremium = _getPremiumLimit(
        //     strike,
        //     strategyDetail.minVol,
        //     premiumTradeSize
        // );
        uint256 initIv = strike.boardIv.multiplyDecimal(strike.skew);
        uint setCollateralTo = getRequiredCollateral(strike, premiumTradeSize);
        // perform trade
        TradeResult memory result = _openPosition(
            TradeInputParameters({
                strikeId: strike.id,
                positionId: strikeToPositionId[strike.id],
                iterations: 4,
                optionType: optionType,
                amount: premiumTradeSize,
                setCollateralTo: setCollateralTo,
                minTotalCost: 0,
                maxTotalCost: type(uint256).max,
                rewardRecipient: lyraRewardRecipient // set to zero address if don't want to wait for whitelist
            })
        );
        Strike memory finalStrike = _getStrikes(_toDynamic(strike.id))[0];
        uint256 finalIv = finalStrike.boardIv.multiplyDecimal(finalStrike.skew);
        require(initIv - finalIv < ivLimit, "IV_LIMIT_HIT");

        // require(
        //     result.totalCost >= minExpectedPremium,
        //     "premium received is below min expected premium"
        // );

        return result.totalCost;
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

    /////////////////
    // Validation ///
    /////////////////

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
    }

    // FIXME: Remove
    function getPositions(uint256[] memory positionIds)
        public
        view
        returns (OptionPosition[] memory)
    {
        return _getPositions(positionIds);
    }
}
