import { index, onchainTable } from "ponder";

export const protocolEvent = onchainTable(
  "protocol_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    code: t.text().notNull(),
    contract: t.text().notNull(),
    event: t.text().notNull(),
    address: t.hex().notNull(),
    subject: t.hex(),
    args: t.text().notNull(),
    amount: t.bigint(),
    secondaryAmount: t.bigint(),
    tertiaryAmount: t.bigint(),
    transactionHash: t.hex().notNull(),
    blockNumber: t.bigint().notNull(),
    blockHash: t.hex().notNull(),
    blockTimestamp: t.bigint().notNull(),
    logIndex: t.integer().notNull(),
  }),
  (table) => ({
    codeBlockIdx: index().on(table.code, table.blockNumber),
    transactionIdx: index().on(table.transactionHash),
  }),
);

export const position = onchainTable(
  "position",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    code: t.text().notNull(),
    address: t.hex().notNull(),
    owner: t.hex().notNull(),
    original: t.hex().notNull(),
    collateral: t.hex().notNull(),
    openedTransactionHash: t.hex().notNull(),
    openedBlock: t.bigint().notNull(),
    openedTimestamp: t.bigint().notNull(),
    lastCollateral: t.bigint(),
    lastPrice: t.bigint(),
    lastMinted: t.bigint(),
    lastUpdateBlock: t.bigint(),
    lastUpdateTimestamp: t.bigint(),
  }),
  (table) => ({
    codeIdx: index().on(table.code),
    addressIdx: index().on(table.address),
  }),
);

export const challenge = onchainTable(
  "challenge",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    code: t.text().notNull(),
    index: t.bigint().notNull(),
    position: t.hex().notNull(),
    challenger: t.hex().notNull(),
    size: t.bigint().notNull(),
    status: t.text().notNull(),
    startedTransactionHash: t.hex().notNull(),
    startedBlock: t.bigint().notNull(),
    startedTimestamp: t.bigint().notNull(),
    bid: t.bigint(),
    acquiredCollateral: t.bigint(),
    terminalTransactionHash: t.hex(),
    terminalBlock: t.bigint(),
  }),
  (table) => ({
    codeIdx: index().on(table.code),
    positionIdx: index().on(table.position),
  }),
);

export const heartbeat = onchainTable("index_heartbeat", (t) => ({
  id: t.text().primaryKey(),
  chainId: t.integer().notNull(),
  blockNumber: t.bigint().notNull(),
  blockHash: t.hex().notNull(),
  blockTimestamp: t.bigint().notNull(),
}));
