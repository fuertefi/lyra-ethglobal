//SPDX-License-Identifier:MIT
pragma solidity ^0.8.9;

interface IStrategy {
    function setBoard(uint256 boardId) external;

    function doTrade(uint256 strikeId, address rewardRecipient)
        external
        returns (
            uint256 positionId,
            uint256 premium,
            uint256 collateralAdded
        );

    function reducePosition(
        uint256 positionId,
        uint256 closeAmount,
        address rewardRecipient
    ) external;

    function returnFundsAndClearStrikes() external;
}
