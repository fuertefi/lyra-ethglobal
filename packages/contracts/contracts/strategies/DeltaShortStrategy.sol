//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

// Hardhat
import "hardhat/console.sol";

// standard strategy interface
import "../interfaces/IStrategy.sol";

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

contract DeltaShortStrategy is StrategyBase, IStrategy {
    using DecimalMath for uint256;
    using SignedDecimalMath for int256;

    // example strategy detail
    struct DeltaShortStrategyDetail {
        uint256 minTimeToExpiry;
        uint256 maxTimeToExpiry;
        int256 targetDelta; // -20%
        uint256 maxDeltaGap; // 5%
        uint256 minVol; // 80%
        uint256 maxVol; // 130%
        uint256 size;
        uint256 maxVolVariance; // 10%
        uint256 gwavPeriod;
        uint256 collatBuffer; // multiple of vaultAdapter.minCollateral(): 1.1 -> 110% * minCollat
        uint256 collatPercent; // partial collateral: 0.9 -> 90% * fullCollat
        uint256 minTradeInterval;
    }

    DeltaShortStrategyDetail public strategyDetail;
    uint256 public activeExpiry;

    ///////////
    // ADMIN //
    ///////////

    constructor(
        LyraVault _vault,
        OptionType _optionType,
        GWAVOracle _gwavOracle
    ) StrategyBase(_vault, _optionType, _gwavOracle) {}

    /**
     * @dev update the strategy detail for the new round.
     */
    function setStrategyDetail(DeltaShortStrategyDetail memory _deltaStrategy)
        external
        onlyOwner
    {
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
    function setBoard(uint256 boardId) external onlyVault {
        Board memory board = getBoard(boardId);
        require(_isValidExpiry(board.expiry), "invalid board");
        activeExpiry = board.expiry;
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
     * @param strikeId lyra strikeId to trade
     * @param lyraRewardRecipient address to receive trading reward. This need to be whitelisted
     * @return positionId
     * @return premiumReceived
     */
    function doTrade(uint256 strikeId, address lyraRewardRecipient)
        external
        onlyVault
        returns (
            uint256 positionId,
            uint256 premiumReceived,
            uint256 collateralToAdd
        )
    {
        // validate trade
        require(
            lastTradeTimestamp[strikeId] + strategyDetail.minTradeInterval <=
                block.timestamp,
            "min time interval not passed"
        );
        require(_isValidVolVariance(strikeId), "vol variance exceeded");

        Strike memory strike = getStrikes(_toDynamic(strikeId))[0];
        require(isValidStrike(strike), "invalid strike");

        uint256 setCollateralTo;
        (collateralToAdd, setCollateralTo) = getRequiredCollateral(strike);

        require(
            collateralAsset.transferFrom(
                address(vault),
                address(this),
                collateralToAdd
            ),
            "collateral transfer from vault failed"
        );

        (positionId, premiumReceived) = _sellStrike(
            strike,
            setCollateralTo,
            lyraRewardRecipient
        );
    }

    /**
     * @dev calculate required collateral to add in the next trade.
     * sell size is fixed as strategyDetail.size
     * only add collateral if the additional sell will make the position out of buffer range
     * never remove collateral from an existing position
     */
    function getRequiredCollateral(Strike memory strike)
        public
        view
        returns (uint256 collateralToAdd, uint256 setCollateralTo)
    {
        uint256 sellAmount = strategyDetail.size;
        ExchangeRateParams memory exchangeParams = getExchangeParams();

        // get existing position info if active
        uint256 existingAmount = 0;
        uint256 existingCollateral = 0;
        if (_isActiveStrike(strike.id)) {
            OptionPosition memory position = getPositions(
                _toDynamic(strikeToPositionId[strike.id])
            )[0];
            existingCollateral = position.collateral;
            existingAmount = position.amount;
        }

        // gets minBufferCollat for the whole position
        uint256 minBufferCollateral = _getBufferCollateral(
            strike.strikePrice,
            strike.expiry,
            exchangeParams.spotPrice,
            existingAmount + sellAmount
        );

        // get targetCollat for this trade instance
        // prevents vault from adding excess collat just to meet targetCollat
        uint256 targetCollat = existingCollateral +
            _getFullCollateral(strike.strikePrice, sellAmount).multiplyDecimal(
                strategyDetail.collatPercent
            );

        // if excess collateral, keep in position to encourage more option selling
        setCollateralTo = _max(
            _max(minBufferCollateral, targetCollat),
            existingCollateral
        );

        // existingCollateral is never > setCollateralTo
        collateralToAdd = setCollateralTo - existingCollateral;
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
        uint256 setCollateralTo,
        address lyraRewardRecipient
    ) internal returns (uint256, uint256) {
        // get minimum expected premium based on minIv
        uint256 minExpectedPremium = _getPremiumLimit(
            strike,
            strategyDetail.minVol,
            strategyDetail.size
        );
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
                maxTotalCost: type(uint256).max,
                rewardRecipient: lyraRewardRecipient // set to zero address if don't want to wait for whitelist
            })
        );
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
        uint256 positionId,
        uint256 closeAmount,
        address lyraRewardRecipient
    ) external onlyVault {
        OptionPosition memory position = getPositions(_toDynamic(positionId))[
            0
        ];
        Strike memory strike = getStrikes(_toDynamic(position.strikeId))[0];
        require(
            strikeToPositionId[position.strikeId] == positionId,
            "invalid positionId"
        );

        // only allows closing if collat < minBuffer
        require(
            closeAmount <=
                getAllowedCloseAmount(
                    position,
                    strike.strikePrice,
                    strike.expiry
                ),
            "amount exceeds allowed close amount"
        );

        // closes excess position with premium balance
        uint256 maxExpectedPremium = _getPremiumLimit(
            strike,
            strategyDetail.maxVol,
            strategyDetail.size
        );
        TradeInputParameters memory tradeParams = TradeInputParameters({
            strikeId: position.strikeId,
            positionId: position.positionId,
            iterations: 3,
            optionType: optionType,
            amount: closeAmount,
            setCollateralTo: position.collateral,
            minTotalCost: type(uint256).min,
            maxTotalCost: maxExpectedPremium,
            rewardRecipient: lyraRewardRecipient // set to zero address if don't want to wait for whitelist
        });

        TradeResult memory result;
        if (!_isOutsideDeltaCutoff(strike.id)) {
            result = closePosition(tradeParams);
        } else {
            // will pay less competitive price to close position
            result = forceClosePosition(tradeParams);
        }

        require(
            result.totalCost <= maxExpectedPremium,
            "premium paid is above max expected premium"
        );

        // return closed collateral amount
        if (_isBaseCollat()) {
            uint256 currentBal = baseAsset.balanceOf(address(this));
            baseAsset.transfer(address(vault), currentBal);
        } else {
            // quote collateral
            quoteAsset.transfer(address(vault), closeAmount);
        }
    }

    /**
     * @dev calculates the position amount required to stay above the buffer collateral
     */
    function getAllowedCloseAmount(
        OptionPosition memory position,
        uint256 strikePrice,
        uint256 strikeExpiry
    ) public view returns (uint256 closeAmount) {
        ExchangeRateParams memory exchangeParams = getExchangeParams();
        uint256 minCollatPerAmount = _getBufferCollateral(
            strikePrice,
            strikeExpiry,
            exchangeParams.spotPrice,
            1e18
        );

        closeAmount = position.collateral <
            minCollatPerAmount.multiplyDecimal(position.amount)
            ? position.amount -
                position.collateral.divideDecimal(minCollatPerAmount)
            : 0;
    }

    /////////////////////////////
    // Trade Parameter Helpers //
    /////////////////////////////

    function _getFullCollateral(uint256 strikePrice, uint256 amount)
        internal
        view
        returns (uint256 fullCollat)
    {
        // calculate required collat based on collatBuffer and collatPercent
        fullCollat = _isBaseCollat()
            ? amount
            : amount.multiplyDecimal(strikePrice);
    }

    /**
     * @dev get amount of collateral needed for shorting {amount} of strike, according to the strategy
     */
    function _getBufferCollateral(
        uint256 strikePrice,
        uint256 expiry,
        uint256 spotPrice,
        uint256 amount
    ) internal view returns (uint256) {
        uint256 minCollat = getMinCollateral(
            optionType,
            strikePrice,
            expiry,
            spotPrice,
            amount
        );
        uint256 minCollatWithBuffer = minCollat.multiplyDecimal(
            strategyDetail.collatBuffer
        );

        uint256 fullCollat = _getFullCollateral(strikePrice, amount);

        return _min(minCollatWithBuffer, fullCollat);
    }

    /////////////////
    // Validation ///
    /////////////////

    /**
     * @dev verify if the strike is valid for the strategy
     * @return isValid true if vol is within [minVol, maxVol] and delta is within targetDelta +- maxDeltaGap
     */
    function isValidStrike(Strike memory strike)
        public
        view
        returns (bool isValid)
    {
        if (activeExpiry != strike.expiry) {
            return false;
        }

        uint256[] memory strikeId = _toDynamic(strike.id);
        uint256 vol = getVols(strikeId)[0];
        int256 callDelta = getDeltas(strikeId)[0];
        int256 delta = _isCall()
            ? callDelta
            : callDelta - SignedDecimalMath.UNIT;
        uint256 deltaGap = _abs(strategyDetail.targetDelta - delta);
        return
            vol >= strategyDetail.minVol &&
            vol <= strategyDetail.maxVol &&
            deltaGap < strategyDetail.maxDeltaGap;
    }

    /**
     * @dev check if the vol variance for the given strike is within certain range
     */
    function _isValidVolVariance(uint256 strikeId)
        internal
        view
        returns (bool isValid)
    {
        uint256 volGWAV = gwavOracle.volGWAV(
            strikeId,
            strategyDetail.gwavPeriod
        );
        uint256 volSpot = getVols(_toDynamic(strikeId))[0];

        uint256 volDiff = (volGWAV >= volSpot)
            ? volGWAV - volSpot
            : volSpot - volGWAV;

        return isValid = volDiff < strategyDetail.maxVolVariance;
    }

    /**
     * @dev check if the expiry of the board is valid according to the strategy
     */
    function _isValidExpiry(uint256 expiry) public view returns (bool isValid) {
        uint256 secondsToExpiry = _getSecondsToExpiry(expiry);
        isValid = (secondsToExpiry >= strategyDetail.minTimeToExpiry &&
            secondsToExpiry <= strategyDetail.maxTimeToExpiry);
    }
}
