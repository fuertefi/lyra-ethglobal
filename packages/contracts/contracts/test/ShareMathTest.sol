// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ShareMath} from "../libraries/ShareMath.sol";
import {Vault} from "../libraries/Vault.sol";

/**
 * This is a tester contract where we expose all internal functions from ShareMath to external functions.
 * Just so we can easily test them.
 */
contract ShareMathTest {
    function assetToShares(
        uint256 assetAmount,
        uint256 assetPerShare,
        uint256 decimals
    ) external pure returns (uint256) {
        return ShareMath.assetToShares(assetAmount, assetPerShare, decimals);
    }

    function sharesToAsset(
        uint256 shares,
        uint256 assetPerShare,
        uint256 decimals
    ) external pure returns (uint256) {
        return ShareMath.sharesToAsset(shares, assetPerShare, decimals);
    }

    /**
     * @notice Returns the shares unredeemed by the user given their DepositReceipt
     * @param depositReceipt is the user's deposit receipt
     * @param currentRound is the `round` stored on the vault
     * @param assetPerShare is the price in asset per share
     * @param decimals is the number of decimals the asset/shares use
     * @return unredeemedShares is the user's virtual balance of shares that are owed
     */
    function getSharesFromReceipt(
        Vault.DepositReceipt memory depositReceipt,
        uint256 currentRound,
        uint256 assetPerShare,
        uint256 decimals
    ) external pure returns (uint256 unredeemedShares) {
        return
            ShareMath.getSharesFromReceipt(
                depositReceipt,
                currentRound,
                assetPerShare,
                decimals
            );
    }

    function pricePerShare(
        uint256 totalSupply,
        uint256 totalBalance,
        uint256 pendingAmount,
        uint256 decimals
    ) external pure returns (uint256) {
        return
            ShareMath.pricePerShare(
                totalSupply,
                totalBalance,
                pendingAmount,
                decimals
            );
    }

    function assertUint104(uint256 num) external pure {
        return ShareMath.assertUint104(num);
    }

    function assertUint128(uint256 num) external pure {
        return ShareMath.assertUint128(num);
    }
}
