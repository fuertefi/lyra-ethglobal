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
        uint minVol; // 80%
        uint size; // 15
    }

    HackMoneyStrategyDetail public strategyDetail;
    uint public activeExpiry;
    uint public currentBoardId;
    uint public ivLimit = 2 * 1e18;
    address public lyraRewardRecipient;

    //uint public optionSize;

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
    function setStrategyDetail(HackMoneyStrategyDetail memory _deltaStrategy)
        external
        onlyOwner
    {
        (, , , , , , , bool roundInProgress) = vault.vaultState();
        require(!roundInProgress, "cannot change strategy if round is active");
        strategyDetail = _deltaStrategy;
    }

    /**
     * @dev update the iv limit
     */
    function setIvLimit(uint _ivLimit) external onlyOwner {
        ivLimit = _ivLimit;
    }

    /**
     * @dev update lyra reward recipient
     */
    function setLyraRewardRecipient(address _lyraRewardRecipient)
        external
        onlyOwner
    {
        lyraRewardRecipient = _lyraRewardRecipient;
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
     * @return positionId1
     * @return positionId2
     * @return premiumReceived
     * @return collateralToAdd
     */
    function doTrade(uint size)
        external
        onlyVault
        returns (
            uint positionId1,
            uint positionId2,
            uint premiumReceived,
            uint collateralToAdd,
            uint premiumExchangeValue
        )
    // uint exchangeValue
    {
        strategyDetail.size = size;

        (
            positionId1,
            positionId2,
            premiumReceived,
            collateralToAdd,
            premiumExchangeValue
        ) = _tradeOptions();
    }

    function _tradeOptions()
        internal
        returns (
            uint positionId1,
            uint positionId2,
            uint premiumReceived,
            uint collateralToAdd,
            uint premiumExchangeValue
        )
    {
        (Strike memory strike1, Strike memory strike2) = _getTradeStrikes();

        uint premiumReceived1;
        uint premiumReceived2;
        uint collateralToAdd1;
        uint collateralToAdd2;

        (positionId1, premiumReceived1, collateralToAdd1) = _tradeStrike(
            strike1
        );
        (positionId2, premiumReceived2, collateralToAdd2) = _tradeStrike(
            strike2
        );

        //premiumReceived = premiumReceived1 + premiumReceived2;

        // uint additionalPremium;
        // (, , additionalPremium, premiumExchangeValue) = _tradePremiums(
        //     premiumReceived,
        //     collateralToAdd1,
        //     collateralToAdd2
        // );

        collateralToAdd = collateralToAdd1 + collateralToAdd2; // + exchangeValue;

        //premiumReceived += additionalPremium;
        //     premiumReceived =
        //         premiumReceived1 +
        //         premiumReceived2 +
        //         additionalPremium;
    }

    function _tradeStrike(Strike memory strike)
        internal
        returns (
            uint positionId,
            uint premiumReceived,
            uint collateralToAdd
        )
    {
        (collateralToAdd, ) = getRequiredCollateral(strike);

        (positionId, premiumReceived) = _sellStrike(strike, collateralToAdd);
    }

    /**
     * @notice trade premiums received from a trade
     * @return positionId1
     * @return positionId2
     * @return premiumReceived
     */
    function _tradePremiums(
        uint size,
        uint collateralToAdd1,
        uint collateralToAdd2
    )
        internal
        returns (
            uint positionId1,
            uint positionId2,
            uint premiumReceived,
            uint exchangeValue
        )
    {
        // exchange susd to seth
        exchangeValue = _exchangePremiums(size);
        console.log("exchange done");
        uint sellAmount = exchangeValue / 2;
        (Strike memory strike1, Strike memory strike2) = _getTradeStrikes();
        uint premiumReceived1;
        console.log("selling premiums with first strike");
        (positionId1, premiumReceived1) = _sellPremiums(
            strike1,
            sellAmount,
            collateralToAdd1
        );
        console.log("selling premiums with second strike");
        uint premiumReceived2;
        (positionId2, premiumReceived2) = _sellPremiums(
            strike2,
            sellAmount,
            collateralToAdd2
        );
        console.log("premium sold");
        premiumReceived = premiumReceived1 + premiumReceived2;
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
     * @return positionId
     * @return premiumReceived
     */
    function _sellStrike(Strike memory strike, uint setCollateralTo)
        internal
        returns (uint, uint)
    {
        // get minimum expected premium based on minIv
        uint minExpectedPremium = _getPremiumLimit(
            strike,
            strategyDetail.minVol,
            strategyDetail.size
        );
        uint strikeId = strike.id;
        uint initIv = strike.boardIv.multiplyDecimal(strike.skew);

        // perform trade
        TradeResult memory result = openPosition(
            TradeInputParameters({
                strikeId: strike.id,
                positionId: strikeToPositionId[strike.id],
                iterations: 100,
                optionType: optionType,
                amount: strategyDetail.size,
                setCollateralTo: setCollateralTo,
                minTotalCost: minExpectedPremium,
                maxTotalCost: type(uint).max,
                rewardRecipient: lyraRewardRecipient // set to zero address if don't want to wait for whitelist
            })
        );
        Strike memory finalStrike = getStrikes(_toDynamic(strikeId))[0];
        uint finalIv = finalStrike.boardIv.multiplyDecimal(finalStrike.skew);
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
    function _sellPremiums(
        Strike memory strike,
        uint size,
        uint collateralToAdd
    ) internal returns (uint, uint) {
        // get minimum expected premium based on minIv
        uint minExpectedPremium = _getPremiumLimit(
            strike,
            strategyDetail.minVol,
            size
        );

        uint strikeId = strike.id;
        uint initIv = strike.boardIv.multiplyDecimal(strike.skew);

        // perform trade
        TradeResult memory result = openPosition(
            TradeInputParameters({
                strikeId: strike.id,
                positionId: strikeToPositionId[strike.id],
                iterations: 4,
                optionType: optionType,
                amount: size,
                setCollateralTo: size + collateralToAdd,
                minTotalCost: minExpectedPremium,
                maxTotalCost: type(uint).max,
                rewardRecipient: lyraRewardRecipient // set to zero address if don't want to wait for whitelist
            })
        );
        Strike memory finalStrike = getStrikes(_toDynamic(strikeId))[0];
        uint finalIv = finalStrike.boardIv.multiplyDecimal(finalStrike.skew);
        require(initIv - finalIv < ivLimit, "IV_LIMIT_HIT");

        lastTradeTimestamp[strike.id] = block.timestamp;

        // update active strikes
        _addActiveStrike(strike.id, result.positionId);

        require(
            result.totalCost >= minExpectedPremium,
            "premium received is below min expected premium"
        );

        return (result.positionId, result.totalCost);
    }

    function _getTradeStrikes()
        internal
        view
        returns (Strike memory smallStrike, Strike memory bigStrike)
    {
        // get all strike Ids for current board
        uint[] memory strikeIds = optionMarket.getBoardStrikes(currentBoardId);

        // get small and big strike Ids
        uint smallStrikeId = strikeIds[0];
        uint bigStrikeId = strikeIds[strikeIds.length - 1];

        // init strikes
        smallStrike = getStrikes(_toDynamic(smallStrikeId))[0];
        bigStrike = getStrikes(_toDynamic(bigStrikeId))[0];

        (uint smallDeltaGap, ) = _getDeltaGap(smallStrike, true);
        (uint bigDeltaGap, ) = _getDeltaGap(bigStrike, false);

        for (uint i = 1; i < strikeIds.length - 1; i++) {
            uint currentStrikeId = strikeIds[i];
            Strike memory currentStrike = getStrikes(
                _toDynamic(currentStrikeId)
            )[0];
            (uint currentDeltaGap, ) = _getDeltaGap(currentStrike, true);
            if (currentDeltaGap < smallDeltaGap) {
                smallStrike = currentStrike;
                smallDeltaGap = currentDeltaGap;
            } else {
                break;
            }
        }

        for (uint i = strikeIds.length - 2; i > 1; i--) {
            uint currentStrikeId = strikeIds[i];
            Strike memory currentStrike = getStrikes(
                _toDynamic(currentStrikeId)
            )[0];
            (uint currentDeltaGap, int currentDelta) = _getDeltaGap(
                currentStrike,
                false
            );
            if (currentDeltaGap < bigDeltaGap) {
                bigStrike = currentStrike;
                bigDeltaGap = currentDeltaGap;
            } else if (currentDelta != 0) {
                break;
            }
        }
    }

    function getStrikes()
        public
        view
        returns (uint smallStrikePrice, uint bigStrikePrice)
    {
        (
            Strike memory smallStrike,
            Strike memory bigStrike
        ) = _getTradeStrikes();
        smallStrikePrice = smallStrike.strikePrice;
        bigStrikePrice = bigStrike.strikePrice;
    }

    /////////////////////////////
    // Trade Parameter Helpers //
    /////////////////////////////

    /**
     * @param strikePrice the strike price
     * @param amount of options to cover
     * @return fullCollat much collateral is needed for `amount` sell of options
     */
    function _getFullCollateral(uint strikePrice, uint amount)
        internal
        view
        returns (uint fullCollat)
    {
        // calculate required collat based on collatBuffer and collatPercent
        fullCollat = _isBaseCollat()
            ? amount
            : amount.multiplyDecimal(strikePrice);
    }

    /**
     * @dev return delta gap
     * @return deltaGap delta gap in abs value
     */
    function _getDeltaGap(Strike memory strike, bool isSmallStrike)
        public
        view
        returns (uint deltaGap, int callDelta)
    {
        int targetDelta = isSmallStrike
            ? strategyDetail.maxtargetDelta
            : strategyDetail.mintargetDelta;
        uint[] memory strikeId = _toDynamic(strike.id);
        callDelta = getDeltas(strikeId)[0];

        int delta = _isCall() ? callDelta : callDelta - SignedDecimalMath.UNIT;
        deltaGap = _abs(targetDelta - delta);
    }

    /////////////////
    // Validation ///
    /////////////////

    /**
     * @dev check if the expiry of the board is valid according to the strategy
     */
    function _isValidExpiry(uint expiry) public view returns (bool isValid) {
        uint secondsToExpiry = _getSecondsToExpiry(expiry);
        isValid = (secondsToExpiry >= strategyDetail.minTimeToExpiry &&
            secondsToExpiry <= strategyDetail.maxTimeToExpiry);
    }

    function _exchangePremiums(uint size) internal returns (uint baseReceived) {
        ExchangeRateParams memory exchangeParams = getExchangeParams();
        console.log("exchange params");
        console.log(exchangeParams.spotPrice);
        console.log(exchangeParams.quoteBaseFeeRate);
        console.log(exchangeParams.baseQuoteFeeRate);

        //uint quoteBal = quoteAsset.balanceOf(address(this));
        // exchange quote asset to base asset

        uint minQuoteExpected = size
            .divideDecimal(exchangeParams.spotPrice)
            .multiplyDecimal(
                DecimalMath.UNIT - exchangeParams.baseQuoteFeeRate
            );

        console.log("minQuoteExpected:", minQuoteExpected);
        baseReceived = exchangeFromExactQuote(size, minQuoteExpected);
        console.log("baseReceived:", baseReceived);
    }

    function getSETHExchangeParams()
        public
        view
        returns (ExchangeRateParams memory)
    {
        return getExchangeParams();
    }
}
