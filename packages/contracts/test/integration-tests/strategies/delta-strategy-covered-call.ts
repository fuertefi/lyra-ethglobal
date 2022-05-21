import { lyraConstants, lyraEvm, TestSystem } from '@lyrafinance/protocol';
import { PositionState, toBN } from '@lyrafinance/protocol/dist/scripts/util/web3utils';
import { DEFAULT_PRICING_PARAMS } from '@lyrafinance/protocol/dist/test/utils/defaultParams';
import { TestSystemContractsType } from '@lyrafinance/protocol/dist/test/utils/deployTestSystem';
import { PricingParametersStruct } from '@lyrafinance/protocol/dist/typechain-types/OptionMarketViewer';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { DeltaShortStrategy, LyraVault, MockERC20 } from '../../../typechain-types';
import {
  DeltaShortStrategyDetailStruct,
  OptionPositionStructOutput,
} from '../../../typechain-types/DeltaShortStrategy';
import { strikeIdToDetail } from './utils';

const strategyDetail: DeltaShortStrategyDetailStruct = {
  collatBuffer: toBN('1.5'), // multiplier of minimum required collateral
  collatPercent: toBN('0.35'), // percentage of full collateral
  minTradeInterval: 600,
  maxVolVariance: toBN('0.1'),
  gwavPeriod: 600,
  minTimeToExpiry: lyraConstants.DAY_SEC,
  maxTimeToExpiry: lyraConstants.WEEK_SEC * 2,
  targetDelta: toBN('0.2'),
  maxDeltaGap: toBN('0.05'), // accept delta from 0.15~0.25
  minVol: toBN('0.8'), // min vol to sell. (also used to calculate min premium for call selling vault)
  maxVol: toBN('1.3'), // max vol to sell.
  size: toBN('10'),
};

xdescribe('Covered Call Delta Strategy integration test', async () => {
  // mocked tokens
  let susd: MockERC20;
  let seth: MockERC20;

  let lyraTestSystem: TestSystemContractsType;
  // let lyraGlobal: LyraGlobal;
  // let lyraETHMarkets: LyraMarket;
  let vault: LyraVault;
  let strategy: DeltaShortStrategy;

  // roles
  let deployer: SignerWithAddress;
  let manager: SignerWithAddress;
  let randomUser: SignerWithAddress;
  let randomUser2: SignerWithAddress;

  // testing parameters
  const spotPrice = toBN('3000');
  let boardId = BigNumber.from(0);
  const boardParameter = {
    expiresIn: lyraConstants.DAY_SEC * 7,
    baseIV: '0.9',
    strikePrices: ['2500', '3000', '3200', '3400', '3550'],
    skews: ['1.1', '1', '1.1', '1.3', '1.3'],
  };
  const initialPoolDeposit = toBN('1500000'); // 1.5m

  before('assign roles', async () => {
    const addresses = await ethers.getSigners();
    deployer = addresses[0];
    manager = addresses[1];
    randomUser = addresses[8];
    randomUser2 = addresses[9];
  });

  before('deploy lyra core', async () => {
    const pricingParams: PricingParametersStruct = {
      ...DEFAULT_PRICING_PARAMS,
      standardSize: toBN('50'),
      spotPriceFeeCoefficient: toBN('0.001'),
      vegaFeeCoefficient: toBN('60'),
    };

    lyraTestSystem = await TestSystem.deploy(deployer, true, false, { pricingParams });

    await TestSystem.seed(deployer, lyraTestSystem, {
      initialBoard: boardParameter,
      initialBasePrice: spotPrice,
      initialPoolDeposit: initialPoolDeposit,
    });

    // assign test tokens
    seth = lyraTestSystem.snx.baseAsset as MockERC20;
    susd = lyraTestSystem.snx.quoteAsset as MockERC20;

    // set boardId
    const boards = await lyraTestSystem.optionMarket.getLiveBoards();
    boardId = boards[0];

    await lyraTestSystem.optionGreekCache.updateBoardCachedGreeks(boardId);

    // fast forward do vol gwap can work
    await lyraEvm.fastForward(600);
  });

  before('deploy vault', async () => {
    const LyraVault = await ethers.getContractFactory('LyraVault');

    const cap = ethers.utils.parseEther('5000');
    const decimals = 18;

    vault = (await LyraVault.connect(manager).deploy(
      susd.address,
      manager.address, // feeRecipient,
      lyraConstants.DAY_SEC * 7,
      'LyraVault Share',
      'Lyra VS',
      {
        decimals,
        cap,
        asset: seth.address,
      },
    )) as LyraVault;
  });

  before('deploy strategy', async () => {
    strategy = (await (
      await ethers.getContractFactory('DeltaShortStrategy', {
        libraries: {
          BlackScholes: lyraTestSystem.blackScholes.address,
        },
      })
    )
      .connect(manager)
      .deploy(
        vault.address,
        TestSystem.OptionType.SHORT_CALL_BASE,
        lyraTestSystem.GWAVOracle.address,
      )) as DeltaShortStrategy;
  });

  before('initialize strategy and adaptor', async () => {
    // todo: remove this once we put everything in constructor
    await strategy.connect(manager).initAdapter(
      lyraTestSystem.testCurve.address, // curve swap
      lyraTestSystem.optionToken.address,
      lyraTestSystem.optionMarket.address,
      lyraTestSystem.liquidityPool.address,
      lyraTestSystem.shortCollateral.address,
      lyraTestSystem.synthetixAdapter.address,
      lyraTestSystem.optionMarketPricer.address,
      lyraTestSystem.optionGreekCache.address,
      susd.address, // quote
      seth.address, // base
      lyraTestSystem.basicFeeCounter.address as string,
    );
  });

  before('link strategy to vault', async () => {
    await vault.connect(manager).setStrategy(strategy.address);
  });

  describe('check strategy setup', async () => {
    it('deploys with correct vault and optionType', async () => {
      expect(await strategy.vault()).to.be.eq(vault.address);
      expect(await strategy.optionType()).to.be.eq(TestSystem.OptionType.SHORT_CALL_BASE);
      expect(await strategy.gwavOracle()).to.be.eq(lyraTestSystem.GWAVOracle.address);
    });
  });

  describe('setStrategyDetail', async () => {
    it('setting strategy should correctly update strategy variables', async () => {
      await strategy.connect(manager).setStrategyDetail(strategyDetail);
      const newStrategy = await strategy.strategyDetail();
      expect(newStrategy.minTimeToExpiry).to.be.eq(strategyDetail.minTimeToExpiry);
      expect(newStrategy.maxTimeToExpiry).to.be.eq(strategyDetail.maxTimeToExpiry);
      expect(newStrategy.targetDelta).to.be.eq(strategyDetail.targetDelta);
      expect(newStrategy.maxDeltaGap).to.be.eq(strategyDetail.maxDeltaGap);
      expect(newStrategy.minVol).to.be.eq(strategyDetail.minVol);
      expect(newStrategy.maxVol).to.be.eq(strategyDetail.maxVol);
      expect(newStrategy.size).to.be.eq(strategyDetail.size);
    });

    it('should revert if setStrategy is not called by owner', async () => {
      await expect(strategy.connect(randomUser).setStrategyDetail(strategyDetail)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('start the first round', async () => {
    let strikes: BigNumber[] = [];
    before('create fake seth for users', async () => {
      await seth.mint(randomUser.address, toBN('100'));
      await seth.mint(randomUser2.address, toBN('100'));
    });
    before('set strikes array', async () => {
      strikes = await lyraTestSystem.optionMarket.getBoardStrikes(boardId);
    });
    it('user should be able to deposit through vault', async () => {
      // user 1 deposits
      await seth.connect(randomUser).approve(vault.address, lyraConstants.MAX_UINT);
      await vault.connect(randomUser).deposit(toBN('50'));
      // user 2 deposits
      await seth.connect(randomUser2).approve(vault.address, lyraConstants.MAX_UINT);
      await vault.connect(randomUser2).deposit(toBN('50'));

      const state = await vault.vaultState();
      expect(state.totalPending.eq(toBN('100'))).to.be.true;
    });
    it('should revert when trying to start with invalid boardId', async () => {
      await expect(vault.connect(manager).startNextRound(0)).to.be.revertedWith('timestamp expired');
    });
    it('manager can start round 1', async () => {
      await vault.connect(manager).startNextRound(boardId);
    });
    it('should revert when trying to update strategy detail mid-round', async () => {
      await expect(strategy.connect(manager).setStrategyDetail(strategyDetail)).to.revertedWith(
        'cannot change strategy if round is active',
      );
    });
    it('will not trade when delta is out of range"', async () => {
      // 2500 is a bad strike because delta is close to 1
      await expect(vault.connect(randomUser).trade(strikes[0])).to.be.revertedWith('invalid strike');

      // 3000 is a bad strike because delta is close to 0.5
      await expect(vault.connect(randomUser).trade(strikes[1])).to.be.revertedWith('invalid strike');

      // 3200 is a bad strike (delta is close to 0.34)
      await expect(vault.connect(randomUser).trade(strikes[2])).to.be.revertedWith('invalid strike');
    });

    it('should revert when min premium < premium calculated with min vol', async () => {
      // significantly increasing lyra spot fees to 2% of spot to make premiums below threshold
      let pricingParams: PricingParametersStruct = {
        ...DEFAULT_PRICING_PARAMS,
        standardSize: toBN('50'),
        spotPriceFeeCoefficient: toBN('0.5'),
        vegaFeeCoefficient: toBN('60'),
      };
      await lyraTestSystem.optionMarketPricer.setPricingParams(pricingParams);

      // 3550 is good strike with reasonable delta, but won't go through because premium will be too low.
      await expect(vault.connect(randomUser).trade(strikes[4])).to.be.revertedWith('TotalCostOutsideOfSpecifiedBounds');

      // resetting back to normal
      pricingParams = {
        ...pricingParams,
        standardSize: toBN('50'),
        spotPriceFeeCoefficient: toBN('0.001'),
        vegaFeeCoefficient: toBN('60'),
      };
      await lyraTestSystem.optionMarketPricer.setPricingParams(pricingParams);
    });

    it('should trade when delta and vol are within range', async () => {
      const strikeObj = await strikeIdToDetail(lyraTestSystem.optionMarket, strikes[3]);
      const [collateralToAdd] = await strategy.getRequiredCollateral(strikeObj);

      const vaultStateBefore = await vault.vaultState();
      const strategySUSDBalance = await susd.balanceOf(strategy.address);

      // 3400 is a good strike
      await vault.connect(randomUser).trade(strikes[3]);

      const strategyBalance = await seth.balanceOf(strategy.address);
      const vaultStateAfter = await vault.vaultState();
      const strategySUDCBalanceAfter = await susd.balanceOf(strategy.address);
      // strategy shouldn't hold any seth
      expect(strategyBalance.isZero()).to.be.true;
      // check state.lockAmount left is updated
      expect(vaultStateBefore.lockedAmountLeft.sub(vaultStateAfter.lockedAmountLeft).eq(collateralToAdd)).to.be.true;
      // check that we receive sUSD
      expect(strategySUDCBalanceAfter.sub(strategySUSDBalance).gt(0)).to.be.true;

      // active strike is updated
      const storedStrikeId = await strategy.activeStrikeIds(0);
      expect(storedStrikeId.eq(strikes[3])).to.be.true;

      // check that position size is correct
      const positionId = await strategy.strikeToPositionId(storedStrikeId);
      const [position] = await lyraTestSystem.optionToken.getOptionPositions([positionId]);

      expect(position.amount.eq(strategyDetail.size)).to.be.true;
      expect(position.collateral.eq(collateralToAdd)).to.be.true;
    });

    it('should revert when user try to trigger another trade during cooldown', async () => {
      await expect(vault.connect(randomUser).trade(strikes[3])).to.be.revertedWith('min time interval not passed');
    });

    it('should be able to trade again after time interval', async () => {
      await lyraEvm.fastForward(600);
      const strikeObj = await strikeIdToDetail(lyraTestSystem.optionMarket, strikes[3]);
      const positionId = await strategy.strikeToPositionId(strikeObj.id);

      const [collateralToAdd] = await strategy.getRequiredCollateral(strikeObj);
      const vaultStateBefore = await vault.vaultState();
      const [positionBefore] = await lyraTestSystem.optionToken.getOptionPositions([positionId]);

      await vault.connect(randomUser).trade(strikes[3]);

      const vaultStateAfter = await vault.vaultState();
      expect(vaultStateBefore.lockedAmountLeft.sub(vaultStateAfter.lockedAmountLeft).eq(collateralToAdd)).to.be.true;

      const [positionAfter] = await lyraTestSystem.optionToken.getOptionPositions([positionId]);
      expect(positionAfter.amount.sub(positionBefore.amount).eq(strategyDetail.size)).to.be.true;
    });

    it('should be able to trade a higher strike if spot price goes up', async () => {
      await TestSystem.marketActions.mockPrice(lyraTestSystem, toBN('3125'), 'sETH');

      // triger with new strike (3550)
      await vault.connect(randomUser).trade(strikes[4]);

      // check that active strikes are updated
      const storedStrikeId = await strategy.activeStrikeIds(1);
      expect(storedStrikeId.eq(strikes[4])).to.be.true;
      const positionId = await strategy.strikeToPositionId(storedStrikeId);
      const [position] = await lyraTestSystem.optionToken.getOptionPositions([positionId]);

      expect(position.amount.eq(strategyDetail.size)).to.be.true;
    });
    it('should revert when trying to trade the old strike', async () => {
      await lyraEvm.fastForward(600);
      await expect(vault.connect(randomUser).trade(strikes[3])).to.be.revertedWith('invalid strike');
    });

    const additionalDepositAmount = toBN('30');
    it('can add more deposit during the round', async () => {
      await vault.connect(randomUser).deposit(additionalDepositAmount);
      const state = await vault.vaultState();
      expect(state.totalPending.eq(additionalDepositAmount)).to.be.true;
      const receipt = await vault.depositReceipts(randomUser.address);
      expect(receipt.amount.eq(additionalDepositAmount)).to.be.true;
    });
    it('fastforward to the expiry', async () => {
      await lyraEvm.fastForward(boardParameter.expiresIn);
    });
    it('should revert when closeRound is called before options are settled', async () => {
      await expect(vault.closeRound()).to.be.revertedWith('cannot clear active position');
    });
    it('should revert when returnFundsAndClearStrikes is called by non-vault address', async () => {
      await expect(strategy.returnFundsAndClearStrikes()).to.be.revertedWith('only Vault');
    });
    it('should be able to close closeRound after settlement', async () => {
      await lyraTestSystem.optionMarket.settleExpiredBoard(boardId);

      // settle all positions, from 1 to highest position
      const totalPositions = (await lyraTestSystem.optionToken.nextId()).sub(1).toNumber();
      const idsToSettle = Array.from({ length: totalPositions }, (_, i) => i + 1); // create array of [1... totalPositions]
      await lyraTestSystem.shortCollateral.settleOptions(idsToSettle);

      const ethInVaultBefore = await seth.balanceOf(vault.address);

      const ethInStrategyBefore = await seth.balanceOf(strategy.address);
      const susdInStrategyBefore = await susd.balanceOf(strategy.address);

      // collateral should be back in the strategy after settlement
      expect(ethInStrategyBefore.gt(0)).to.be.true;
      // profit are kept as quote asset in the strategy
      expect(susdInStrategyBefore.gt(0)).to.be.true;

      await vault.closeRound();

      const susdInStrategyAfter = await susd.balanceOf(strategy.address);
      const ethdInStrategyAfter = await seth.balanceOf(strategy.address);
      const ethInValutAfter = await seth.balanceOf(vault.address);

      // strategy should be empty after close round
      expect(susdInStrategyAfter.isZero()).to.be.true;
      expect(ethdInStrategyAfter.isZero()).to.be.true;

      // the vault should get higher than the amount get from settlement, because of the premium
      expect(ethInValutAfter.sub(ethInVaultBefore).gt(ethInStrategyBefore));
    });
  });
  describe('start round 2', async () => {
    let strikes: BigNumber[] = [];
    let position: OptionPositionStructOutput;
    let strikePrice: BigNumber;
    let positionId: BigNumber;
    let expiry: BigNumber;
    let snapshot: number;
    let strategySUSDBalanceBefore: BigNumber;
    before('prepare before new round start', async () => {
      // set price back to initial spot price
      await TestSystem.marketActions.mockPrice(lyraTestSystem, spotPrice, 'sETH');

      // initiate withdraw for later test
      await vault.connect(randomUser2).initiateWithdraw(toBN('25'));
    });
    before('create new board', async () => {
      await TestSystem.marketActions.createBoard(lyraTestSystem, boardParameter);
      const boards = await lyraTestSystem.optionMarket.getLiveBoards();
      boardId = boards[0];

      strikes = await lyraTestSystem.optionMarket.getBoardStrikes(boardId);
    });

    before('start the next round', async () => {
      await lyraEvm.fastForward(lyraConstants.DAY_SEC);
      await vault.connect(manager).startNextRound(boardId);
    });

    before('should be able to complete the withdraw', async () => {
      const sethBefore = await seth.balanceOf(randomUser2.address);

      await vault.connect(randomUser2).completeWithdraw();

      const sethAfter = await seth.balanceOf(randomUser2.address);

      expect(sethAfter.sub(sethBefore).gt(toBN('25'))).to.be.true;
    });

    before('make a trade', async () => {
      strategySUSDBalanceBefore = await susd.balanceOf(strategy.address);
      await vault.connect(randomUser).trade(strikes[3]);

      [strikePrice, expiry] = await lyraTestSystem.optionMarket.getStrikeAndExpiry(strikes[3]);
      positionId = await strategy.strikeToPositionId(strikes[3]);
      position = (await lyraTestSystem.optionToken.getOptionPositions([positionId]))[0];

      const strategySUDCBalanceAfter = await susd.balanceOf(strategy.address);
      expect(strategySUDCBalanceAfter.sub(strategySUSDBalanceBefore).gt(0)).to.be.true;
    });

    beforeEach(async () => {
      snapshot = await lyraEvm.takeSnapshot();
    });

    afterEach(async () => {
      await lyraEvm.restoreSnapshot(snapshot);
    });

    it('should revert when trading with old strike', async () => {
      // strikeId 1 is the old strike from last round.
      await expect(vault.connect(randomUser).trade(1)).to.be.revertedWith('invalid strike');
    });

    it('should revert when trying to reduce a safe position', async () => {
      let fullCloseAmount = await strategy.getAllowedCloseAmount(position, strikePrice, expiry);
      expect(fullCloseAmount).to.be.eq(0);
      await expect(vault.connect(randomUser).reducePosition(positionId, toBN('0.1'))).to.be.revertedWith(
        'amount exceeds allowed close amount',
      );

      // we remain safe even if eth goes to 3400 (13% jump)
      await TestSystem.marketActions.mockPrice(lyraTestSystem, toBN('3400'), 'sETH');

      fullCloseAmount = await strategy.getAllowedCloseAmount(position, strikePrice, expiry);
      expect(fullCloseAmount).to.be.eq(0);
      await expect(vault.connect(randomUser).reducePosition(positionId, toBN('0.1'))).to.be.revertedWith(
        'amount exceeds allowed close amount',
      );
    });

    it('reduce full position if unsafe position + delta is in range', async () => {
      // 20% jump
      await TestSystem.marketActions.mockPrice(lyraTestSystem, toBN('3500'), 'sETH');
      const preReduceBal = await susd.balanceOf(strategy.address);

      const fullCloseAmount = await strategy.getAllowedCloseAmount(position, strikePrice, expiry.sub(10)); //account for time passing
      expect(fullCloseAmount).to.be.gt(0);
      await vault.connect(randomUser).reducePosition(positionId, fullCloseAmount);
      const postReduceBal = await susd.balanceOf(strategy.address);
      expect(postReduceBal).to.be.lt(preReduceBal);
    });

    it('partially reduce position if unsafe position + delta is in range', async () => {
      await TestSystem.marketActions.mockPrice(lyraTestSystem, toBN('3600'), 'sETH');
      const preReduceBal = await susd.balanceOf(strategy.address);

      const fullCloseAmount = await strategy.getAllowedCloseAmount(position, strikePrice, expiry.sub(10)); //account for time passing
      expect(fullCloseAmount).to.be.gt(0);
      await vault.connect(randomUser).reducePosition(positionId, fullCloseAmount.div(6));
      const postReduceBal = await susd.balanceOf(strategy.address);
      expect(postReduceBal).to.be.lt(preReduceBal);
    });

    it('revert reduce position if unsafe position + close amount too large', async () => {
      await TestSystem.marketActions.mockPrice(lyraTestSystem, toBN('3750'), 'sETH');
      const fullCloseAmount = await strategy.getAllowedCloseAmount(position, strikePrice, expiry.sub(10)); //account for time passing
      expect(fullCloseAmount).to.be.gt(0);
      await expect(vault.connect(randomUser).reducePosition(positionId, fullCloseAmount.mul(2))).to.be.revertedWith(
        'amount exceeds allowed close amount',
      );
    });

    it('partially reduce position with force close if delta out of range', async () => {
      await TestSystem.marketActions.mockPrice(lyraTestSystem, toBN('4000'), 'sETH');
      const preReduceBal = await susd.balanceOf(strategy.address);

      const fullCloseAmount = await strategy.getAllowedCloseAmount(position, strikePrice, expiry.sub(10)); //account for time passing
      expect(fullCloseAmount).to.be.gt(0);
      await vault.connect(randomUser).reducePosition(positionId, fullCloseAmount.div(15));
      const postReduceBal = await susd.balanceOf(strategy.address);
      expect(postReduceBal).to.be.lt(preReduceBal);
    });
  });
  describe('end round2: assuming position got liquidated', async () => {
    let strikes: BigNumber[];
    let positionId: BigNumber;
    before('set parameters', async () => {
      strikes = await lyraTestSystem.optionMarket.getBoardStrikes(boardId);

      positionId = await strategy.strikeToPositionId(strikes[3]);
    });
    it('liquidating position ', async () => {
      await TestSystem.marketActions.mockPrice(lyraTestSystem, toBN('4300'), 'sETH');
      const [positionBefore] = await lyraTestSystem.optionToken.getOptionPositions([positionId]);
      expect(positionBefore.state).to.be.eq(PositionState.ACTIVE);
      await lyraTestSystem.optionMarket.connect(randomUser).liquidatePosition(positionId, randomUser.address);

      const [positionAfter] = await lyraTestSystem.optionToken.getOptionPositions([positionId]);
      expect(positionAfter.state).to.be.eq(PositionState.LIQUIDATED);
    });

    // don't need to settle options as optionPosition.status = LIQUIDATED
    it.skip('fastforward to the expiry and settle options', async () => {
      // @notice: the shortCollateral contract won't have enough seth to pay out (settlement) after liquidation.
      //          so we need to top it up.
      await seth.mint(lyraTestSystem.shortCollateral.address, toBN('10'));

      await lyraEvm.fastForward(boardParameter.expiresIn);
      await lyraTestSystem.optionMarket.settleExpiredBoard(boardId);
      await lyraTestSystem.shortCollateral.settleOptions([positionId]);
    });

    it('should be able to close closeRound after settlement', async () => {
      const ethInVaultBefore = await seth.balanceOf(vault.address);
      const ethInStrategyBefore = await seth.balanceOf(strategy.address);
      const susdInStrategyBefore = await susd.balanceOf(strategy.address);

      // collateral should be back in the strategy after settlement
      expect(ethInStrategyBefore.gt(0)).to.be.true;
      // profit are kept as quote asset in the strategy
      expect(susdInStrategyBefore.gt(0)).to.be.true;

      await vault.closeRound();

      const susdInStrategyAfter = await susd.balanceOf(strategy.address);
      const ethdInStrategyAfter = await seth.balanceOf(strategy.address);
      const ethInValutAfter = await seth.balanceOf(vault.address);

      // strategy should be empty after close round
      expect(susdInStrategyAfter.isZero()).to.be.true;
      expect(ethdInStrategyAfter.isZero()).to.be.true;

      // the vault should get higher than the amount get from settlement, because of the premium
      expect(ethInValutAfter.sub(ethInVaultBefore).gt(ethInStrategyBefore));
    });
  });
});
