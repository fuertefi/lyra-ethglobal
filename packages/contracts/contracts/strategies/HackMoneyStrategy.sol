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
    uint public ivLimit = 2 * 1e18;

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
    function doTrade(uint size, address lyraRewardRecipient)
        external
        onlyVault
        returns (
            uint positionId1,
            uint positionId2,
            uint premiumReceived,
            uint collateralToAdd
        )
    {
        strategyDetail.size = size;
        (Strike memory strike1, Strike memory strike2) = _getTradeStrikes();

        //uint setCollateralTo1;
        uint collateralToAdd1;
        (collateralToAdd1, ) = getRequiredCollateral(strike1);

        //uint setCollateralTo2;
        uint collateralToAdd2;
        (collateralToAdd2, ) = getRequiredCollateral(strike2);

        collateralToAdd = collateralToAdd1 + collateralToAdd2;

        // require(
        //     collateralAsset.transferFrom(
        //         address(vault),
        //         address(this),
        //         collateralToAdd
        //     ),
        //     "collateral transfer from vault failed"
        // );
        console.log("selling strike 1 ");
        uint premiumReceived1;
        (positionId1, premiumReceived1) = _sellStrike(
            strike1,
            collateralToAdd1,
            lyraRewardRecipient
        );
        console.log("selling strike 2 ");
        uint premiumReceived2;
        (positionId2, premiumReceived2) = _sellStrike(
            strike2,
            collateralToAdd2,
            lyraRewardRecipient
        );
        console.log("selling premiums  ");
        uint additionalPremium;
        (positionId1, positionId2, additionalPremium) = _tradePremiums(
            premiumReceived1 + premiumReceived2,
            collateralToAdd1,
            collateralToAdd2,
            lyraRewardRecipient
        );

        premiumReceived =
            premiumReceived1 +
            premiumReceived2 +
            additionalPremium;
    }

    /**
     * @notice trade premiums received from a trade
     * @param lyraRewardRecipient address to receive trading reward. This need to be whitelisted
     * @return positionId1
     * @return positionId2
     * @return premiumReceived
     */
    function _tradePremiums(
        uint size,
        uint collateralToAdd1,
        uint collateralToAdd2,
        address lyraRewardRecipient
    )
        internal
        returns (
            uint positionId1,
            uint positionId2,
            uint premiumReceived
        )
    {
        // exchange susd to seth
        uint baseBalanceBefore = baseAsset.balanceOf(address(this));
        _exchangePremiums(size);
        uint sellAmount = (baseAsset.balanceOf(address(this)) -
            baseBalanceBefore) / 2;
        console.log("exchange made");
        //uint size = baseAsset.balanceOf(address(this)) / 2;
        (Strike memory strike1, Strike memory strike2) = _getTradeStrikes();
        uint premiumReceived1;
        (positionId1, premiumReceived1) = _sellPremiums(
            strike1,
            sellAmount,
            collateralToAdd1,
            lyraRewardRecipient
        );
        console.log("sell premium 1 made");
        uint premiumReceived2;
        (positionId2, premiumReceived2) = _sellPremiums(
            strike2,
            sellAmount,
            collateralToAdd2,
            lyraRewardRecipient
        );
        console.log("sell premium 2 made");
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
                iterations: 4,
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

        require(
            result.totalCost >= minExpectedPremium,
            "premium received is below min expected premium"
        );

        return (result.positionId, result.totalCost);
    }

    /**
     * @dev perform the trade
     * @param strike strike detail
     * @param lyraRewardRecipient address to receive lyra trading reward
     * @return positionId
     * @return premiumReceived
     */
    function _sellPremiums(
        Strike memory strike,
        uint size,
        uint collateralToAdd,
        address lyraRewardRecipient
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

        uint smallDeltaGap = _getDeltaGap(smallStrike, true);
        uint bigDeltaGap = _getDeltaGap(bigStrike, false);

        for (uint i = 1; i < strikeIds.length - 1; i++) {
            uint currentStrikeId = strikeIds[i];
            Strike memory currentStrike = getStrikes(
                _toDynamic(currentStrikeId)
            )[0];
            uint currentDeltaGap = _getDeltaGap(currentStrike, true);
            if (currentDeltaGap < smallDeltaGap) {
                smallStrike = currentStrike;
                smallDeltaGap = currentDeltaGap;
            } else {
                break;
            }
        }

        for (uint i = strikeIds.length - 1; i > 1; i--) {
            uint currentStrikeId = strikeIds[i];
            Strike memory currentStrike = getStrikes(
                _toDynamic(currentStrikeId)
            )[0];
            uint currentDeltaGap = _getDeltaGap(currentStrike, false);
            if (currentDeltaGap < bigDeltaGap) {
                bigStrike = currentStrike;
                bigDeltaGap = currentDeltaGap;
            } else {
                break;
            }
        }
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
        returns (uint deltaGap)
    {
        int targetDelta = isSmallStrike
            ? strategyDetail.maxtargetDelta
            : strategyDetail.mintargetDelta;
        uint[] memory strikeId = _toDynamic(strike.id);
        int callDelta = getDeltas(strikeId)[0];
        int delta = _isCall() ? callDelta : callDelta - SignedDecimalMath.UNIT;
        deltaGap = _abs(targetDelta - delta);
    }

    /**
     * @param strikePrice the strike price
     * @param collateralToLock collateral available to lock.
     * @return size how many options we can sell.
     */
    function _getPositionSize(uint strikePrice, uint collateralToLock)
        internal
        view
        returns (uint size)
    {
        // calculate required collat based on collatBuffer and collatPercent
        //fullCollat = _isBaseCollat() ? amount : amount.multiplyDecimal(strikePrice);
        size = _isBaseCollat()
            ? collateralToLock
            : collateralToLock.divideDecimal(strikePrice);
    }

    /////////////////
    // Validation ///
    /////////////////

    /**
     * @dev verify if the strike is valid for the strategy
     * @return isValid true if vol is withint [minVol, maxVol] and delta is within targetDelta +- maxDeltaGap
     */
    function isValidStrike(Strike memory strike, bool isSmallStrike)
        public
        view
        returns (bool isValid)
    {
        if (activeExpiry != strike.expiry) {
            return false;
        }

        int targetDelta = isSmallStrike
            ? strategyDetail.maxtargetDelta
            : strategyDetail.mintargetDelta;
        uint[] memory strikeId = _toDynamic(strike.id);
        int callDelta = getDeltas(strikeId)[0];
        int delta = _isCall() ? callDelta : callDelta - SignedDecimalMath.UNIT;
        uint deltaGap = _abs(targetDelta - delta);
        return deltaGap < strategyDetail.maxDeltaGap;
    }

    /**
     * @dev check if the vol variance for the given strike is within certain range
     */
    function _isValidVolVariance(uint strikeId)
        internal
        view
        returns (bool isValid)
    {
        uint volGWAV = gwavOracle.volGWAV(strikeId, strategyDetail.gwavPeriod);
        uint volSpot = getVols(_toDynamic(strikeId))[0];

        uint volDiff = (volGWAV >= volSpot)
            ? volGWAV - volSpot
            : volSpot - volGWAV;

        return isValid = volDiff < strategyDetail.maxVolVariance;
    }

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
        //uint quoteBal = quoteAsset.balanceOf(address(this));
        // exchange quote asset to base asset
        uint minQuoteExpected = size
            .divideDecimal(exchangeParams.spotPrice)
            .multiplyDecimal(
                DecimalMath.UNIT - exchangeParams.baseQuoteFeeRate
            );
        baseReceived = exchangeFromExactQuote(size, minQuoteExpected);
    }
}
