//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./HackMoneyStrategyImplementation.sol";
import {HackMoneyVault} from "../core/HackMoneyVault.sol";
import {Vault} from "../libraries/Vault.sol";

contract StrategyUpgradeTest is HackMoneyStrategy {
    constructor(HackMoneyVault _vault, OptionType _optionType)
        HackMoneyStrategy(_vault, _optionType)
    {}

    function test() public view returns (uint256) {
        return 111111;
    }
}
