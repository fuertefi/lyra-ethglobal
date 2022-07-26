// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev This is an auxiliary contract meant to be assigned as the admin of a {TransparentUpgradeableProxy}. For an
 * explanation of why you would want to use this see the documentation for {TransparentUpgradeableProxy}.
 */
contract ProxyAdmin is Ownable {
    address public implementation;
    bool public initialized;

    constructor(address _implementation) {
        implementation = _implementation;
    }

    function isInitialized() public returns (bool) {
        if (initialized) {
            initialized = true;
            return false;
        } else {
            return true;
        }
    }

    /**
     * @dev Upgrades `proxy` to `implementation`. See {TransparentUpgradeableProxy-upgradeTo}.
     *
     * Requirements:
     *
     * - This contract must be the admin of `proxy`.
     */
    function upgradeTo(address newImplementation) public virtual onlyOwner {
        implementation = newImplementation;
    }

    /**
     * @dev Upgrades `proxy` to `implementation` and calls a function on the new implementation.
     */
    function upgradeToAndCall(address newImplementation, bytes memory data)
        public
        payable
        onlyOwner
    {
        implementation = newImplementation;
        (bool success, bytes memory resultData) = implementation.call{
            value: msg.value
        }(data);
        if (!success) {
            _revertWithData(resultData);
        }

        _returnWithData(resultData);
    }

    function _revertWithData(bytes memory data) private pure {
        assembly {
            revert(add(data, 32), mload(data))
        }
    }

    function _returnWithData(bytes memory data) private pure {
        assembly {
            return(add(data, 32), mload(data))
        }
    }
}
