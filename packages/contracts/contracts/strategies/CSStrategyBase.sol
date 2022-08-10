//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// Hardhat
import "hardhat/console.sol";

// Lyra
import {LyraAdapter} from "@lyrafinance/protocol/contracts/periphery/LyraAdapter.sol";

// Libraries
import {Vault} from "../libraries/Vault.sol";
import {IDelegateApprovals} from "../interfaces/IDelegateApprovals.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CSVault} from "../core/CSVault.sol";
import {DecimalMath} from "@lyrafinance/protocol/contracts/synthetix/DecimalMath.sol";
import {SignedDecimalMath} from "@lyrafinance/protocol/contracts/synthetix/SignedDecimalMath.sol";

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract CSStrategyBase is LyraAdapter, Initializable {
  using DecimalMath for uint;
  using SignedDecimalMath for int;

  // example strategy detail
  struct StrategyDetail {
    uint minTimeToExpiry;
    uint maxTimeToExpiry;
    int mintargetDelta; // 15%
    int maxtargetDelta; // 85%
    uint maxDeltaGap; // 5%
    uint minVol; // 80%
    uint maxExchangeFeeRate;
    uint iterations; // 0.5%?
  }

  OptionType public optionType;
  CSVault vault;
  StrategyDetail public strategyDetail;

  uint public currentBoardId;
  uint public activeExpiry;
  uint public ivLimit;
  address public lyraRewardRecipient;

  /// @dev asset used as collateral in AMM to sell. Should be the same as vault asset
  /// TODO: make it immutable
  IERC20 public collateralAsset;

  mapping(uint => uint) public lastTradeTimestamp;

  uint[] public activeStrikeIds;
  mapping(uint => uint) public strikeToPositionId;

  ///////////
  // ADMIN //
  ///////////

  modifier onlyVault() virtual {
    require(msg.sender == address(vault), "only Vault");
    _;
  }

  // TODO: Remove constructor at all?
  constructor(CSVault _vault) LyraAdapter() {
    vault = _vault;
    optionType = OptionType.SHORT_CALL_BASE;
  }

  function initializeBase(CSVault _vault) public onlyInitializing {
    vault = _vault;
    optionType = OptionType.SHORT_CALL_BASE;
  }

  function initAdapter(
    address _lyraRegistry,
    address _optionMarket,
    address _curveSwap,
    address _feeCounter
  ) external onlyOwner {
    // set addresses for LyraAdapter
    setLyraAddresses(_lyraRegistry, _optionMarket, _curveSwap, _feeCounter);

    quoteAsset.approve(address(vault), type(uint).max);
    baseAsset.approve(address(vault), type(uint).max);
    // IDelegateApprovals(0x2A23bc0EA97A89abD91214E8e4d20F02Fe14743f)
    // .approveExchangeOnBehalf(0xbfa31380ED380cEb325153eA08f296A45A489108);
    collateralAsset = _isBaseCollat() ? IERC20(address(baseAsset)) : IERC20(address(quoteAsset));
  }

  //////////////////////////
  // GENERAL PARAMS SETTERS//
  //////////////////////////

  /**
   * @dev update lyra reward recipient
   */
  function setLyraRewardRecipient(address _lyraRewardRecipient) external onlyOwner {
    lyraRewardRecipient = _lyraRewardRecipient;
  }

  /**
   * @dev update the iv limit
   */
  function setIvLimit(uint _ivLimit) external onlyOwner {
    ivLimit = _ivLimit;
  }

  /**
   * @dev set the board id that will be traded for the next round
   * @param boardId lyra board Id.
   */
  function setBoard(uint boardId) external onlyVault {
    Board memory board = _getBoard(boardId);
    require(_isValidExpiry(board.expiry), "invalid board");
    activeExpiry = board.expiry;
    currentBoardId = boardId;
  }

  /**
   * @dev update the strategy detail for the new round.
   */
  function setStrategyDetail(StrategyDetail memory _strategyDetail) external onlyOwner {
    (, , , , , , , bool roundInProgress) = vault.vaultState();
    require(!roundInProgress, "cannot change strategy if round is active");
    strategyDetail = _strategyDetail;
  }

  //////////////////////
  // APPROVAL ACTIONS //
  //////////////////////

  function approveERC20(
    address token,
    address spender,
    uint amount
  ) external onlyOwner {
    IERC20(token).approve(spender, amount);
  }

  function approveSynthetixDelegate(address delegateApprovals, address exchanger) external onlyOwner {
    IDelegateApprovals(delegateApprovals).approveExchangeOnBehalf(exchanger);
  }

  ///////////////////
  // VAULT ACTIONS //
  ///////////////////

  /**
   * @dev exchange asset back to collateral asset and send it back to the vault
   * @dev override this function if you want to customize asset management flow
   */
  function _returnFundsToVault() internal virtual {
    ExchangeRateParams memory exchangeParams = _getExchangeParams();
    uint quoteBal = quoteAsset.balanceOf(address(this));

    if (_isBaseCollat()) {
      // exchange quote asset to base asset, and send base asset back to vault
      uint baseBal = baseAsset.balanceOf(address(this));
      uint minQuoteExpected = quoteBal.divideDecimal(exchangeParams.spotPrice).multiplyDecimal(
        DecimalMath.UNIT - exchangeParams.baseQuoteFeeRate
      );
      uint baseReceived = _exchangeFromExactQuote(quoteBal, minQuoteExpected);
      require(baseAsset.transfer(address(vault), baseBal + baseReceived), "failed to return funds from strategy");
    } else {
      // send quote balance directly
      require(quoteAsset.transfer(address(vault), quoteBal), "failed to return funds from strategy");
    }
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

  /////////////////////////////
  // Trade Parameter Helpers //
  /////////////////////////////

  /**
   * @dev get minimum premium that the vault should receive.
   * param listingId lyra option listing id
   * param size size of trade in Lyra standard sizes
   */
  function _getPremiumLimit(
    Strike memory strike,
    uint vol,
    uint size
  ) internal view returns (uint limitPremium) {
    ExchangeRateParams memory exchangeParams = _getExchangeParams();
    (uint callPremium, uint putPremium) = _getPurePremium(
      _getSecondsToExpiry(strike.expiry),
      vol,
      exchangeParams.spotPrice,
      strike.strikePrice
    );

    limitPremium = _isCall() ? callPremium.multiplyDecimal(size) : putPremium.multiplyDecimal(size);
  }

  //////////////////////////////
  // Active Strike Management //
  //////////////////////////////

  /**
   * @dev add strike id to activeStrikeIds array
   */
  function _addActiveStrike(uint strikeId, uint tradedPositionId) internal {
    if (!_isActiveStrike(strikeId)) {
      strikeToPositionId[strikeId] = tradedPositionId;
      activeStrikeIds.push(strikeId);
      console.log("Adding active strike with id:", strikeId);
    }
  }

  /**
   * @dev add the last traded timestamp for a specific strike.
   */
  function _setLastTradedAt(uint strikeId, uint timestamp) internal {
    lastTradeTimestamp[strikeId] = timestamp;
  }

  /**
   * @dev remove position data opened in the current round.
   * this can only be called after the position is settled by lyra
   **/
  function _clearAllActiveStrikes() internal {
    if (activeStrikeIds.length != 0) {
      for (uint i = 0; i < activeStrikeIds.length; i++) {
        uint strikeId = activeStrikeIds[i];
        OptionPosition memory position = _getPositions(_toDynamic(strikeToPositionId[strikeId]))[0];
        // revert if position state is not settled
        require(position.state != PositionState.ACTIVE, "cannot clear active position");
        delete strikeToPositionId[strikeId];
        delete lastTradeTimestamp[strikeId];
      }
      delete activeStrikeIds;
    }
  }

  function _isActiveStrike(uint strikeId) internal view returns (bool isActive) {
    isActive = strikeToPositionId[strikeId] != 0;
  }

  //////////////
  // Validation //
  ///////////////

  /**
   * @dev check if the expiry of the board is valid according to the strategy
   */
  function _isValidExpiry(uint expiry) public view returns (bool isValid) {
    uint secondsToExpiry = _getSecondsToExpiry(expiry);
    isValid = (secondsToExpiry >= strategyDetail.minTimeToExpiry && secondsToExpiry <= strategyDetail.maxTimeToExpiry);
  }

  function _isBaseCollat() internal view returns (bool isBase) {
    isBase = (optionType == OptionType.SHORT_CALL_BASE) ? true : false;
  }

  function _isCall() internal view returns (bool isCall) {
    isCall = (optionType == OptionType.SHORT_PUT_QUOTE || optionType == OptionType.LONG_PUT) ? false : true;
  }

  function _getSecondsToExpiry(uint expiry) internal view returns (uint) {
    require(block.timestamp <= expiry, "timestamp expired");
    return expiry - block.timestamp;
  }

  function _abs(int val) internal pure returns (uint) {
    return val >= 0 ? uint(val) : uint(-val);
  }

  function _min(uint x, uint y) internal pure returns (uint) {
    return (x < y) ? x : y;
  }

  function _max(uint x, uint y) internal pure returns (uint) {
    return (x > y) ? x : y;
  }

  // temporary fix - eth core devs promised Q2 2022 fix
  function _toDynamic(uint val) internal pure returns (uint[] memory dynamicArray) {
    dynamicArray = new uint[](1);
    dynamicArray[0] = val;
  }
}
