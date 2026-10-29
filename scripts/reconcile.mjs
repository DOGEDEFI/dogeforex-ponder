import { readFile } from "node:fs/promises";
import { createPublicClient, http, parseAbiItem } from "viem";

const manifest = JSON.parse(await readFile(new URL("../config/chikyuV2.json", import.meta.url), "utf8"));
const indexerUrl = (process.env.INDEXER_URL ?? "http://127.0.0.1:42069").replace(/\/$/, "");
const rpcUrl = process.env.PONDER_RPC_URL_6281971 ?? "https://rpc.testnet.dogeos.com";
const client = createPublicClient({ transport: http(rpcUrl) });
const positionOpened = parseAbiItem("event PositionOpened(address indexed owner, address indexed position, address original, address collateral)");
const challengeStarted = parseAbiItem("event ChallengeStarted(address indexed challenger, address indexed position, uint256 size, uint256 number)");
const chunkSize = 10_000n;
const latestBlock = await client.getBlockNumber();

async function logs(address, event, startBlock) {
  const rows = [];
  for (let fromBlock = BigInt(startBlock); fromBlock <= latestBlock; fromBlock += chunkSize) {
    const toBlock = fromBlock + chunkSize - 1n > latestBlock ? latestBlock : fromBlock + chunkSize - 1n;
    rows.push(...await client.getLogs({ address, event, fromBlock, toBlock }));
  }
  return rows;
}

async function indexed(path) {
  const response = await fetch(`${indexerUrl}${path}`);
  if (!response.ok) throw new Error(`${path}: indexer HTTP ${response.status}`);
  return response.json();
}

const currencies = [];
for (const currency of manifest.currencies) {
  const [positionLogs, challengeLogs, indexedPositions, indexedChallenges] = await Promise.all([
    logs(currency.addresses.MintingHub, positionOpened, currency.startBlocks.MintingHub),
    logs(currency.addresses.MintingHub, challengeStarted, currency.startBlocks.MintingHub),
    indexed(`/indexer/${currency.code}/positions`),
    indexed(`/indexer/${currency.code}/challenges`),
  ]);
  const directPositions = positionLogs.map((log) => log.args.position.toLowerCase()).sort();
  const storedPositions = indexedPositions.positions.map((row) => row.address.toLowerCase()).sort();
  const directChallengeIds = challengeLogs.map((log) => log.args.number.toString()).sort();
  const storedChallengeIds = indexedChallenges.challenges.map((row) => row.index).sort();
  const ok = JSON.stringify(directPositions) === JSON.stringify(storedPositions)
    && JSON.stringify(directChallengeIds) === JSON.stringify(storedChallengeIds);
  currencies.push({
    code: currency.code,
    ok,
    directPositions: directPositions.length,
    indexedPositions: storedPositions.length,
    directChallenges: directChallengeIds.length,
    indexedChallenges: storedChallengeIds.length,
  });
  if (!ok) {
    console.error(JSON.stringify({ code: currency.code, directPositions, storedPositions, directChallengeIds, storedChallengeIds }, null, 2));
    throw new Error(`${currency.code}: indexed discovery differs from direct RPC`);
  }
  console.log(`${currency.code}: ${storedPositions.length} positions and ${storedChallengeIds.length} challenges match RPC`);
}

const health = await indexed("/indexer/health");
const ok = currencies.every((currency) => currency.ok) && currencies.length === 12;
console.log(JSON.stringify({ ok, latestBlock: latestBlock.toString(), indexer: health, currencies }, null, 2));
if (!ok) process.exitCode = 1;
