// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {ISynthetix} from "../interfaces/ISynthetix.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockSynthetix is ISynthetix {
    mapping(bytes32 => address) private addressMap;

    mapping(address => uint256) private mockedTradeAmount;

    constructor() {
        // really
    }

    function setMockedKeyToAddress(bytes32 _key, address _address) external {
        addressMap[_key] = _address;
    }

    function setMockedTradeAmount(address _outToken, uint256 _outAmount)
        external
    {
        mockedTradeAmount[_outToken] = _outAmount;
    }

    function exchange(
        bytes32 sourceCurrencyKey,
        uint256 sourceAmount,
        bytes32 destinationCurrencyKey
    ) external override returns (uint256 amountReceived) {
        // pull source currency
        IERC20(addressMap[sourceCurrencyKey]).transferFrom(
            msg.sender,
            address(this),
            sourceAmount
        );

        // pay destination currency
        address destinationCurrency = addressMap[destinationCurrencyKey];
        amountReceived = mockedTradeAmount[destinationCurrency];
        IERC20(destinationCurrency).transfer(msg.sender, amountReceived);
    }

    function exchangeOnBehalf(
        address exchangeForAddress,
        bytes32 sourceCurrencyKey,
        uint256 sourceAmount,
        bytes32 destinationCurrencyKey
    ) external override returns (uint256 amountReceived) {
        // pull source currency
        IERC20(addressMap[sourceCurrencyKey]).transferFrom(
            exchangeForAddress,
            address(this),
            sourceAmount
        );

        // pay destination currency
        address destinationCurrency = addressMap[destinationCurrencyKey];
        amountReceived = mockedTradeAmount[destinationCurrency];
        IERC20(destinationCurrency).transfer(
            exchangeForAddress,
            amountReceived
        );
    }
}
