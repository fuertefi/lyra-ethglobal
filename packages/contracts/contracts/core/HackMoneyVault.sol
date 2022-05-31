//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
// Hardhat
import "hardhat/console.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";

import {BaseVault} from "./BaseVault.sol";
import {Vault} from "../libraries/Vault.sol";

import {IHackMoneyStrategy} from "../interfaces/IHackMoneyStrategy.sol";

/// @notice LyraVault help users run option-selling strategies on Lyra AMM.
contract HackMoneyVault is Multicall, Ownable, BaseVault {
    IERC20 public immutable premiumAsset;
    IERC20 public immutable collateralAsset;

    IHackMoneyStrategy public strategy;
    address public lyraRewardRecipient;

    // Amount locked for scheduled withdrawals last week;
    uint128 public lastQueuedWithdrawAmount;
    // % of funds to be used for weekly option purchase
    // TODO: Do we need this?
    uint public optionAllocation;

    event StrategyUpdated(address strategy);

    event Trade(
        address user,
        uint positionId_1,
        uint positionId_2,
        uint premium,
        uint capitalUsed
        // uint exchangeValue
    );

    event RoundStarted(uint16 roundId, uint104 lockAmount);

    event RoundClosed(uint16 roundId, uint104 lockAmount);

    constructor(
        address _susd,
        address _feeRecipient,
        uint _roundDuration,
        string memory _tokenName,
        string memory _tokenSymbol,
        Vault.VaultParams memory _vaultParams
    )
        BaseVault(
            _feeRecipient,
            _roundDuration,
            _tokenName,
            _tokenSymbol,
            _vaultParams
        )
    {
        premiumAsset = IERC20(_susd);
        collateralAsset = IERC20(_vaultParams.asset);
    }

    /// @dev set strategy contract. This function can only be called by owner.
    /// @param _strategy new strategy contract address
    function setStrategy(address _strategy) external onlyOwner {
        if (address(strategy) != address(0)) {
            collateralAsset.approve(address(strategy), 0);
        }

        strategy = IHackMoneyStrategy(_strategy);
        collateralAsset.approve(_strategy, type(uint).max);
        emit StrategyUpdated(_strategy);
    }

    /// @dev anyone can trigger a trade
    function trade(uint size) public {
        require(vaultState.roundInProgress, "round closed");
        // perform trades through strategy
        (
            uint positionId_1,
            uint positionId_2,
            uint premiumReceived,
            uint capitalUsed
            // uint exchangeValue
        ) = strategy.doTrade(size);
        // update the remaining locked amount
        // TODO: This might be fucked up as capitalUsed now returns total sum with premiums exchanged. I still need to have amount we have been able to get from exchange as I need to display this in the UI
        vaultState.lockedAmountLeft = vaultState.lockedAmountLeft - capitalUsed;

        // todo: udpate events
        emit Trade(
            msg.sender,
            positionId_1,
            positionId_2,
            premiumReceived,
            capitalUsed
            // exchangeValue
        );
    }

    /// @dev anyone close part of the position with premium made by the strategy if a position is dangerous
    /// @param positionId the positiion to close
    // TODO: We don't need this
    function reducePosition(uint positionId, uint closeAmount) external {
        strategy.reducePosition(positionId, closeAmount, lyraRewardRecipient);
    }

    /// @dev close the current round, enable user to deposit for the next round
    function closeRound() external {
        uint104 lockAmount = vaultState.lockedAmount;
        vaultState.lastLockedAmount = lockAmount;
        vaultState.lockedAmountLeft = 0;
        vaultState.lockedAmount = 0;
        vaultState.nextRoundReadyTimestamp =
            block.timestamp +
            Vault.ROUND_DELAY;
        vaultState.roundInProgress = false;

        // won't be able to close if positions are not settled
        strategy.returnFundsAndClearStrikes();

        emit RoundClosed(vaultState.round, lockAmount);
    }

    /// @notice start the next round
    /// @param boardId board id (asset + expiry) for next round.
    function startNextRound(uint boardId) external onlyOwner {
        require(!vaultState.roundInProgress, "round opened");
        require(block.timestamp > vaultState.nextRoundReadyTimestamp, "CD");

        strategy.setBoard(boardId);

        // FIXME: Do we have tests for this?
        (uint lockedBalance, uint queuedWithdrawAmount) = _rollToNextRound(
            uint(lastQueuedWithdrawAmount)
        );

        vaultState.lockedAmount = uint104(lockedBalance);
        vaultState.lockedAmountLeft = lockedBalance;
        vaultState.roundInProgress = true;
        lastQueuedWithdrawAmount = uint128(queuedWithdrawAmount);
        emit RoundStarted(vaultState.round, uint104(lockedBalance));

        // TODO: should we use lockedAmount?
        require(
            collateralAsset.transfer(address(strategy), lockedBalance),
            "collateralAsset transfer failed"
        );
    }

    /// @notice set set new address to receive Lyra trading reward on behalf of the vault
    /// @param recipient recipient address
    function setLyraRewardRecipient(address recipient) external onlyOwner {
        lyraRewardRecipient = recipient;
    }

    // helper to set strategy size
    // TODO: Do we need this?
    function getLockedAmountLeft() public view returns (uint lockedAmountLeft) {
        lockedAmountLeft = uint(vaultState.lockedAmountLeft);
    }
}
