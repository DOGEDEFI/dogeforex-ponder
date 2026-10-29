import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimePath = resolve(root, "../dogeforex-ui/imf-v2/config/runtime.testnet.json");
const runtime = JSON.parse(await readFile(runtimePath, "utf8"));
const rpcUrl = process.env.PONDER_RPC_URL_6281971 ?? runtime.rpcUrl;
const contractNames = ["Token", "Equity", "PositionRoller", "Savings", "MintingHub", "Bridge"];

async function rpc(method, params, attempt = 0) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status} for ${method}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`RPC ${method}: ${JSON.stringify(payload.error)}`);
  return payload.result;
}

async function receiptBlock(transactionHash, attempt = 0) {
  try {
    const receipt = await rpc("eth_getTransactionReceipt", [transactionHash]);
    if (!receipt) throw new Error(`Deployment receipt unavailable: ${transactionHash}`);
    return Number(BigInt(receipt.blockNumber));
  } catch (error) {
    if (attempt >= 4) throw error;
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    return receiptBlock(transactionHash, attempt + 1);
  }
}

const currencies = [];
for (const registry of runtime.registry) {
  const startBlocks = {};
  for (const name of contractNames) {
    const transactionHash = registry.transactions?.deployments?.[name];
    if (!transactionHash) throw new Error(`${registry.code}: missing ${name} deployment transaction`);
    startBlocks[name] = await receiptBlock(transactionHash);
  }
  currencies.push({
    code: registry.code,
    addresses: Object.fromEntries(contractNames.map((name) => [name, registry.addresses[name]])),
    startBlocks,
  });
  console.log(`${registry.code}: deployment start blocks resolved`);
}

const manifest = {
  schema: "imf.ponder-registry.v1",
  chainId: 6281971,
  network: "chikyuV2",
  generatedAt: new Date().toISOString(),
  currencies,
};
const destination = resolve(root, "config/chikyuV2.json");
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
console.log(`Wrote ${currencies.length} currencies to config/chikyuV2.json`);
