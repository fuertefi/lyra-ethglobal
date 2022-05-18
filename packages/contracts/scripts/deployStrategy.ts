import { lyraConstants, TestSystem } from '@lyrafinance/protocol';
import { toBN } from '@lyrafinance/protocol/dist/scripts/util/web3utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { HackMoneyStrategy, HackMoneyVault } from '../typechain-types';
import { HackMoneyStrategyDetailStruct } from '../typechain-types/HackMoneyStrategy';

// Lyra Testnet deployment addresses: https://raw.githubusercontent.com/lyra-finance/lyra-protocol/avalon/deployments/kovan-ovm/lyra.realPricing.json

const strategyDetail: HackMoneyStrategyDetailStruct = {
  maxVolVariance: toBN('0.1'),
  gwavPeriod: 600,
  minTimeToExpiry: lyraConstants.DAY_SEC,
  maxTimeToExpiry: lyraConstants.WEEK_SEC * 2,
  mintargetDelta: toBN('0.15'),
  maxtargetDelta: toBN('0.85'),
  maxDeltaGap: toBN('0.25'), // accept delta from 0.10~0.20 or 0.80~0.90
  minVol: toBN('0.8'), // min vol to sell. (also used to calculate min premium for call selling vault)
  maxVol: toBN('1.3'), // max vol to sell.
  size: toBN('15'),
};

// 1- Deploy HackMoneyVault
// Params : 1- address susd = 0xd30a35282c2e2db07d9dac69bf3d45a975bc85d1
//          2- address _feeRecipient = address
//          3- uint _roundDuration,  = lyraConstants.DAY_SEC * 7
//          4- string memory _tokenName = "HackMoneyStrategy"
//          5- string memory _tokenSymbol = "HMS"
//          6- Vault.VaultParams memory _vaultParams = {decimals,cap,seth.address} = {18, 5M, 0x13414675E6E4e74Ef62eAa9AC81926A3C1C7794D}

// 2- Deploy Strategy
// Params: 1- HackMoneyVault _vault
//         2- OptionType _optionType
//         3- GWAVOracle _gwavOracle

// Vault Constructor params
const susd_address = '0xd30a35282c2e2db07d9dac69bf3d45a975bc85d1';
const seth_address = '0x13414675E6E4e74Ef62eAa9AC81926A3C1C7794D';
const cap = ethers.utils.parseEther('5000000'); // 5m USD as cap
const decimals = 18;

// Strategy Constructor params
const optionType = TestSystem.OptionType.SHORT_CALL_BASE;
const gwavOracleAddress = '0x806b9d822013B8F82cC8763DCC556674853905d5';

async function main() {
  //  assign some roles
  let deployer: SignerWithAddress;
  let manager: SignerWithAddress;

  const addresses = await ethers.getSigners();
  deployer = addresses[0];
  manager = addresses[1];

  // First deploy the vault
  const LyraVault = await ethers.getContractFactory('HackMoneyVault');

  let vault: HackMoneyVault;

  vault = (await LyraVault.connect(manager).deploy(
    susd_address,
    manager.address, // feeRecipient, change it with another address if you wish
    lyraConstants.DAY_SEC * 7,
    'HackMoney Vault Share',
    'HM-VS',
    {
      decimals,
      cap,
      asset: seth_address, // collateral asset
    },
  )) as HackMoneyVault;

  console.log('Vault deployed at:', vault.address);

  let strategy: HackMoneyStrategy;

  //   const gwavOracleContract = await ethers.getContractFactory('GWAVOracle');
  //   const gwavOracle = await gwavOracleContract.attach(gwavOracleAddress);

  strategy = (await (await ethers.getContractFactory('HackMoneyStrategy'))
    .connect(manager)
    .deploy(vault.address, optionType, gwavOracleAddress)) as HackMoneyStrategy;

  console.log('Strategy deployed at:', strategy.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
