import { createConfig, factory } from "ponder";
import {
  bridgeAbi,
  equityAbi,
  leadrateAbi,
  mintingHubAbi,
  positionAbi,
  positionOpenedEvent,
  rollerAbi,
  savingsAbi,
  tokenAbi,
} from "./src/abis";
import { earliestStartBlock, manifest, type ContractName } from "./src/manifest";

const addresses = (name: ContractName) => manifest.currencies.map((currency) => currency.addresses[name]);
const startBlock = (name: ContractName) => Math.min(...manifest.currencies.map((currency) => currency.startBlocks[name]));

const positionContracts = Object.fromEntries(
  manifest.currencies.map((currency) => [
    `Position${currency.code}`,
    {
      abi: positionAbi,
      chain: "chikyu",
      address: factory({
        address: currency.addresses.MintingHub,
        event: positionOpenedEvent,
        parameter: "position",
      }),
      startBlock: currency.startBlocks.MintingHub,
    },
  ]),
);

export default createConfig({
  database: {
    kind: "pglite",
    directory: "./.ponder/pglite",
  },
  chains: {
    chikyu: {
      id: 6281971,
      rpc: process.env.PONDER_RPC_URL_6281971 ?? "https://rpc.testnet.dogeos.com",
      pollingInterval: 5_000,
      ethGetLogsBlockRange: 10_000,
    },
  },
  contracts: {
    MintingHubs: {
      abi: mintingHubAbi,
      chain: "chikyu",
      address: addresses("MintingHub"),
      startBlock: startBlock("MintingHub"),
    },
    Bridges: {
      abi: bridgeAbi,
      chain: "chikyu",
      address: addresses("Bridge"),
      startBlock: startBlock("Bridge"),
    },
    Savings: {
      abi: savingsAbi,
      chain: "chikyu",
      address: addresses("Savings"),
      startBlock: startBlock("Savings"),
    },
    Equity: {
      abi: equityAbi,
      chain: "chikyu",
      address: addresses("Equity"),
      startBlock: startBlock("Equity"),
    },
    Leadrate: {
      abi: leadrateAbi,
      chain: "chikyu",
      address: addresses("Savings"),
      startBlock: startBlock("Savings"),
    },
    PositionRollers: {
      abi: rollerAbi,
      chain: "chikyu",
      address: addresses("PositionRoller"),
      startBlock: startBlock("PositionRoller"),
    },
    Tokens: {
      abi: tokenAbi,
      chain: "chikyu",
      address: addresses("Token"),
      startBlock: startBlock("Token"),
    },
    ...positionContracts,
  },
  blocks: {
    IndexHeartbeat: {
      chain: "chikyu",
      startBlock: earliestStartBlock,
      interval: 50,
    },
  },
});
