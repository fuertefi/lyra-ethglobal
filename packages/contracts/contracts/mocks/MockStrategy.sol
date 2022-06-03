//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IStrategy} from "../interfaces/IStrategy.sol";
import {IERC20Detailed} from "../interfaces/IERC20Detailed.sol";

contract MockStrategy is IStrategy {
    IERC20Detailed public immutable collateral;
    IERC20Detailed public immutable premium;

    uint256 public tradePremiumAmount;
    uint256 public tradeCollateralAmount;

    bool public isSettlted;

    uint256 public boardId;

    constructor(IERC20Detailed _premiumToken, IERC20Detailed _collateralToken) {
        collateral = _collateralToken;
        premium = _premiumToken;
    }

    function setBoard(uint256 _boardId) external {
        boardId = _boardId;
    }

    function setMockedTradeAmount(uint256 _premium, uint256 _collateral)
        public
    {
        tradePremiumAmount = _premium;
        tradeCollateralAmount = _collateral;
    }

    function doTrade(uint256, address)
        external
        returns (
            uint256 positionId,
            uint256 premiumReceived,
            uint256 collateralAdded
        )
    {
        // get collateral from caller
        collateral.transferFrom(
            msg.sender,
            address(this),
            tradeCollateralAmount
        );
        return (0, premiumReceived, tradeCollateralAmount);
    }

    function reducePosition(
        uint256,
        uint256,
        address
    ) external {}

    function setMockIsSettled(bool _isSettled) public {
        isSettlted = _isSettled;
    }

    function returnFundsAndClearStrikes() external {
        // return collateral and premium to msg.sender
        uint256 colBalance = collateral.balanceOf(address(this));
        collateral.transfer(msg.sender, colBalance);

        uint256 premiumBalance = premium.balanceOf(address(this));
        premium.transfer(msg.sender, premiumBalance);
    }
}
