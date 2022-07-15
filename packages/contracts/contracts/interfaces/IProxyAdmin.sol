//SPDX-License-Identifier:MIT
pragma solidity ^0.8.9;

interface IProxyAdmin {
    function implementation() external returns (address);

    function initialized() external returns (bool);

    function upgradeTo(address newImplementation) external;

    function upgradeToAndCall(address newImplementation, bytes memory data)
        external;

    function returnFundsAndClearStrikes() external;
}
