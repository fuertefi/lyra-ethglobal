//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {OptionMarket} from "@lyrafinance/protocol/contracts/OptionMarket.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockOptionMarket {
    address public collateralToken;
    address public premiumToken;
    uint256 public premium;
    uint256 public collateral;
    uint256 public settlementPayout;

    function setMockPremium(address _token, uint256 _premium) external {
        premiumToken = _token;
        premium = _premium;
    }

    function setMockCollateral(address _token, uint256 _collateralAmount)
        external
    {
        collateralToken = _token;
        collateral = _collateralAmount;
    }

    function setMockSettlement(uint256 _collateral) external {
        settlementPayout = _collateral;
    }

    function openPosition(
        uint256, /*_listingId*/
        OptionMarket.OptionType, /*tradeType*/
        uint256 /*amount*/
    ) external returns (uint256 totalCost) {
        IERC20(collateralToken).transferFrom(
            msg.sender,
            address(this),
            collateral
        );

        IERC20(premiumToken).transfer(msg.sender, premium);
        // todo: mint mocked certificate?
        return premium;
    }

    function settleOptions(
        uint256, /*listingId*/
        OptionMarket.OptionType /*tradeType*/
    ) external {
        IERC20(collateralToken).transfer(msg.sender, settlementPayout);
    }
}
