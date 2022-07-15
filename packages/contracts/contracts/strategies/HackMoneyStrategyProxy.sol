// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

// Hardhat
import "hardhat/console.sol";

// standard strategy interface
import "../interfaces/IHackMoneyStrategy.sol";
import "../interfaces/IProxyAdmin.sol";
import {HackMoneyVault} from "../core/HackMoneyVault.sol";
import {HackMoneyStrategyBase} from "./HackMoneyStrategyBase.sol";

contract HackMoneyStrategyProxy is HackMoneyStrategyBase {
    // ADD SAME IMPLEMENTATION LAYOUT
    // ADD IMPLEMENTATION SLOT

    struct HackMoneyStrategyDetail {
        uint256 minTimeToExpiry;
        uint256 maxTimeToExpiry;
        int256 mintargetDelta; // 15%
        int256 maxtargetDelta; // 85%
        uint256 maxDeltaGap; // 5%
        uint256 minVol; // 80%
        uint256 size; // 15
    }

    HackMoneyStrategyDetail public strategyDetail;
    uint256 public activeExpiry;
    uint256 public currentBoardId;
    uint256 public ivLimit = 2 * 1e18;
    address public lyraRewardRecipient;

    address constant proxyAdmin = address(0); // SET ADDRESS HERE

    modifier isNotInitialized() {
        bool isInitialized = IProxyAdmin(proxyAdmin).initialized();
        require(!isInitialized);
        _;
    }
    modifier onlyVault() override {
        require(msg.sender == address(vault), "only Vault");
        _;
    }

    constructor(HackMoneyVault _vault, OptionType _optionType)
        HackMoneyStrategyBase(_vault, _optionType)
    {}

    function initialize() public onlyOwner isNotInitialized {
        // do stuff
    }

    function getImplementation() public returns (address) {
        return IProxyAdmin(proxyAdmin).implementation();
    }

    /**
     * @dev convert premium in quote asset into collateral asset and send it back to the vault.
     */
    function returnFundsAndClearStrikes() external onlyVault {
        // exchange asset back to collateral asset and send it back to the vault
        _returnFundsToVault();

        // keep internal storage data on old strikes and positions ids
        _clearAllActiveStrikes();
    }

    function _disableInitializers() internal override {}

    receive() external payable {}

    fallback() external payable {
        //Figure out the router contract for the given function
        address implementation = getImplementation();
        if (implementation == address(0)) {
            _revertWithData(
                abi.encodeWithSelector(
                    bytes4(keccak256("NotImplementedError(bytes4)")),
                    msg.sig
                )
            );
        }

        //Delegate call to the router
        (bool success, bytes memory resultData) = implementation.delegatecall(
            msg.data
        );
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
