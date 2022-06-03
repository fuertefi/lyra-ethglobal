//SPDX-License-Identifier:MIT
pragma solidity ^0.8.9;

interface IStrategyFuerte {
    function setBoard(uint256 callBoardId, uint256 putBoardId) external;

    function doTrade(
        uint256 callStrikeId,
        uint256 putStrikeId,
        address lyraRewardRecipient
    )
        external
        returns (
            uint256 callPositionId,
            uint256 putPositionId,
            uint256 premiumReceived,
            uint256 callCollateral,
            uint256 putCollateral
        );

    function reducePosition(
        uint256 positionId,
        uint256 closeAmount,
        address rewardRecipient
    ) external;

    function returnFundsAndClearStrikes() external;
}
