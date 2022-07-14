//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

// Hardhat
import "hardhat/console.sol";

// standard strategy interface
import "../interfaces/IHackMoneyStrategy.sol";

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
        uint maxDeltaGap; // 5%
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

    constructor(HackMoneyVault _vault, OptionType _optionType)
        HackMoneyStrategyBase(_vault, _optionType)
    {}

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
        console.log(boardId);
        Board memory board = _getBoard(boardId);
        console.log(board.expiry);
        console.log(board.id);
        console.log(board.boardIv);
        require(_isValidExpiry(board.expiry), "invalid board");
        activeExpiry = board.expiry;
        currentBoardId = boardId;
    }

    /**
     * @dev convert premium in quote asset into collateral asset and send it back to the vault.
     */
    function returnFundsAndClearStrikes() external onlyVault {
        // exchange asset back to collateral asset and send it back to the vault
        _returnFundsToVault();

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

        console.log(size);

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
        console.log(strike1.id);
        console.log("strike 1 price");
        console.log(strike1.strikePrice);
        console.log("strike 1 board iv");
        console.log(strike1.boardIv);
        console.log("strike 2 price");
        console.log(strike2.strikePrice);
        console.log("strike 2 board iv");
        console.log(strike2.boardIv);

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
        premiumReceived = premiumReceived1 + premiumReceived2;

        OptionPosition memory _position1 = _getPositions(
            _toDynamic(positionId1)
        )[0];

        console.log("first position");
        console.log(_position1.amount);

        console.log("premium received for first");
        console.log(premiumReceived1);

        OptionPosition memory _position2 = _getPositions(
            _toDynamic(positionId2)
        )[0];

        console.log("second position");
        console.log(_position2.amount);

        console.log("premium received for second");
        console.log(premiumReceived2);

        uint additionalPremium;
        (, , additionalPremium, premiumExchangeValue) = _tradePremiums(
            premiumReceived,
            collateralToAdd1,
            collateralToAdd2
        );

        console.log("option position id 1");
        console.log(positionId1);
        console.log("additional premium");
        console.log(additionalPremium);
        console.log("premium received");
        console.log(premiumReceived);
        console.log("premium exchange value");
        console.log(premiumExchangeValue);
        console.log("option position id 2");
        console.log(positionId2);

        OptionPosition memory position2 = _getPositions(
            _toDynamic(positionId2)
        )[0];

        console.log("after premiums trade position");
        console.log(position2.amount);

        collateralToAdd = collateralToAdd1 + collateralToAdd2; // + exchangeValue;
        console.log("collateralToAdd");
        console.log(collateralToAdd);
        premiumReceived += additionalPremium;
        console.log("premiumReceived");
        console.log(premiumReceived);
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
        console.log("before selling strike");
        console.log(collateralToAdd);

        (positionId, premiumReceived) = _sellStrike(strike, collateralToAdd);
        console.log("position id");
        console.log(positionId);
        console.log("premium received");
        console.log(premiumReceived);
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

        console.log("selling size");
        console.log(size);
        exchangeValue = _exchangePremiums(size);
        console.log("exchange value");
        console.log(exchangeValue);

        uint sellAmount = exchangeValue / 2;
        (Strike memory strike1, Strike memory strike2) = _getTradeStrikes();
        uint premiumReceived1;
        (positionId1, premiumReceived1) = _sellPremiums(
            strike1,
            sellAmount,
            collateralToAdd1
        );
        uint premiumReceived2;
        (positionId2, premiumReceived2) = _sellPremiums(
            strike2,
            sellAmount,
            collateralToAdd2
        );

        console.log("premium position id 1");
        console.log(positionId1);
        console.log("premium position id 2");
        console.log(positionId2);
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

  function initialize(HackMoneyVault _vault, OptionType _optionType) public initializer {
      HackMoneyStrategyBase.initializeBase(_vault, _optionType);
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
        console.log("trying to sell strike");
        // get minimum expected premium based on minIv
        uint minExpectedPremium = _getPremiumLimit(
            strike,
            strategyDetail.minVol,
            strategyDetail.size
        );
        console.log("min expected premium");
        console.log(minExpectedPremium);
        uint strikeId = strike.id;
        uint initIv = strike.boardIv.multiplyDecimal(strike.skew);
        console.log("nit iv");
        console.log(initIv);

        // perform trade
        TradeResult memory result = _openPosition(
            TradeInputParameters({
                strikeId: strike.id,
                positionId: strikeToPositionId[strike.id],
                iterations: 4,
                optionType: optionType,
                amount: strategyDetail.size,
                setCollateralTo: setCollateralTo,
                minTotalCost: 0,
                maxTotalCost: type(uint).max,
                rewardRecipient: lyraRewardRecipient // set to zero address if don't want to wait for whitelist
            })
        );
        Strike memory finalStrike = _getStrikes(_toDynamic(strikeId))[0];
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
        console.log(strategyDetail.minVol);
        uint strikeId = strike.id;
        console.log(strike.id);
        uint initIv = strike.boardIv.multiplyDecimal(strike.skew);

        // perform trade
        TradeResult memory result = _openPosition(
            TradeInputParameters({
                strikeId: strike.id,
                positionId: strikeToPositionId[strike.id],
                iterations: 4,
                optionType: optionType,
                amount: size,
                setCollateralTo: size + collateralToAdd,
                minTotalCost: 0,
                maxTotalCost: type(uint).max,
                rewardRecipient: lyraRewardRecipient // set to zero address if don't want to wait for whitelist
            })
        );
        Strike memory finalStrike = _getStrikes(_toDynamic(strikeId))[0];
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
        uint bigStrikeId = strikeIds[0];

        // init strikes
        smallStrike = _getStrikes(_toDynamic(smallStrikeId))[0];
        bigStrike = _getStrikes(_toDynamic(bigStrikeId))[0];

        (uint smallDeltaGap, ) = _getDeltaGap(smallStrike, true);
        (uint bigDeltaGap, ) = _getDeltaGap(bigStrike, false);
        console.log("smallDeltaGap:", smallDeltaGap / 10**15, " / 10 %");
        console.log("bigDeltaGap:", bigDeltaGap / 10**15, "/ 10 %");

        for (uint i = 1; i < strikeIds.length - 1; i++) {
            // Get current Strike
            uint currentStrikeId = strikeIds[i];
            Strike memory currentStrike = _getStrikes(
                _toDynamic(currentStrikeId)
            )[0];

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
            console.log("Loop iteration: ", i);
            console.log("smallDeltaGap:", smallDeltaGap / 10**15, " / 10 %");
            console.log("bigDeltaGap:", bigDeltaGap / 10**15, " / 10 %");
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
        callDelta = _getDeltas(strikeId)[0];

        int delta = _isCall() ? callDelta : callDelta - SignedDecimalMath.UNIT;
        console.log("delta");
        console.logInt(delta);
        console.logInt(targetDelta);
        console.log(strike.strikePrice);
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
        ExchangeRateParams memory exchangeParams = _getExchangeParams();
        //uint quoteBal = quoteAsset.balanceOf(address(this));
        // exchange quote asset to base asset
        uint minQuoteExpected = size
            .divideDecimal(exchangeParams.spotPrice)
            .multiplyDecimal(
                DecimalMath.UNIT - exchangeParams.baseQuoteFeeRate
            );
        baseReceived = _exchangeFromExactQuote(size, minQuoteExpected);
    }

    // FIXME: To remove
    function getPositions(uint[] memory positionIds)
        public
        view
        returns (OptionPosition[] memory)
    {
        return _getPositions(positionIds);
    }
}
