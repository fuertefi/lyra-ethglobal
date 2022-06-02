//SPDX-License-Identifier:MIT
pragma solidity ^0.8.9;

interface IHackMoneyStrategy {
    function setBoard(uint256 boardId) external;

    function doTrade(uint256 size)
        external
        returns (
            uint256 positionId1,
            uint256 positionId2,
            uint256 premium,
            uint256 collateralAdded,
            uint256 premiumExchangeValue
        );

    function returnFundsAndClearStrikes() external;
}
