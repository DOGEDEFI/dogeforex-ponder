import { parseAbi, parseAbiItem } from "viem";

export const positionOpenedEvent = parseAbiItem(
  "event PositionOpened(address indexed owner, address indexed position, address original, address collateral)",
);

export const mintingHubAbi = parseAbi([
  "event PositionOpened(address indexed owner, address indexed position, address original, address collateral)",
  "event ChallengeStarted(address indexed challenger, address indexed position, uint256 size, uint256 number)",
  "event ChallengeAverted(address indexed position, uint256 number, uint256 size)",
  "event ChallengeSucceeded(address indexed position, uint256 number, uint256 bid, uint256 acquiredCollateral, uint256 challengeSize)",
  "event PostPonedReturn(address collateral, address indexed beneficiary, uint256 amount)",
  "event ForcedSale(address pos, uint256 amount, uint256 priceE36MinusDecimals)",
]);

export const positionAbi = parseAbi([
  "event MintingUpdate(uint256 collateral, uint256 price, uint256 minted)",
  "event PositionDenied(address indexed sender, string message)",
]);

export const bridgeAbi = parseAbi([
  "event Mint(address indexed target, uint256 amount)",
  "event Burn(address indexed holder, uint256 amount)",
  "event Credit(address indexed target, uint256 amount)",
  "event Payout(address indexed target, uint256 amount)",
]);

export const savingsAbi = parseAbi([
  "event Saved(address indexed account, uint192 amount)",
  "event InterestCollected(address indexed account, uint256 interest)",
  "event Withdrawn(address indexed account, uint192 amount)",
]);

export const equityAbi = parseAbi([
  "event Delegation(address indexed from, address indexed to)",
  "event Trade(address who, int256 amount, uint256 totPrice, uint256 newprice)",
]);

export const leadrateAbi = parseAbi([
  "event RateProposed(address who, uint24 nextRate, uint40 nextChange)",
  "event RateChanged(uint24 newRate)",
]);

export const rollerAbi = parseAbi([
  "event Roll(address source, uint256 collWithdraw, uint256 repay, address target, uint256 collDeposit, uint256 mint)",
]);

export const tokenAbi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event MinterApplied(address indexed minter, uint256 applicationPeriod, uint256 applicationFee, string message)",
  "event MinterDenied(address indexed minter, string message)",
  "event Loss(address indexed reportingMinter, uint256 amount)",
  "event Profit(address indexed reportingMinter, uint256 amount)",
]);
