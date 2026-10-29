import manifestJson from "../config/chikyuV2.json";

export type ContractName = "Token" | "Equity" | "PositionRoller" | "Savings" | "MintingHub" | "Bridge";

export type CurrencyManifest = {
  code: string;
  addresses: Record<ContractName, `0x${string}`>;
  startBlocks: Record<ContractName, number>;
};

export const manifest = manifestJson as {
  schema: "imf.ponder-registry.v1";
  chainId: 6281971;
  network: "chikyuV2";
  generatedAt: string;
  currencies: CurrencyManifest[];
};

export const currencyCodes = manifest.currencies.map(({ code }) => code);

export function currencyForAddress(address: string) {
  const normalized = address.toLowerCase();
  return manifest.currencies.find(({ addresses }) =>
    Object.values(addresses).some((candidate) => candidate.toLowerCase() === normalized),
  )?.code;
}

export const earliestStartBlock = Math.min(
  ...manifest.currencies.flatMap(({ startBlocks }) => Object.values(startBlocks)),
);
