//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

// Hardhat
import "hardhat/console.sol";

// Lyra
import {VaultAdapter} from "@lyrafinance/protocol/contracts/periphery/VaultAdapter.sol";
import {GWAVOracle} from "@lyrafinance/protocol/contracts/periphery/GWAVOracle.sol";

// Libraries
import {Vault} from "../libraries/Vault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {HackMoneyVault} from "../core/HackMoneyVault.sol";
import {DecimalMath} from "@lyrafinance/protocol/contracts/synthetix/DecimalMath.sol";
import {SignedDecimalMath} from "@lyrafinance/protocol/contracts/synthetix/SignedDecimalMath.sol";

contract HackMoneyStrategyBase is VaultAdapter {
    using DecimalMath for uint256;
    using SignedDecimalMath for int256;

    HackMoneyVault public immutable vault;
    OptionType public immutable optionType;
    GWAVOracle public immutable gwavOracle;

    /// @dev asset used as collateral in AMM to sell. Should be the same as vault asset
    IERC20 public collateralAsset;

    mapping(uint256 => uint256) public lastTradeTimestamp;

    uint256[] public activeStrikeIds;
    mapping(uint256 => uint256) public strikeToPositionId;

    ///////////
    // ADMIN //
    ///////////

    modifier onlyVault() virtual {
        require(msg.sender == address(vault), "only Vault");
        _;
    }

    constructor(
        HackMoneyVault _vault,
        OptionType _optionType,
        GWAVOracle _gwavOracle
    ) VaultAdapter() {
        vault = _vault;
        optionType = _optionType;
        gwavOracle = _gwavOracle;
    }

    function initAdapter(
        address _curveSwap,
        address _optionToken,
        address _optionMarket,
        address _liquidityPool,
        address _shortCollateral,
        address _synthetixAdapter,
        address _optionPricer,
        address _greekCache,
        address _quoteAsset,
        address _baseAsset,
        address _feeCounter
    ) external onlyOwner {
        // set addressese for LyraVaultAdapter
        setLyraAddresses(
            _curveSwap,
            _optionToken,
            _optionMarket,
            _liquidityPool,
            _shortCollateral,
            _synthetixAdapter,
            _optionPricer,
            _greekCache,
            _quoteAsset,
            _baseAsset,
            _feeCounter
        );

        quoteAsset.approve(address(vault), type(uint256).max);
        baseAsset.approve(address(vault), type(uint256).max);
        collateralAsset = _isBaseCollat() ? baseAsset : quoteAsset;
    }

    ///////////////////
    // VAULT ACTIONS //
    ///////////////////

    /**
     * @dev exchange asset back to collateral asset and send it back to the vault
     * @dev override this function if you want to customize asset management flow
     */
    function _returnFundsToVaut() internal virtual {
        ExchangeRateParams memory exchangeParams = getExchangeParams();
        uint256 quoteBal = quoteAsset.balanceOf(address(this));

        if (_isBaseCollat()) {
            // exchange quote asset to base asset, and send base asset back to vault
            uint256 baseBal = baseAsset.balanceOf(address(this));
            uint256 minQuoteExpected = quoteBal
                .divideDecimal(exchangeParams.spotPrice)
                .multiplyDecimal(
                    DecimalMath.UNIT - exchangeParams.baseQuoteFeeRate
                );
            uint256 baseReceived = exchangeFromExactQuote(
                quoteBal,
                minQuoteExpected
            );
            require(
                baseAsset.transfer(address(vault), baseBal + baseReceived),
                "failed to return funds from strategy"
            );
        } else {
            // send quote balance directly
            require(
                quoteAsset.transfer(address(vault), quoteBal),
                "failed to return funds from strategy"
            );
        }
    }

    /////////////////////////////
    // Trade Parameter Helpers //
    /////////////////////////////

    /**
     * @dev get minimum premium that the vault should receive.
     * param listingId lyra option listing id
     * param size size of trade in Lyra standard sizes
     */
    function _getPremiumLimit(
        Strike memory strike,
        uint256 vol,
        uint256 size
    ) internal view returns (uint256 limitPremium) {
        ExchangeRateParams memory exchangeParams = getExchangeParams();
        (uint256 callPremium, uint256 putPremium) = getPurePremium(
            _getSecondsToExpiry(strike.expiry),
            vol,
            exchangeParams.spotPrice,
            strike.strikePrice
        );

        limitPremium = _isCall()
            ? callPremium.multiplyDecimal(size)
            : putPremium.multiplyDecimal(size);
    }

    /**
     * @dev use latest optionMarket delta cutoff to determine whether trade delta is out of bounds
     */
    function _isOutsideDeltaCutoff(uint256 strikeId)
        internal
        view
        returns (bool)
    {
        MarketParams memory marketParams = getMarketParams();
        int256 callDelta = getDeltas(_toDynamic(strikeId))[0];
        return
            callDelta > (int256(DecimalMath.UNIT) - marketParams.deltaCutOff) ||
            callDelta < marketParams.deltaCutOff;
    }

    //////////////////////////////
    // Active Strike Management //
    //////////////////////////////

    /**
     * @dev add strike id to activeStrikeIds array
     */
    function _addActiveStrike(uint256 strikeId, uint256 tradedPositionId)
        internal
    {
        if (!_isActiveStrike(strikeId)) {
            strikeToPositionId[strikeId] = tradedPositionId;
            activeStrikeIds.push(strikeId);
        }
    }

    /**
     * @dev add the last traded timestamp for a specific strike.
     */
    function _setLastTradedAt(uint256 strikeId, uint256 timestamp) internal {
        lastTradeTimestamp[strikeId] = timestamp;
    }

    /**
     * @dev remove position data opened in the current round.
     * this can only be called after the position is settled by lyra
     **/
    function _clearAllActiveStrikes() internal {
        if (activeStrikeIds.length != 0) {
            for (uint256 i = 0; i < activeStrikeIds.length; i++) {
                uint256 strikeId = activeStrikeIds[i];
                OptionPosition memory position = getPositions(
                    _toDynamic(strikeToPositionId[strikeId])
                )[0];
                // revert if position state is not settled
                require(
                    position.state != PositionState.ACTIVE,
                    "cannot clear active position"
                );
                delete strikeToPositionId[strikeId];
                delete lastTradeTimestamp[i];
            }
            delete activeStrikeIds;
        }
    }

    function _isActiveStrike(uint256 strikeId)
        internal
        view
        returns (bool isActive)
    {
        isActive = strikeToPositionId[strikeId] != 0;
    }

    //////////
    // Misc //
    //////////

    function _isBaseCollat() internal view returns (bool isBase) {
        isBase = (optionType == OptionType.SHORT_CALL_BASE) ? true : false;
    }

    function _isCall() internal view returns (bool isCall) {
        isCall = (optionType == OptionType.SHORT_PUT_QUOTE ||
            optionType == OptionType.LONG_PUT)
            ? false
            : true;
    }

    function _getSecondsToExpiry(uint256 expiry)
        internal
        view
        returns (uint256)
    {
        require(block.timestamp <= expiry, "timestamp expired");
        return expiry - block.timestamp;
    }

    function _abs(int256 val) internal pure returns (uint256) {
        return val >= 0 ? uint256(val) : uint256(-val);
    }

    function _min(uint256 x, uint256 y) internal pure returns (uint256) {
        return (x < y) ? x : y;
    }

    function _max(uint256 x, uint256 y) internal pure returns (uint256) {
        return (x > y) ? x : y;
    }

    // temporary fix - eth core devs promised Q2 2022 fix
    function _toDynamic(uint256 val)
        internal
        pure
        returns (uint256[] memory dynamicArray)
    {
        dynamicArray = new uint256[](1);
        dynamicArray[0] = val;
    }
}
