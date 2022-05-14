//SPDX-License-Identifier:MIT
pragma solidity ^0.8.9;

interface IStrategyFuerte {
  function setBoard(uint callBoardId, uint putBoardId) external;

  function doTrade(
    uint callStrikeId,
    uint putStrikeId,
    address lyraRewardRecipient
  )
    external
    returns (
      uint callPositionId,
      uint putPositionId,
      uint premiumReceived,
      uint callCollateral,
      uint putCollateral
    );

  function reducePosition(
    uint positionId,
    uint closeAmount,
    address rewardRecipient
  ) external;

  function returnFundsAndClearStrikes() external;
}
