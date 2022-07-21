import { lyraConstants, lyraEvm, TestSystem } from "@lyrafinance/protocol";
import { toBN } from "@lyrafinance/protocol/dist/scripts/util/web3utils";
import { DEFAULT_PRICING_PARAMS } from "@lyrafinance/protocol/dist/test/utils/defaultParams";
import { TestSystemContractsType } from "@lyrafinance/protocol/dist/test/utils/deployTestSystem";
import { PricingParametersStruct } from "@lyrafinance/protocol/dist/typechain-types/OptionMarketViewer";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";
import { CSStrategy, CSVault, MockERC20 } from "../../../typechain-types";
import { StrategyDetailStruct } from "../../../typechain-types/CSStrategy";
import { strikeIdToDetail } from "./utils";

const strategyDetail: StrategyDetailStruct = {
  minTimeToExpiry: lyraConstants.DAY_SEC,
  maxTimeToExpiry: lyraConstants.WEEK_SEC * 2,
  mintargetDelta: toBN("0.15"),
  maxtargetDelta: toBN("0.85"),
  maxDeltaGap: toBN("0.05"),
  minVol: toBN("0.1"), // min vol to sell. (also used to calculate min premium for call selling vault)
  maxExchangeFeeRate: toBN("3"),
};

describe("Strategy integration test", async () => {
  // mocked tokens
  let susd: MockERC20;
  let seth: MockERC20;

  let lyraTestSystem: TestSystemContractsType;
  let vault: CSVault;
  let strategy: CSStrategy;

  // roles
  let deployer: SignerWithAddress;
  let manager: SignerWithAddress;
  let randomUser: SignerWithAddress;
  let randomUser2: SignerWithAddress;

  // testing parameters
  const spotPrice = toBN("1800");
  let boardId = BigNumber.from(0);
  const boardParameter = {
    expiresIn: lyraConstants.DAY_SEC * 7,
    baseIV: "0.85",
    strikePrices: [
      "1500",
      "1600",
      "1700",
      "1750",
      "1800",
      "1900",
      "2000",
      "2100",
      "2200",
    ],
    skews: [
      "1.23",
      "1.15",
      "1.05",
      "1.03",
      "1",
      "0.97",
      "0.96",
      "0.95",
      "0.95",
    ],
  };
  const initialPoolDeposit = toBN("2000000"); // 1.5m

  before("assign roles", async () => {
    const addresses = await ethers.getSigners();
    deployer = addresses[0];
    manager = addresses[1];
    randomUser = addresses[8];
    randomUser2 = addresses[9];
  });

  before("deploy lyra core", async () => {
    const pricingParams: PricingParametersStruct = {
      ...DEFAULT_PRICING_PARAMS,
      standardSize: toBN("50"),
      spotPriceFeeCoefficient: toBN("0.001"),
      vegaFeeCoefficient: toBN("60"),
    };

    lyraTestSystem = await TestSystem.deploy(deployer, true, false, {
      pricingParams,
    });

    //await lyraTestSystem.synthetixAdapter.exchanger
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

  before("deploy vault", async () => {
    const Vault = await ethers.getContractFactory("CSVault");

    const cap = ethers.utils.parseEther("5000000"); // 5m USD as cap
    const decimals = 18;

    // using open zeppelin upgrades
    // TODO: Manager should be admin, deployer should be interacting
    // TODO: Use only in integrational test or create separate test for proxy
    // TODO: Add proxy deployment script
    vault = (await upgrades.deployProxy(Vault.connect(manager), [
      susd.address,
      manager.address, // feeRecipient,
      lyraConstants.DAY_SEC * 7,
      "LyraVault Share",
      "Lyra VS",
      {
        decimals,
        cap,
        asset: seth.address, // collateral asset
      },
    ])) as CSVault;

    // TODO: Move owners, admins to test for successful deployment
    // console.log("deployer:", deployer.address);
    // console.log("manager:", manager.address);
    // console.log("owner:", await vault.owner());
    // console.log("vault address", vault.address);
  });

  before("deploy strategy", async () => {
    strategy = (await (
      await ethers.getContractFactory("CSStrategy", {
        libraries: {
          BlackScholes: lyraTestSystem.blackScholes.address,
        },
      })
    )./*connect(manager)*/ deploy(
      vault.address,
      // TestSystem.OptionType.SHORT_CALL_BASE,
    )) as CSStrategy;
    // TODO: delpoy directly from manager?
    await strategy.transferOwnership(manager.address);
  });

  before("initialize strategy and adaptor", async () => {
    await strategy.connect(manager).initAdapter(
      lyraTestSystem.lyraRegistry.address,
      lyraTestSystem.optionMarket.address,
      lyraTestSystem.testCurve.address, // curve swap
      lyraTestSystem.basicFeeCounter.address,
    );
  });

  before("set iv limit", async () => {
    await strategy.connect(manager).setIvLimit(ethers.utils.parseEther("2"));
  });

  before("link strategy to vault", async () => {
    await vault.connect(manager).setStrategy(strategy.address);
  });

  describe("check strategy setup", async () => {
    it("deploys with correct vault, optionType and iv limit", async () => {
      // TODO: Fix me?
      // expect(await strategy.optionType()).to.be.eq(
      // TestSystem.OptionType.SHORT_CALL_BASE,
      // );
      expect(await strategy.gwavOracle()).to.be.eq(
        lyraTestSystem.GWAVOracle.address,
      );
      expect(await strategy.ivLimit()).to.be.eq(ethers.utils.parseEther("2"));
    });
  });

  describe("setStrategy", async () => {
    // TODO: Cannot be called by anyone
    it("setting strategy should correctly update strategy variables", async () => {
      await strategy.connect(manager).setStrategyDetail(strategyDetail);
      const newStrategy = await strategy.strategyDetail();
      expect(newStrategy.minTimeToExpiry).to.be.eq(
        strategyDetail.minTimeToExpiry,
      );
      expect(newStrategy.maxTimeToExpiry).to.be.eq(
        strategyDetail.maxTimeToExpiry,
      );
      expect(newStrategy.mintargetDelta).to.be.eq(
        strategyDetail.mintargetDelta,
      );
      expect(newStrategy.maxtargetDelta).to.be.eq(
        strategyDetail.maxtargetDelta,
      );
      expect(newStrategy.minVol).to.be.eq(strategyDetail.minVol);
      expect(newStrategy.maxExchangeFeeRate).to.be.eq(
        strategyDetail.maxExchangeFeeRate,
      );
    });
  });

  describe("first round integration test", async () => {
    let strikes: BigNumber[] = [];
    before("create fake seth for users", async () => {
      await seth.mint(randomUser.address, toBN("100000"));
      await seth.mint(randomUser2.address, toBN("100000"));
    });

    before("set strikes array", async () => {
      strikes = await lyraTestSystem.optionMarket.getBoardStrikes(boardId);
    });

    it("user should be able to deposit through vault and update state correctly", async () => {
      // user 1 deposits
      await seth
        .connect(randomUser)
        .approve(vault.address, lyraConstants.MAX_UINT);
      await vault.connect(randomUser).deposit(toBN("50000"));
      // user 2 deposits
      await seth
        .connect(randomUser2)
        .approve(vault.address, lyraConstants.MAX_UINT);
      await vault.connect(randomUser2).deposit(toBN("50000"));

      // vault internal state checks
      const state = await vault.vaultState();
      expect(state.totalPending.eq(toBN("100000"))).to.be.true;
      const randomUserDepositReceipt = await vault.depositReceipts(
        randomUser.address,
      );
      expect(randomUserDepositReceipt.amount).to.be.eq(toBN("50000"));
      const randomUser2DepositReceipt = await vault.depositReceipts(
        randomUser2.address,
      );
      expect(randomUser2DepositReceipt.amount).to.be.eq(toBN("50000"));

      // vault balance checks
      const vaultBalance = await seth.balanceOf(vault.address);
      expect(vaultBalance).to.be.eq(toBN("100000"));
    });
    it("manager can start round 1", async () => {
      const vaultBalancePreRound = await seth.balanceOf(vault.address);
      const strategyBalancePreRound = await seth.balanceOf(strategy.address);
      expect(strategyBalancePreRound).to.be.eq(0);
      const tx = await vault.connect(manager).startNextRound(boardId);
      const block = await ethers.provider.getBlock(tx.blockNumber!);
      // const vaultBalanceRoundStart = await seth.balanceOf(vault.address);
      const strategyBalanceRoundStart = await seth.balanceOf(strategy.address);
      expect(strategyBalanceRoundStart).to.be.eq(vaultBalancePreRound);

      // check board id properly set
      expect(await strategy.currentBoardId()).to.be.equal(boardId);

      // check active expiry correctly set
      const timestampsDiff =
        (await strategy.activeExpiry()).toNumber() - block.timestamp;
      expect(timestampsDiff / 7 / 24 / 60 / 60).to.be.closeTo(1, 0.01);

      const vaultState = await vault.vaultState();
      expect(vaultState.round).to.be.equal(2); // QUESTION: why do we start round 1 and state is round = 2?
      expect(vaultState.lockedAmount).to.be.equal(
        ethers.utils.parseEther("100000"),
      );
      expect(vaultState.lastLockedAmount).to.be.equal(0);
      expect(vaultState.lockedAmountLeft).to.be.equal(
        ethers.utils.parseEther("100000"),
      );
      expect(vaultState.totalPending).to.be.equal(0);
      expect(vaultState.roundInProgress).to.be.true;
      // expect(vaultState.nextRoundReadyTimestamp).to.be.equal(block.timestamp + );
      //BUG: somethine wrong with nextRoundReadyTimestamp, we need a fix
      const nextRoundReadyTimestamp = vaultState.nextRoundReadyTimestamp;
      console.log("nextRoundReadyTimestamp:", nextRoundReadyTimestamp);
    });

    // test success
    xit("should check deltas are within bound and pick correct strikes", async () => {
      const strikeObj1 = await strikeIdToDetail(
        lyraTestSystem.optionMarket,
        strikes[1],
      );
      const strikeObj2 = await strikeIdToDetail(
        lyraTestSystem.optionMarket,
        strikes[6],
      );
      const { deltaGap: deltaGapSmallStrike } = await strategy._getDeltaGap(
        strikeObj1,
        true,
      );
      const { deltaGap: deltaGapBigStrike } = await strategy._getDeltaGap(
        strikeObj2,
        false,
      );

      expect(
        parseFloat(ethers.utils.formatEther(deltaGapSmallStrike)),
      ).to.be.closeTo(0, 0.05);
      expect(
        parseFloat(ethers.utils.formatEther(deltaGapBigStrike)),
      ).to.be.closeTo(0, 0.05);

      const [SmallContractStrike, BigContractStrike] =
        await strategy._getTradeStrikes();

      const { deltaGap: deltaGapSmallContractStrikeContract } =
        await strategy._getDeltaGap(SmallContractStrike, true);
      const { deltaGap: deltaGapBigContractStrikeContract } =
        await strategy._getDeltaGap(BigContractStrike, false);
      expect(
        parseFloat(
          ethers.utils.formatEther(deltaGapSmallContractStrikeContract),
        ),
      ).to.be.closeTo(0, 0.05);
      expect(
        parseFloat(ethers.utils.formatEther(deltaGapBigContractStrikeContract)),
      ).to.be.closeTo(0, 0.05);
    });

    it("should trade when called first time", async () => {
      const currentSpotPrice = (
        await lyraTestSystem.synthetixAdapter.getExchangeParams(
          lyraTestSystem.optionMarket.address,
        )
      ).spotPrice;
      console.log(
        "currentSpotPrice",
        ethers.utils.formatEther(currentSpotPrice),
      );

      const strategySETHBalanceBefore = await seth.balanceOf(strategy.address);
      const strategySUSDBalanceBefore = await susd.balanceOf(strategy.address);
      const vaultStateBefore = await vault.vaultState();

      // TODO: only allowed should be able to call trade function
      const tradeTransaction = await vault
        .connect(randomUser)
        .trade(toBN("10"));

      const strategySETHBalanceAfter = await seth.balanceOf(strategy.address);
      const strategySUSDBalanceAfter = await susd.balanceOf(strategy.address);
      const vaultStateAfter = await vault.vaultState();

      // Check Vault updates
      expect(
        vaultStateBefore.lockedAmountLeft.sub(vaultStateAfter.lockedAmountLeft),
      ).to.equal(toBN("10"));

      /* Check strategy updates: 1- Check that we receive sUSD
       *                         2- Check that we sent correct sETH amount
       *                         3- Check activeStrikes array update
       *                         4- Update last trading timestamp
       *                         5- Check Lyra positions
       **/

      // 1- Check that we receive sUSD
      expect(strategySUSDBalanceAfter.sub(strategySUSDBalanceBefore)).to.be.gt(
        0,
      );
      // 2- Check that we sent correct sETH amount
      expect(
        parseFloat(
          ethers.utils.formatEther(
            strategySETHBalanceBefore.sub(strategySETHBalanceAfter),
          ),
        ),
      ).to.be.closeTo(parseFloat(ethers.utils.formatEther(toBN("10"))), 0.0001);

      // 3- Check active strikes array updates
      const strikeObj1 = await strikeIdToDetail(
        lyraTestSystem.optionMarket,
        strikes[1],
      );
      const strikeObj2 = await strikeIdToDetail(
        lyraTestSystem.optionMarket,
        strikes[6],
      );
      const storedStrikeId1 = await strategy.activeStrikeIds(0);
      const storedStrikeId2 = await strategy.activeStrikeIds(1);
      expect(storedStrikeId1.eq(strikeObj1.id)).to.be.true;
      expect(storedStrikeId2.eq(strikeObj2.id)).to.be.true;
      await expect(strategy.activeStrikeIds(2)).to.be.reverted;

      // 4- Update last trading timestamp

      const tradeTimestamp = (
        await ethers.provider.getBlock(tradeTransaction.blockNumber!)
      ).timestamp; //tradeTransaction.timestamp;
      const lastTradeTimestamp1 = await strategy.lastTradeTimestamp(
        storedStrikeId1,
      );
      const lastTradeTimestamp2 = await strategy.lastTradeTimestamp(
        storedStrikeId2,
      );
      expect(lastTradeTimestamp1).to.be.equal(tradeTimestamp);
      expect(lastTradeTimestamp2).to.be.equal(tradeTimestamp);

      // 5- Check Lyra positions
      const positionId1 = await strategy.strikeToPositionId(storedStrikeId1);
      const [position1] = await lyraTestSystem.optionToken.getOptionPositions([
        positionId1,
      ]);
      const positionId2 = await strategy.strikeToPositionId(storedStrikeId2);
      const [position2] = await lyraTestSystem.optionToken.getOptionPositions([
        positionId2,
      ]);

      expect(position1.strikeId).to.be.equal(storedStrikeId1);
      expect(position1.optionType).to.be.equal(
        TestSystem.OptionType.SHORT_CALL_BASE,
      );
      //TODO: add checks with premiums received?
      expect(position2.amount.sub(toBN("5"))).to.be.gt(0);
      expect(position2.collateral.sub(toBN("5"))).to.be.gt(0);
      expect(position2.state).to.be.equal(TestSystem.PositionState.ACTIVE);
      expect(position2.strikeId).to.be.equal(storedStrikeId2);
      expect(position2.optionType).to.be.equal(
        TestSystem.OptionType.SHORT_CALL_BASE,
      );
      //TODO: add checks with premiums received?
      expect(position2.amount.sub(toBN("5"))).to.be.gt(0);
      expect(position2.collateral.sub(toBN("5"))).to.be.gt(0);
      expect(position2.state).to.be.equal(TestSystem.PositionState.ACTIVE);

      // Check Event emition

      // TODO: Proper check for minimum premiums to receive
      // ANSWER: Yes good idea should look in to that
      // const checkPremiumsReceived = (val: string) => {
      //   console.log(`Premiums received ${val}`);
      //   return true; //BigNumber.from(val).gte("25075174003286612347165");
      // };

      // const checkCapitalUsed = (_val: string) => {
      //   // TODO: Fix me
      //   return true;

      //   // return BigNumber.from(val).eq(
      //   // BigNumber.from(strategyDetail.size.toString()).mul(2),
      //   // );
      // };

      // TODO: Check strategy detail size is updated
      // TODO: Check position size? and compare with trade on synthetix?

      // TODO: Proper check for premium exchange value using premium limit
      // const checkPremiumExchangeValue = (val: string) => {
      //   console.log(`Premiums exchange: ${val}`);
      //   return true; //BigNumber.from(val).gte("13024350046259892330");
      // };

      // const _positionId1 = 1;
      // const _positionId2 = 2;

      // await expect(tradeTransaction)
      //   .to.emit(vault, "Trade")
      //   .withArgs(
      //     randomUser.address,
      //     _positionId1,
      //     _positionId2,
      //     checkPremiumsReceived,
      //     checkCapitalUsed,
      //     checkPremiumExchangeValue,
      //   );
    });

    //TODO: this is just a lyra test system test and not ours, remove?
    xit("should revert when called a second time because of high delta", async () => {
      await expect(
        vault.connect(randomUser).trade(toBN("10")),
      ).to.be.revertedWithCustomError(
        lyraTestSystem.optionMarketPricer,
        "TradeDeltaOutOfRange",
      );
    });

    // success
    xit("should trade when called second time with smaller amount", async () => {
      const strategySETHBalanceBefore = await seth.balanceOf(strategy.address);
      const strategySUSDBalanceBefore = await susd.balanceOf(strategy.address);
      const vaultStateBefore = await vault.vaultState();

      console.log(
        "strategySETHBalanceBefore:",
        ethers.utils.formatEther(strategySETHBalanceBefore),
      );
      console.log(
        "strategySUSDBalanceBefore:",
        ethers.utils.formatEther(strategySUSDBalanceBefore),
      );
      // TODO: only allowed should be able to call trade function
      const tradeTransaction = await vault
        .connect(randomUser)
        .trade(toBN("50"));

      const strategySETHBalanceAfter = await seth.balanceOf(strategy.address);
      const strategySUSDBalanceAfter = await susd.balanceOf(strategy.address);
      const vaultStateAfter = await vault.vaultState();

      console.log(
        "strategySETHBalanceAfter:",
        ethers.utils.formatEther(strategySETHBalanceAfter),
      );
      console.log(
        "strategySUSDBalanceAfter:",
        ethers.utils.formatEther(strategySUSDBalanceAfter),
      );
      // Check Vault updates
      expect(
        vaultStateBefore.lockedAmountLeft.sub(vaultStateAfter.lockedAmountLeft),
      ).to.equal(toBN("50"));

      /* Check strategy updates: 1- Check that we receive sUSD
       *                         2- Check that we sent correct sETH amount
       *                         3- Check activeStrikes array update
       *                         4- Update last trading timestamp
       *                         5- Check Lyra positions
       **/

      // 1- Check that we receive sUSD
      // Inversing this time because we are exchanging sUSD at the beggingin
      // TODO: Check strategy balance from the trade1 and trade2 and keep comparing
      expect(strategySUSDBalanceBefore.sub(strategySUSDBalanceAfter)).to.be.gt(
        0,
      );
      // 2- Check that we sent correct sETH amount
      expect(
        parseFloat(
          ethers.utils.formatEther(
            strategySETHBalanceBefore.sub(strategySETHBalanceAfter),
          ),
        ),
      ).to.be.closeTo(parseFloat(ethers.utils.formatEther(toBN("50"))), 1);

      // 3- Check active strikes array updates
      const strikeObj1 = await strikeIdToDetail(
        lyraTestSystem.optionMarket,
        strikes[1],
      );
      const strikeObj2 = await strikeIdToDetail(
        lyraTestSystem.optionMarket,
        strikes[6],
      );
      const storedStrikeId1 = await strategy.activeStrikeIds(0);
      const storedStrikeId2 = await strategy.activeStrikeIds(1);
      expect(storedStrikeId1.eq(strikeObj1.id)).to.be.true;
      expect(storedStrikeId2.eq(strikeObj2.id)).to.be.true;
      await expect(strategy.activeStrikeIds(2)).to.be.reverted;

      // 4- Update last trading timestamp

      const tradeTimestamp = (
        await ethers.provider.getBlock(tradeTransaction.blockNumber!)
      ).timestamp; //tradeTransaction.timestamp;
      const lastTradeTimestamp1 = await strategy.lastTradeTimestamp(
        storedStrikeId1,
      );
      const lastTradeTimestamp2 = await strategy.lastTradeTimestamp(
        storedStrikeId2,
      );
      expect(lastTradeTimestamp1).to.be.equal(tradeTimestamp);
      expect(lastTradeTimestamp2).to.be.equal(tradeTimestamp);

      // 5- Check Lyra positions
      const positionId1 = await strategy.strikeToPositionId(storedStrikeId1);
      const [position1] = await lyraTestSystem.optionToken.getOptionPositions([
        positionId1,
      ]);
      const positionId2 = await strategy.strikeToPositionId(storedStrikeId2);
      const [position2] = await lyraTestSystem.optionToken.getOptionPositions([
        positionId2,
      ]);

      expect(position1.strikeId).to.be.equal(storedStrikeId1);
      expect(position1.optionType).to.be.equal(
        TestSystem.OptionType.SHORT_CALL_BASE,
      );
      //TODO: add checks with premiums received?
      expect(position2.amount.sub(toBN("125"))).to.be.gt(0);
      expect(position2.collateral.sub(toBN("125"))).to.be.gt(0);
      expect(position2.state).to.be.equal(TestSystem.PositionState.ACTIVE);
      expect(position2.strikeId).to.be.equal(storedStrikeId2);
      expect(position2.optionType).to.be.equal(
        TestSystem.OptionType.SHORT_CALL_BASE,
      );
      //TODO: add checks with premiums received?
      expect(position2.amount.sub(toBN("125"))).to.be.gt(0);
      expect(position2.collateral.sub(toBN("125"))).to.be.gt(0);
      expect(position2.state).to.be.equal(TestSystem.PositionState.ACTIVE);
    });

    //TODO: Move to unit test
    // SUCCESS
    xit("should revert when not finding a matching delta gap", async () => {
      // Change spot price to 2000
      await TestSystem.marketActions.mockPrice(
        lyraTestSystem,
        toBN("2000"),
        "sETH",
      );

      await expect(strategy._getTradeStrikes()).to.be.revertedWith(
        "bigDeltaGap out of bound!",
      );
    });
    xit("should pick correct strikes when price changes", async () => {
      // Change spot price to 1850
      await TestSystem.marketActions.mockPrice(
        lyraTestSystem,
        toBN("1813"),
        "sETH",
      );

      const currentSpotPrice = (
        await lyraTestSystem.synthetixAdapter.getExchangeParams(
          lyraTestSystem.optionMarket.address,
        )
      ).spotPrice;
      console.log(
        "currentSpotPrice",
        ethers.utils.formatEther(currentSpotPrice),
      );

      const [SmallContractStrike, BigContractStrike] =
        await strategy._getTradeStrikes();

      console.log(
        "SmallContractStrike:",
        ethers.utils.formatEther(SmallContractStrike.strikePrice),
      );
      console.log(
        "BigContractStrike:",
        ethers.utils.formatEther(BigContractStrike.strikePrice),
      );

      const strikeObj1 = await strikeIdToDetail(
        lyraTestSystem.optionMarket,
        strikes[0],
      );
      const strikeObj2 = await strikeIdToDetail(
        lyraTestSystem.optionMarket,
        strikes[7],
      );
      const { deltaGap: deltaGapSmallStrike } = await strategy._getDeltaGap(
        strikeObj1,
        true,
      );
      const { deltaGap: deltaGapBigStrike } = await strategy._getDeltaGap(
        strikeObj2,
        false,
      );

      expect(
        parseFloat(ethers.utils.formatEther(deltaGapSmallStrike)),
      ).to.be.closeTo(0, 0.05);
      expect(
        parseFloat(ethers.utils.formatEther(deltaGapBigStrike)),
      ).to.be.closeTo(0, 0.05);

      // const [SmallContractStrike, BigContractStrike] =
      //   await strategy._getTradeStrikes();

      const { deltaGap: deltaGapSmallContractStrikeContract } =
        await strategy._getDeltaGap(SmallContractStrike, true);
      const { deltaGap: deltaGapBigContractStrikeContract } =
        await strategy._getDeltaGap(BigContractStrike, false);
      expect(
        parseFloat(
          ethers.utils.formatEther(deltaGapSmallContractStrikeContract),
        ),
      ).to.be.closeTo(0, 0.05);
      expect(
        parseFloat(ethers.utils.formatEther(deltaGapBigContractStrikeContract)),
      ).to.be.closeTo(0, 0.05);
    });

    //
    xit("should trade new strikes when spot changes", async () => {
      console.log("NEW TRADE");
      const strategySETHBalanceBefore = await seth.balanceOf(strategy.address);
      const strategySUSDBalanceBefore = await susd.balanceOf(strategy.address);
      const vaultStateBefore = await vault.vaultState();

      console.log(
        "strategySETHBalanceBefore:",
        ethers.utils.formatEther(strategySETHBalanceBefore),
      );
      console.log(
        "strategySUSDBalanceBefore:",
        ethers.utils.formatEther(strategySUSDBalanceBefore),
      );
      // TODO: only allowed should be able to call trade function
      const tradeTransaction = await vault.connect(randomUser).trade(toBN("2"));

      const strategySETHBalanceAfter = await seth.balanceOf(strategy.address);
      const strategySUSDBalanceAfter = await susd.balanceOf(strategy.address);
      const vaultStateAfter = await vault.vaultState();

      console.log(
        "strategySETHBalanceAfter:",
        ethers.utils.formatEther(strategySETHBalanceAfter),
      );
      console.log(
        "strategySUSDBalanceAfter:",
        ethers.utils.formatEther(strategySUSDBalanceAfter),
      );
      // Check Vault updates
      expect(
        vaultStateBefore.lockedAmountLeft.sub(vaultStateAfter.lockedAmountLeft),
      ).to.equal(toBN("2"));

      /* Check strategy updates: 1- Check that we receive sUSD
       *                         2- Check that we sent correct sETH amount
       *                         3- Check activeStrikes array update
       *                         4- Update last trading timestamp
       *                         5- Check Lyra positions
       **/

      // 1- Check that we receive sUSD
      // Inversing this time because we are exchanging sUSD at the beggingin
      // TODO: Check strategy balance from the trade1 and trade2 and keep comparing
      expect(strategySUSDBalanceBefore.sub(strategySUSDBalanceAfter)).to.be.gt(
        0,
      );
      // 2- Check that we sent correct sETH amount
      expect(
        parseFloat(
          ethers.utils.formatEther(
            strategySETHBalanceBefore.sub(strategySETHBalanceAfter),
          ),
        ),
      ).to.be.closeTo(parseFloat(ethers.utils.formatEther(toBN("2"))), 1);

      // 3- Check active strikes array updates
      const strikeObj1 = await strikeIdToDetail(
        lyraTestSystem.optionMarket,
        strikes[1],
      );
      const strikeObj2 = await strikeIdToDetail(
        lyraTestSystem.optionMarket,
        strikes[6],
      );
      const storedStrikeId1 = await strategy.activeStrikeIds(0);
      const storedStrikeId2 = await strategy.activeStrikeIds(1);
      expect(storedStrikeId1.eq(strikeObj1.id)).to.be.true;
      expect(storedStrikeId2.eq(strikeObj2.id)).to.be.true;
      await expect(strategy.activeStrikeIds(2)).to.be.reverted;

      // 4- Update last trading timestamp

      const tradeTimestamp = (
        await ethers.provider.getBlock(tradeTransaction.blockNumber!)
      ).timestamp; //tradeTransaction.timestamp;
      const lastTradeTimestamp1 = await strategy.lastTradeTimestamp(
        storedStrikeId1,
      );
      const lastTradeTimestamp2 = await strategy.lastTradeTimestamp(
        storedStrikeId2,
      );
      expect(lastTradeTimestamp1).to.be.equal(tradeTimestamp);
      expect(lastTradeTimestamp2).to.be.equal(tradeTimestamp);

      // 5- Check Lyra positions
      const positionId1 = await strategy.strikeToPositionId(storedStrikeId1);
      const [position1] = await lyraTestSystem.optionToken.getOptionPositions([
        positionId1,
      ]);
      const positionId2 = await strategy.strikeToPositionId(storedStrikeId2);
      const [position2] = await lyraTestSystem.optionToken.getOptionPositions([
        positionId2,
      ]);

      expect(position1.strikeId).to.be.equal(storedStrikeId1);
      expect(position1.optionType).to.be.equal(
        TestSystem.OptionType.SHORT_CALL_BASE,
      );
      //TODO: add checks with premiums received?
      expect(position2.amount.sub(toBN("6"))).to.be.gt(0);
      expect(position2.collateral.sub(toBN("1"))).to.be.gt(0);
      expect(position2.state).to.be.equal(TestSystem.PositionState.ACTIVE);
      expect(position2.strikeId).to.be.equal(storedStrikeId2);
      expect(position2.optionType).to.be.equal(
        TestSystem.OptionType.SHORT_CALL_BASE,
      );
      //TODO: add checks with premiums received?
      expect(position2.amount.sub(toBN("11"))).to.be.gt(0);
      expect(position2.collateral.sub(toBN("1"))).to.be.gt(0);
      expect(position2.state).to.be.equal(TestSystem.PositionState.ACTIVE);
    });

    // TODO: This is vault test move it to other vault test file/unit tests
    xit("can add more deposit during the round", async () => {
      const additionalDepositAmount = toBN("25000");
      await vault.connect(randomUser).deposit(additionalDepositAmount);
      const state = await vault.vaultState();
      expect(state.totalPending.eq(additionalDepositAmount)).to.be.true;
      const receipt = await vault.depositReceipts(randomUser.address);
      expect(receipt.amount.eq(additionalDepositAmount)).to.be.true;
    });
    it("fastforward to the expiry", async () => {
      await lyraEvm.fastForward(boardParameter.expiresIn);
    });
    it("should be able to close closeRound after settlement", async () => {
      await lyraTestSystem.optionMarket.settleExpiredBoard(boardId);
      const sethInStrategyBefore = await seth.balanceOf(strategy.address);
      const sethInVaultBefore = await seth.balanceOf(vault.address);
      const vaultStateBefore = await vault.vaultState();

      // settle all positions, from 1 to highest position
      const totalPositions = (await lyraTestSystem.optionToken.nextId())
        .sub(1)
        .toNumber();
      const idsToSettle = Array.from(
        { length: totalPositions },
        (_, i) => i + 1,
      ); // create array of [1... totalPositions]
      await lyraTestSystem.shortCollateral.settleOptions(idsToSettle);

      const sethInStrategyAfterSettlement = await seth.balanceOf(
        strategy.address,
      );

      // collateral should be back into the strategy after settlement
      expect(sethInStrategyAfterSettlement.sub(sethInStrategyBefore).gt(0)).to
        .be.true;

      // Strategy state before
      const strikeId1 = await strategy.activeStrikeIds(0);
      const strikeId2 = await strategy.activeStrikeIds(1);

      // TODO: Check how much was earned?

      const closeRoundTx = await vault.closeRound();

      const sethInStrategyAfter = await seth.balanceOf(strategy.address);
      const sethInVaultAfter = await seth.balanceOf(vault.address);
      const vaultStateAfter = await vault.vaultState();

      // strategy should be empty after close round
      expect(sethInStrategyAfter.isZero()).to.be.true;

      // all sUSD in strategy should go back to the vault
      expect(
        sethInVaultAfter
          .sub(sethInVaultBefore)
          .eq(sethInStrategyAfterSettlement),
      );

      // Vault state checks
      const closeRoundBlock = closeRoundTx.blockNumber!;
      const closeRoundTimestamp = (
        await ethers.provider.getBlock(closeRoundBlock)
      ).timestamp;

      expect(
        vaultStateAfter.lastLockedAmount.eq(vaultStateBefore.lockedAmount),
      );
      expect(vaultStateAfter.lockedAmountLeft.eq(0));
      expect(vaultStateAfter.lockedAmount.eq(0));
      expect(vaultStateAfter.roundInProgress).to.be.false;
      expect(
        vaultStateAfter.nextRoundReadyTimestamp.eq(
          closeRoundTimestamp + 6 * 6 * 60,
        ),
      );

      // Strategy update checks
      const positionId1After = await strategy.strikeToPositionId(strikeId1);
      const positionId2After = await strategy.strikeToPositionId(strikeId2);
      const lastTradeTimestamp1After = await strategy.lastTradeTimestamp(
        strikeId1,
      );
      const lastTradeTimestamp2After = await strategy.lastTradeTimestamp(
        strikeId2,
      );
      expect(positionId1After.eq(0));
      expect(positionId2After.eq(0));
      expect(lastTradeTimestamp1After.eq(0));
      expect(lastTradeTimestamp2After.eq(0));
      await expect(strategy.activeStrikeIds(0)).to.be.reverted;
    });
  });
});

// TESTS TODO:  - Check trading a second time happens correctly. OK
//              - Change spot price. OK
//              - Trade again and check it picked right deltas, right strikes, updates positions correctly.
//              - Sanity check, change spot price again and repeat.
//              - Close round and do proper checks
