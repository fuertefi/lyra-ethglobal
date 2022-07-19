//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
// Hardhat
import "hardhat/console.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CSBaseVault} from "./CSBaseVault.sol";
import {Vault} from "../libraries/Vault.sol";

import {ICSStrategy} from "../interfaces/ICSStrategy.sol";

/// @notice LyraVault help users run option-selling strategies on Lyra AMM.
contract CSVault is CSBaseVault {
    IERC20 public premiumAsset;
    IERC20 public collateralAsset;

    uint public roundDelay;

    ICSStrategy public strategy;
    address public lyraRewardRecipient;

    // Amount locked for scheduled withdrawals last week;
    uint public lastQueuedWithdrawAmount;

    event StrategyUpdated(address strategy);

    event Trade(
        address user,
        uint positionId_1,
        uint positionId_2,
        uint premium,
        uint capitalUsed,
        uint premiumExchangeValue
    );

    event RoundStarted(uint16 roundId, uint104 lockAmount);

    event RoundClosed(uint16 roundId, uint104 lockAmount);

    // TODO: Add docs
    constructor(
        address _susd,
        address _feeRecipient,
        uint _roundDuration,
        string memory _tokenName,
        string memory _tokenSymbol,
        Vault.VaultParams memory _vaultParams
    )
        CSBaseVault(
            _feeRecipient,
            _roundDuration,
            _tokenName,
            _tokenSymbol,
            _vaultParams
        )
    {
        premiumAsset = IERC20(_susd);
        collateralAsset = IERC20(_vaultParams.asset);
        roundDelay = 6 hours;
    }

    /// @dev set strategy contract. This function can only be called by owner.
    /// @param _strategy new strategy contract address
    function setStrategy(address _strategy) external onlyOwner {
        if (address(strategy) != address(0)) {
            collateralAsset.approve(address(strategy), 0);
        }

        strategy = ICSStrategy(_strategy);
        collateralAsset.approve(_strategy, type(uint).max);
        emit StrategyUpdated(_strategy);
    }

    /// @dev anyone can trigger a trade
    // TODO: Add docs
    // Should we specify full size and divide it in halfs in the strategy?
    function trade(uint totalTradesSize) public {
        require(vaultState.roundInProgress, "round closed");
        // perform trades through strategy
        uint tradeSize = totalTradesSize / 2;
        (
            uint positionId_1,
            uint positionId_2,
            uint premiumReceived,
            uint premiumExchangeValue
        ) = strategy.doTrade(tradeSize);

        vaultState.lockedAmountLeft =
            vaultState.lockedAmountLeft -
            2 *
            tradeSize;

        // todo: udpate events
        emit Trade(
            msg.sender,
            positionId_1,
            positionId_2,
            premiumReceived,
            2 * tradeSize,
            premiumExchangeValue
        );
    }

    /// @dev close the current round, enable user to deposit for the next round
    function closeRound() external {
        require(
            strategy.activeExpiry() < block.timestamp,
            "cannot close round if board not expired"
        );
        require(vaultState.roundInProgress, "round closed");

        uint104 lockAmount = vaultState.lockedAmount;
        vaultState.lastLockedAmount = lockAmount;
        vaultState.lockedAmountLeft = 0;
        vaultState.lockedAmount = 0;
        vaultState.nextRoundReadyTimestamp = block.timestamp + roundDelay;
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

        (uint lockedBalance, uint queuedWithdrawAmount) = _rollToNextRound(
            uint(lastQueuedWithdrawAmount)
        );

        vaultState.lockedAmount = uint104(lockedBalance);
        vaultState.lockedAmountLeft = lockedBalance;
        vaultState.roundInProgress = true;
        lastQueuedWithdrawAmount = queuedWithdrawAmount;
        emit RoundStarted(vaultState.round, uint104(lockedBalance));

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

    // helper to set AmountLeft
    function getLockedAmountLeft() public view returns (uint lockedAmountLeft) {
        lockedAmountLeft = uint(vaultState.lockedAmountLeft);
    }

    // helper set round delay
    function setRoundDelay(uint newRoundDelay) external onlyOwner {
        roundDelay = newRoundDelay;
    }
}
