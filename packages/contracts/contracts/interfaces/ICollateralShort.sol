//SPDX-License-Identifier: ISC
pragma solidity ^0.8.9;

interface ICollateralShort {
    struct Loan {
        // ID for the loan
        uint256 id;
        //  Account that created the loan
        address account;
        //  Amount of collateral deposited
        uint256 collateral;
        // The synth that was borrowed
        bytes32 currency;
        //  Amount of synths borrowed
        uint256 amount;
        // Indicates if the position was short sold
        bool short;
        // interest amounts accrued
        uint256 accruedInterest;
        // last interest index
        uint256 interestIndex;
        // time of last interaction.
        uint256 lastInteraction;
    }

    function loans(uint256 id)
        external
        returns (
            uint256,
            address,
            uint256,
            bytes32,
            uint256,
            bool,
            uint256,
            uint256,
            uint256
        );

    function minCratio() external returns (uint256);

    function minCollateral() external returns (uint256);

    function issueFeeRate() external returns (uint256);

    function open(
        uint256 collateral,
        uint256 amount,
        bytes32 currency
    ) external returns (uint256 id);

    function repay(
        address borrower,
        uint256 id,
        uint256 amount
    ) external returns (uint256 short, uint256 collateral);

    function repayWithCollateral(uint256 id, uint256 repayAmount)
        external
        returns (uint256 short, uint256 collateral);

    function draw(uint256 id, uint256 amount)
        external
        returns (uint256 short, uint256 collateral);

    // Same as before
    function deposit(
        address borrower,
        uint256 id,
        uint256 amount
    ) external returns (uint256 short, uint256 collateral);

    // Same as before
    function withdraw(uint256 id, uint256 amount)
        external
        returns (uint256 short, uint256 collateral);

    // function to return the loan details in one call, without needing to know about the collateralstate
    function getShortAndCollateral(address account, uint256 id)
        external
        view
        returns (uint256 short, uint256 collateral);
}
