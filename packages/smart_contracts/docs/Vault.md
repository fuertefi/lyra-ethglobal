# Vault Description

## Vault asset and shares

Vault manage an `asset`, the `asset` is constant. <br/>
Vault issue `shares` for depositors, the value of 1 share varies with the PnL of the strategy managed by the vault.

## Vault state

For each round the vault can be either in state:

- idle.
- round in progress.

### Vault state transition

- current round = n: `in progress`.
- closeRound() is called => current round = n: `idle`.
- Owner call startNextRound() => current round = n+1: `in progress`.

## Vault strategy

A vault is associated with a `strategy` contract. The `strategy` contract trade the `asset` according to a specified strategy code.

## Vault DepositReceipt struct

The DepositReceipt is a struct containing the following informations:

- round: last round the deposit receipt was updated.
- amount: the amount of `asset` deposited for that round.
- unredeemedShares: the amount of shares that are yet to be redeemed.

Each vault user have a deposit receipt, this deposit receipt helps manage the vault accounting.

## Vault Withdrawal struct

The Withdrawal is a struct containing the following informations:

- round: last round the withdrawal struct was updated.
- shares: the amount of `shares` withdrawn for that round.

Each vault user have a withdrawal struct, this helps manage the vault accounting.

## Vault user actions

The different actions a user can do:

- deposit(): deposit amount of `asset`.
- depositFor(): deposit amount of `asset` for the `creditor` address.
- withdrawInstantly(): withdraw amount of `asset` from a previous deposit, equivalent to cancelling a deposit before it is processed.
- initiateWithdraw(): initiate the withdrawal of an amount of `shares`.
- completeWithdraw(): complete an initiated withdrawal or withdrawals of `shares`.
- redeem(): redeem an amount of `shares` to the user that made a previous deposit of `asset`.
- maxRedeem(): redeem the maximum amonut of `shares` to the user.

### deposit(uint amount)

Deposit amount of `asset`, and the user deposit struct is updated:

- Update round, amount and unredeemedShares in deposit receipt struct.
- Transfer amount from user to vault.

### depositFor(uint amount, address creditor)

Deposit amount of `asset` for the creditor and perform update similar to deposit().

### withdrawInstantly(uint amount)

Can only be called if the user made a deposit or someone made a deposit on his behalf in the current round. substract the amount from the deposit receipt and sent amount of `asset` back to the user.

### initiateWithdraw(uint numShares)

Initiate the withdrawal of an amount of `shares`, basically it tells the vault to reserve certain amount of `asset` corresponding to the numShares of `shares` for the user:

- Updates withdrawal struct of the user.
- Updates the queued withdrawals amount, adding `numShares`.
- Transfer amount of `shares` from user to vault.

### completeWithdraw()

Completes an initiated withdrawal of the user, to complete a withdrawal the current round must be greater than the round recorded in the withdrawal struct:

- Updates the withdrawal struct of the user.
- Burn the number of share to be withdrawn.
- Transfer the `asset` value of these `shares` to the user.

### redeem(uint numShares)

Redeems numShares of `shares` that are owed to the user:

- Updates deposit receipt of the user.
- Transfer numShares of `shares` to the user.

### maxRedeem()

Redeem maximum amount of `shares` owed to the user.

## Example: Vault asset = SUSD

### Current Round = 1

### Deposits

- Alice deposit 1500SUSD.
- Bob deposit 1250SUSD.

#### States:

- Alice DepositReceipt: round = 1, amount = 1500, unredeemedShares = 0.
- Bob DepositReceipt: round = 1, amount = 1250, unredeemedShares = 0.
- totalPending: 2500

### Instant Withdrawals

- Alice instantWithdraw 500SUSD.
- Bob instantWithdraw 250SUSD.

#### States:

- Alice DepositReceipt: round = 1, amount = 1000, unredeemedShares = 0.
- Bob DepositReceipt: round = 1, amount = 1000, unredeemedShares = 0.
- totalPending: 2000.

### Current Round = 2 : Owner Start new round

2000 shares minted at 1:1 ratio. And we record roundPricePerShare = 1e18 (1 scaled by 1e18)

#### State updates:

- roundPricePerShare[1] = 1e18
- balanceOf(vault) = 2000

### redeems

- Alice do a maxRedeem she gets her 1000 shares.
- Bob do a maxRedeem she gets her 1000 shares.

#### State updates:

- Alice DepositReceipt: round = 1, amount = 0, unredeemedShares = 0.
- balanceOf(Alice) = 1000
- balanceOf(Bob) = 1000
- balanceOf(vault) = 0

### initiateWithdraw

- Alice initiate 500 shares withdrawal.

#### States updates:

- Update withdrawal of Alice (round=2, amount=500)
- queudWithdrawalsShares = 500
- balanceOf(Alice) = 500
- balanceOf(vault) = 500

### Round is closed

We assume strategy made 500SUSD and no deposits were made, now vault balance is 2500SUSD.

### Current Round = 3 : Owner Start new round

Currently totalSupply = 2000 shares, and vault balance is 2500SUSD and no pending deposits:

- roundPricePerShare[2] = 1.25 \* 1e18

### completeWithdraw

- Alice completes withdrawal of 500 shares and receives 775SUSD.

---
