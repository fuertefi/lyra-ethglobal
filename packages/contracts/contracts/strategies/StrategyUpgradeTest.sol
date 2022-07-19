//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./CSStrategy.sol";
import {CSVault} from "../core/CSVault.sol";
import {Vault} from "../libraries/Vault.sol";

contract StrategyUpgradeTest is CSStrategy {
    constructor(CSVault _vault)
        CSStrategy(_vault)
    {}

    function test() public view returns (uint256) {
        return 111111;
    }
}
