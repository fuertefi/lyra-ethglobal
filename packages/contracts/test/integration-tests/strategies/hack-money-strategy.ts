import { lyraConstants, lyraEvm, TestSystem } from "@lyrafinance/protocol";
import { toBN } from "@lyrafinance/protocol/dist/scripts/util/web3utils";
import { DEFAULT_PRICING_PARAMS } from "@lyrafinance/protocol/dist/test/utils/defaultParams";
import { TestSystemContractsType } from "@lyrafinance/protocol/dist/test/utils/deployTestSystem";
import { PricingParametersStruct } from "@lyrafinance/protocol/dist/typechain-types/OptionMarketViewer";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";
import {
  HackMoneyStrategy,
  HackMoneyVault,
  MockERC20,
} from "../../../typechain-types";
import { HackMoneyStrategyDetailStruct } from "../../../typechain-types/HackMoneyStrategy";

const strategyDetail: HackMoneyStrategyDetailStruct = {
  minTimeToExpiry: lyraConstants.DAY_SEC,
  maxTimeToExpiry: lyraConstants.WEEK_SEC * 2,
  mintargetDelta: toBN("0.15"),
  maxtargetDelta: toBN("0.85"),
  maxDeltaGap: toBN("0.05"),
  minVol: toBN("0.1"), // min vol to sell. (also used to calculate min premium for call selling vault)
  size: toBN("100"),
};

describe("Hack Money Strategy integration test", async () => {
  // mocked tokens
  let susd: MockERC20;
  let seth: MockERC20;

  let lyraTestSystem: TestSystemContractsType;
  let vault: HackMoneyVault;
  let strategy: HackMoneyStrategy;

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
  const initialPoolDeposit = toBN("1500000"); // 1.5m

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
    const Vault = await ethers.getContractFactory("HackMoneyVault");

    const cap = ethers.utils.parseEther("5000000"); // 5m USD as cap
    const decimals = 18;

    // using open zeppelin upgrades
    // TODO: Manager should be admin, deployer should be interacting
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
    ])) as HackMoneyVault;

    // TODO: Move owners, admins to test for successful deployment
    console.log("deployer");
    console.log(deployer.address);
    console.log("manager");
    console.log(manager.address);
    console.log("owner");
    console.log(await vault.owner());
    console.log("vault address");
    console.log(vault.address);
  });

  before("deploy strategy", async () => {
    // TODO: Verify same deployment for both tests
    // TODO: Use upgradeability proxy
    strategy = (await (
      await ethers.getContractFactory("HackMoneyStrategy", {
        libraries: {
          BlackScholes: lyraTestSystem.blackScholes.address,
        },
      })
    )
      .connect(manager)
      .deploy(
        vault.address,
        TestSystem.OptionType.SHORT_CALL_BASE
      )) as HackMoneyStrategy;
  });

  before("initialize strategy and adaptor", async () => {
    await strategy.connect(manager).initAdapter(
      lyraTestSystem.lyraRegistry.address,
      lyraTestSystem.optionMarket.address,
      lyraTestSystem.testCurve.address, // curve swap
      lyraTestSystem.basicFeeCounter.address
    );
    // TODO: move iv limit to adapter init?
    await strategy.connect(manager).setIvLimit(ethers.utils.parseEther("2"));
  });

  before("link strategy to vault", async () => {
    await vault.connect(manager).setStrategy(strategy.address);
  });

  describe("check strategy setup", async () => {
    it("deploys with correct vault and optionType", async () => {
      expect(await strategy.optionType()).to.be.eq(
        TestSystem.OptionType.SHORT_CALL_BASE
      );
      expect(await strategy.gwavOracle()).to.be.eq(
        lyraTestSystem.GWAVOracle.address
      );
      expect(await strategy.ivLimit()).to.be.eq(ethers.utils.parseEther("2"));
    });
  });

  describe("setStrategy", async () => {
    it("setting strategy should correctly update strategy variables", async () => {
      await strategy.connect(manager).setStrategyDetail(strategyDetail);
      const newStrategy = await strategy.strategyDetail();
      expect(newStrategy.minTimeToExpiry).to.be.eq(
        strategyDetail.minTimeToExpiry
      );
      expect(newStrategy.maxTimeToExpiry).to.be.eq(
        strategyDetail.maxTimeToExpiry
      );
      expect(newStrategy.mintargetDelta).to.be.eq(
        strategyDetail.mintargetDelta
      );
      expect(newStrategy.maxtargetDelta).to.be.eq(
        strategyDetail.maxtargetDelta
      );
    });
  });

  describe("start the first round", async () => {
    before("create fake seth for users", async () => {
      await seth.mint(randomUser.address, toBN("100000"));
      await seth.mint(randomUser2.address, toBN("100000"));
    });

    it("user should be able to deposit through vault", async () => {
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

      const state = await vault.vaultState();
      expect(state.totalPending.eq(toBN("100000"))).to.be.true;
    });
    it("manager can start round 1", async () => {
      const vaultBalancePreRound = await seth.balanceOf(vault.address);
      const strategyBalancePreRound = await seth.balanceOf(strategy.address);
      expect(strategyBalancePreRound).to.be.eq(0);
      await vault.connect(manager).startNextRound(boardId);
      const vaultBalanceRoundStart = await seth.balanceOf(vault.address);
      const strategyBalanceRoundStart = await seth.balanceOf(strategy.address);
      expect(strategyBalanceRoundStart).to.be.eq(vaultBalancePreRound);

      const vaultState = await vault.vaultState();
      expect(vaultState.round).to.be.equal(2);
      expect(vaultState.lockedAmount).to.be.equal(
        ethers.utils.parseEther("100000")
      );
      expect(vaultState.lastLockedAmount).to.be.equal(0);
      expect(vaultState.lockedAmountLeft).to.be.equal(
        ethers.utils.parseEther("100000")
      );
      expect(vaultState.totalPending).to.be.equal(0);
      expect(vaultState.roundInProgress).to.be.true;
    });

    it("should trade when called first time", async () => {
      // const strikeObj1 = await strikeIdToDetail(lyraTestSystem.optionMarket, strikes[1]);
      // const strikeObj2 = await strikeIdToDetail(lyraTestSystem.optionMarket, strikes[5]);
      // const [collateralToAdd1] = await strategy.getRequiredCollateral(strikeObj1);
      // const [collateralToAdd2] = await strategy.getRequiredCollateral(strikeObj2);
      // const collateralToAdd = collateralToAdd1.add(collateralToAdd2);

      // const { smallStrikePrice, bigStrikePrice } = await strategy.getStrikes();
      // console.log(smallStrikePrice.toString(), bigStrikePrice.toString());

      const strategySETHBalanceBefore = await seth.balanceOf(strategy.address);
      console.log(
        "strategySETHBalanceBefore:",
        ethers.utils.formatEther(strategySETHBalanceBefore)
      );
      const strategySUSDBalanceBefore = await susd.balanceOf(strategy.address);
      console.log(
        "strategySUSDBalanceBefore:",
        ethers.utils.formatEther(strategySUSDBalanceBefore)
      );

      const vaultStateBefore = await vault.vaultState();

      const tradeTransaction = await vault
        .connect(randomUser)
        .trade(strategyDetail.size);

      const vaultStateAfter = await vault.vaultState();

      const checkPremiumsReceived = (val: string) => {
        console.log(`Premiums received ${val}`);
        return BigNumber.from(val).gte("25075184391665341732348");
      };

      const checkCapitalUsed = (val: string) => {
        return BigNumber.from(val).eq(
          BigNumber.from(strategyDetail.size.toString()).mul(2)
        );
      };

      const checkPremiumExchangeValue = (val: string) => {
        console.log(`Premiums exchange: ${val}`);
        return BigNumber.from(val).gte("13024350046259892330");
      };

      await expect(tradeTransaction)
        .to.emit(vault, "Trade")
        .withArgs(
          randomUser.address,
          1,
          2,
          checkPremiumsReceived,
          checkCapitalUsed,
          checkPremiumExchangeValue
        );

      const strategySETHBalanceAfter = await seth.balanceOf(strategy.address);
      console.log(
        "strategySETHBalanceAfter:",
        ethers.utils.formatEther(strategySETHBalanceAfter)
      );
      const strategySUSDBalanceAfter = await susd.balanceOf(strategy.address);
      console.log(
        "strategySUSDBalanceAfter:",
        ethers.utils.formatEther(strategySUSDBalanceAfter)
      );

      console.log(
        "locked amount left before:",
        ethers.utils.formatEther(vaultStateBefore.lockedAmountLeft)
      );

      console.log(
        "locked amount left after:",
        ethers.utils.formatEther(vaultStateAfter.lockedAmountLeft)
      );

      // check state.lockAmount left is updated
      expect(
        vaultStateBefore.lockedAmountLeft.sub(vaultStateAfter.lockedAmountLeft)
      ).to.equal(BigNumber.from(strategyDetail.size.toString()).mul(2));
      // check that we receive sUSD
      expect(strategySUSDBalanceAfter.sub(strategySUSDBalanceBefore)).to.be.gt(
        0
      );

      // active strike is updated
      // const storedStrikeId1 = await strategy.activeStrikeIds(0);
      // expect(storedStrikeId1.eq(strikeObj1.id)).to.be.true;
      // const storedStrikeId2 = await strategy.activeStrikeIds(1);
      // expect(storedStrikeId2.eq(strikeObj2.id)).to.be.true;

      // check that position size is correct
      // const positionId1 = await strategy.strikeToPositionId(storedStrikeId1);
      // const [position1] = await lyraTestSystem.optionToken.getOptionPositions([positionId1]);
      // const positionId2 = await strategy.strikeToPositionId(storedStrikeId2);
      // const [position2] = await lyraTestSystem.optionToken.getOptionPositions([positionId2]);

      //expect(strategySUSDBalanceAfter.sub(strategySUSDBalanceBefore).gt(0)).to.be.true;

      // expect(position1.amount.sub(strategyDetail.size).gt(0)).to.be.true;
      // expect(position2.amount.sub(strategyDetail.size).gt(0)).to.be.true;

      //expect(position1.amount.eq(strategyDetail.size)).to.be.true;
      //expect(position1.collateral.eq(collateralToAdd1)).to.be.true;
      //expect(position2.amount.eq(strategyDetail.size)).to.be.true;
      //expect(position2.collateral.eq(collateralToAdd2)).to.be.true;
    });

    // it('should  revert when user try to make another trade during same period', async () => {
    //   await expect(vault.connect(randomUser).trade(strategyDetail.size)).to.be.revertedWith('Wait for options to settle');
    // });

    const additionalDepositAmount = toBN("25000");
    it("can add more deposit during the round", async () => {
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

      // settle all positions, from 1 to highest position
      const totalPositions = (await lyraTestSystem.optionToken.nextId())
        .sub(1)
        .toNumber();
      const idsToSettle = Array.from(
        { length: totalPositions },
        (_, i) => i + 1
      ); // create array of [1... totalPositions]
      await lyraTestSystem.shortCollateral.settleOptions(idsToSettle);

      const sethInStrategyAfterSettlement = await seth.balanceOf(
        strategy.address
      );

      // collateral should be back into the strategy after settlement
      expect(sethInStrategyAfterSettlement.sub(sethInStrategyBefore).gt(0)).to
        .be.true;

      await vault.closeRound();

      const sethInStrategyAfter = await seth.balanceOf(strategy.address);
      const sethInVaultAfter = await seth.balanceOf(vault.address);

      // strategy should be empty after close round
      expect(sethInStrategyAfter.isZero()).to.be.true;

      // all sUSD in strategy should go back to the vault
      expect(
        sethInVaultAfter
          .sub(sethInVaultBefore)
          .eq(sethInStrategyAfterSettlement)
      );
    });
  });
});
