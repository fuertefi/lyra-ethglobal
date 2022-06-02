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

contract DeltaLongStrategy is StrategyBase, IStrategy {
    using DecimalMath for uint256;
    using SignedDecimalMath for int256;

    // example strategy detail
    struct DeltaLongStrategyDetail {
        uint256 minTimeToExpiry;
        uint256 maxTimeToExpiry;
        int256 targetDelta;
        uint256 maxDeltaGap;
        uint256 minVol;
        uint256 maxVol;
        uint256 size;
        uint256 maxVolVariance;
        uint256 gwavPeriod;
        uint256 minTradeInterval;
    }

    DeltaLongStrategyDetail public strategyDetail;
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
    function setStrategyDetail(DeltaLongStrategyDetail memory _deltaStrategy)
        external
        onlyOwner
    {
        (, , , , , , , bool roundInProgress) = vault.vaultState();
        require(!roundInProgress, "cannot change strategy if round is active");
        strategyDetail = _deltaStrategy;
    }

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
     * @return premiumPayed
     * @return capitalUsed this value will always be 0 for long strategy
     */
    function doTrade(uint256 strikeId, address lyraRewardRecipient)
        external
        onlyVault
        returns (
            uint256 positionId,
            uint256 premiumPayed,
            uint256 capitalUsed
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

        // max premium willing to pay
        uint256 maxPremium = _getPremiumLimit(
            strike,
            strategyDetail.maxVol,
            strategyDetail.size
        );

        require(
            collateralAsset.transferFrom(
                address(vault),
                address(this),
                maxPremium
            ),
            "collateral transfer from vault failed"
        );

        (positionId, premiumPayed) = _buyStrike(
            strike,
            maxPremium,
            lyraRewardRecipient
        );
        capitalUsed = premiumPayed;
    }

    /**
     * @dev this function will not be used for long strategy
     */
    function reducePosition(
        uint256,
        uint256,
        address
    ) external pure {
        revert("not supported");
    }

    /**
     * @dev perform the trade
     * @param strike strike detail
     * @param maxPremium max premium willing to spend for this trade
     * @param lyraRewardRecipient address to receive lyra trading reward
     * @return positionId
     * @return premiumReceived
     */
    function _buyStrike(
        Strike memory strike,
        uint256 maxPremium,
        address lyraRewardRecipient
    ) internal returns (uint256, uint256) {
        // perform trade to long
        TradeResult memory result = openPosition(
            TradeInputParameters({
                strikeId: strike.id,
                positionId: strikeToPositionId[strike.id],
                iterations: 1,
                optionType: optionType,
                amount: strategyDetail.size,
                setCollateralTo: 0,
                minTotalCost: 0,
                maxTotalCost: maxPremium,
                rewardRecipient: lyraRewardRecipient // set to zero address if don't want to wait for whitelist
            })
        );
        _setLastTradedAt(strike.id, block.timestamp);

        // update active strikes
        _addActiveStrike(strike.id, result.positionId);

        require(result.totalCost <= maxPremium, "premium too high");

        return (result.positionId, result.totalCost);
    }

    /**
     * @dev verify if the strike is valid for the strategy
     * @return isValid true if vol is withint [minVol, maxVol] and delta is within targetDelta +- maxDeltaGap
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
