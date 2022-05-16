//SPDX-License-Identifier:MIT
pragma solidity ^0.8.9;

interface IHackMoneyStrategy {
  function setBoard(uint boardId) external;

  function doTrade(
    uint strikeId1,
    uint strikeId2,
    address rewardRecipient
  )
    external
    returns (
      uint positionId1,
      uint positionId2,
      uint premium,
      uint collateralAdded
    );

  function reducePosition(
    uint positionId,
    uint closeAmount,
    address rewardRecipient
  ) external;

  function returnFundsAndClearStrikes() external;
}
