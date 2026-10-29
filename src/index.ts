import { ponder } from "ponder:registry";
import { challenge, heartbeat, position, protocolEvent } from "ponder:schema";
import { toEventSelector } from "viem";
import { bridgeAbi, equityAbi, leadrateAbi, mintingHubAbi, positionAbi, rollerAbi, savingsAbi, tokenAbi } from "./abis";
import { manifest, currencyForAddress } from "./manifest";

const chainId = 6281971;
const entityId = (code: string, address: string) => `${chainId}:${code}:${address.toLowerCase()}`;
const challengeId = (code: string, index: bigint) => `${chainId}:${code}:${index.toString()}`;
const eventNamesByTopic = new Map<string, string>();
for (const abi of [mintingHubAbi, positionAbi, bridgeAbi, savingsAbi, equityAbi, leadrateAbi, rollerAbi, tokenAbi]) {
  for (const item of abi) {
    if (item.type === "event") eventNamesByTopic.set(toEventSelector(item), item.name);
  }
}

function requireCode(address: string) {
  const code = currencyForAddress(address);
  if (!code) throw new Error(`No currency registry contains ${address}`);
  return code;
}

function rawArgs(args: object) {
  return JSON.stringify({ ...args }, (_, value) => typeof value === "bigint" ? value.toString() : value);
}

async function recordEvent(
  context: any,
  event: any,
  code: string,
  contract: string,
  subject?: `0x${string}`,
  amounts: { amount?: bigint; secondaryAmount?: bigint; tertiaryAmount?: bigint } = {},
) {
  const eventName = eventNamesByTopic.get(event.log.topics[0]);
  if (!eventName) throw new Error(`Unknown event topic ${event.log.topics[0]} at ${event.log.address}`);
  await context.db.insert(protocolEvent).values({
    id: event.id,
    chainId: context.chain.id,
    code,
    contract,
    event: eventName,
    address: event.log.address,
    subject,
    args: rawArgs(event.args),
    ...amounts,
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockHash: event.block.hash,
    blockTimestamp: event.block.timestamp,
    logIndex: event.log.logIndex,
  }).onConflictDoNothing();
}

ponder.on("MintingHubs:PositionOpened", async ({ event, context }) => {
  const code = requireCode(event.log.address);
  const id = entityId(code, event.args.position);
  await recordEvent(context, event, code, "MintingHub", event.args.position);
  await context.db.insert(position).values({
    id,
    chainId: context.chain.id,
    code,
    address: event.args.position,
    owner: event.args.owner,
    original: event.args.original,
    collateral: event.args.collateral,
    openedTransactionHash: event.transaction.hash,
    openedBlock: event.block.number,
    openedTimestamp: event.block.timestamp,
  }).onConflictDoNothing();
});

ponder.on("MintingHubs:ChallengeStarted", async ({ event, context }) => {
  const code = requireCode(event.log.address);
  await recordEvent(context, event, code, "MintingHub", event.args.position, { amount: event.args.size });
  await context.db.insert(challenge).values({
    id: challengeId(code, event.args.number),
    chainId: context.chain.id,
    code,
    index: event.args.number,
    position: event.args.position,
    challenger: event.args.challenger,
    size: event.args.size,
    status: "started",
    startedTransactionHash: event.transaction.hash,
    startedBlock: event.block.number,
    startedTimestamp: event.block.timestamp,
  }).onConflictDoUpdate({ status: "started", size: event.args.size });
});

ponder.on("MintingHubs:ChallengeAverted", async ({ event, context }) => {
  const code = requireCode(event.log.address);
  await recordEvent(context, event, code, "MintingHub", event.args.position, { amount: event.args.size });
  await context.db.update(challenge, { id: challengeId(code, event.args.number) }).set({
    status: "averted",
    terminalTransactionHash: event.transaction.hash,
    terminalBlock: event.block.number,
  });
});

ponder.on("MintingHubs:ChallengeSucceeded", async ({ event, context }) => {
  const code = requireCode(event.log.address);
  await recordEvent(context, event, code, "MintingHub", event.args.position, {
    amount: event.args.bid,
    secondaryAmount: event.args.acquiredCollateral,
    tertiaryAmount: event.args.challengeSize,
  });
  await context.db.update(challenge, { id: challengeId(code, event.args.number) }).set({
    status: "succeeded",
    bid: event.args.bid,
    acquiredCollateral: event.args.acquiredCollateral,
    terminalTransactionHash: event.transaction.hash,
    terminalBlock: event.block.number,
  });
});

ponder.on("MintingHubs:PostPonedReturn", async ({ event, context }) => {
  await recordEvent(context, event, requireCode(event.log.address), "MintingHub", event.args.beneficiary, { amount: event.args.amount });
});

ponder.on("MintingHubs:ForcedSale", async ({ event, context }) => {
  await recordEvent(context, event, requireCode(event.log.address), "MintingHub", event.args.pos, {
    amount: event.args.amount,
    secondaryAmount: event.args.priceE36MinusDecimals,
  });
});

for (const { code } of manifest.currencies) {
  ponder.on(`Position${code}:MintingUpdate` as any, async ({ event, context }: any) => {
    await recordEvent(context, event, code, "Position", event.log.address, {
      amount: event.args.minted,
      secondaryAmount: event.args.collateral,
      tertiaryAmount: event.args.price,
    });
    const id = entityId(code, event.log.address);
    const existing = await context.db.find(position, { id });
    if (existing) {
      await context.db.update(position, { id }).set({
        lastCollateral: event.args.collateral,
        lastPrice: event.args.price,
        lastMinted: event.args.minted,
        lastUpdateBlock: event.block.number,
        lastUpdateTimestamp: event.block.timestamp,
      });
    }
  });
  ponder.on(`Position${code}:PositionDenied` as any, async ({ event, context }: any) => {
    await recordEvent(context, event, code, "Position", event.log.address);
  });
}

for (const eventName of ["Mint", "Burn", "Credit", "Payout"] as const) {
  ponder.on(`Bridges:${eventName}`, async ({ event, context }) => {
    const subject = "target" in event.args ? event.args.target : event.args.holder;
    await recordEvent(context, event, requireCode(event.log.address), "StablecoinBridge", subject, { amount: event.args.amount });
  });
}

ponder.on("Savings:Saved", async ({ event, context }) => {
  await recordEvent(context, event, requireCode(event.log.address), "Savings", event.args.account, { amount: event.args.amount });
});
ponder.on("Savings:Withdrawn", async ({ event, context }) => {
  await recordEvent(context, event, requireCode(event.log.address), "Savings", event.args.account, { amount: event.args.amount });
});
ponder.on("Savings:InterestCollected", async ({ event, context }) => {
  await recordEvent(context, event, requireCode(event.log.address), "Savings", event.args.account, { amount: event.args.interest });
});

ponder.on("Equity:Trade", async ({ event, context }) => {
  await recordEvent(context, event, requireCode(event.log.address), "Equity", event.args.who, {
    amount: event.args.amount,
    secondaryAmount: event.args.totPrice,
    tertiaryAmount: event.args.newprice,
  });
});
ponder.on("Equity:Delegation", async ({ event, context }) => {
  await recordEvent(context, event, requireCode(event.log.address), "Equity", event.args.from);
});

ponder.on("Leadrate:RateProposed", async ({ event, context }) => {
  await recordEvent(context, event, requireCode(event.log.address), "Leadrate", event.args.who, {
    amount: BigInt(event.args.nextRate),
    secondaryAmount: BigInt(event.args.nextChange),
  });
});
ponder.on("Leadrate:RateChanged", async ({ event, context }) => {
  await recordEvent(context, event, requireCode(event.log.address), "Leadrate", undefined, { amount: BigInt(event.args.newRate) });
});

ponder.on("PositionRollers:Roll", async ({ event, context }) => {
  await recordEvent(context, event, requireCode(event.log.address), "PositionRoller", event.args.source, {
    amount: event.args.repay,
    secondaryAmount: event.args.collWithdraw,
    tertiaryAmount: event.args.mint,
  });
});

ponder.on("Tokens:Transfer", async ({ event, context }) => {
  await recordEvent(context, event, requireCode(event.log.address), "Token", event.args.to, { amount: event.args.value });
});
ponder.on("Tokens:MinterApplied", async ({ event, context }) => {
  await recordEvent(context, event, requireCode(event.log.address), "Token", event.args.minter, { amount: event.args.applicationFee });
});
ponder.on("Tokens:MinterDenied", async ({ event, context }) => {
  await recordEvent(context, event, requireCode(event.log.address), "Token", event.args.minter);
});
ponder.on("Tokens:Loss", async ({ event, context }) => {
  await recordEvent(context, event, requireCode(event.log.address), "Token", event.args.reportingMinter, { amount: event.args.amount });
});
ponder.on("Tokens:Profit", async ({ event, context }) => {
  await recordEvent(context, event, requireCode(event.log.address), "Token", event.args.reportingMinter, { amount: event.args.amount });
});

ponder.on("IndexHeartbeat:block", async ({ event, context }) => {
  await context.db.insert(heartbeat).values({
    id: String(context.chain.id),
    chainId: context.chain.id,
    blockNumber: event.block.number,
    blockHash: event.block.hash,
    blockTimestamp: event.block.timestamp,
  }).onConflictDoUpdate({
    blockNumber: event.block.number,
    blockHash: event.block.hash,
    blockTimestamp: event.block.timestamp,
  });
});
