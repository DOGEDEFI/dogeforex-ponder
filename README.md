# dogeforex-ponder

Ponder indexer for all 12 DogeForex V2 currency systems on DogeOS Chikyū testnet (chain `6281971`). It provides a shared schema, Ponder GraphQL and a read-only REST API for the IMF dashboard. The generated manifest contains all 12 deployed systems, including CHF.

Mechanism descended from [Frankencoin (ZCHF)](https://github.com/Frankencoin-ZCHF/FrankenCoin) — MIT license, audit lineage tracked in `docs/LINEAGE.md` as the codebase matures.

## Architecture

- `scripts/generate-manifest.mjs` reads every actual frontend registry and resolves each deployment receipt into `config/chikyuV2.json`. No V1 addresses or undeployed CHF placeholders are used.
- `ponder.config.ts` indexes all hubs, tokens, bridges, savings/leadrate, equity and rollers, plus dynamically discovered Position contracts separately for each currency.
- `ponder.schema.ts` stores raw integer amounts, decoded argument JSON, currency/contract/event identity, and transaction/block/log provenance. Positions and challenges also have indexed read models.
- `src/index.ts` handles position/challenge lifecycle, `MintingUpdate`, token transfers/minters, bridge flows, savings, equity, leadrate and rolling events. A block heartbeat exposes synchronization progress.
- `src/api/index.ts` exposes `/indexer/health`, `/indexer/:code/positions`, `/indexer/:code/challenges`, and `/indexer/:code/events` with optional `fromBlock`, `toBlock`, `contract`, `event`, and `limit` filters. Ponder's generated GraphQL endpoint is at `/graphql`.
- PGlite persists under `.ponder/pglite` by default. Use Postgres for a hosted persistent deployment. CORS allows the app origin and local app preview only.

The indexer is a historical/event source, not an oracle or current-state authority. The dashboard continues to verify registries and read current token, bridge, savings, equity, position and challenge state directly from contracts. Reference prices, executable liquidity, DEX volume/depth and FX conversion require separate provenance-bearing adapters. No signing or transaction capability belongs here.

## Commands

Use Node 22.12 or newer in the Node 22 series.

```sh
npm install
cp .env.example .env
npm run generate:manifest
npx ponder codegen
npm run typecheck
npm run dev
```

The default API is `http://127.0.0.1:42069`. `PONDER_RPC_URL_6281971` may select another DogeOS endpoint without embedding credentials in the public frontend. `IMF_INDEXER_ALLOWED_ORIGINS` is a comma-separated browser-origin allowlist.

After the backfill is current, reconcile all indexed positions and challenges against direct RPC discovery:

```sh
npm run reconcile
npm audit --omit=dev
```

`INDEXER_URL` overrides the reconciliation API origin. The command fails on any missing or extra position/challenge and prints per-currency counts plus indexer health. Check GraphQL independently, for example:

```graphql
query {
  positions(where: { code: "USD" }, orderBy: "openedBlock", orderDirection: "desc") {
    items { code address owner openedBlock lastMinted }
    totalCount
  }
}
```

For the dashboard, set `IMF_INDEXER_URL` when building `dogeforex-ui/imf-v2`. Local HTTP is allowed only on localhost; public packaging requires HTTPS. The public runtime has no indexer URL by default, so indexed history remains disabled until a persistent hosted service is explicitly configured and reconciled.

Status: **implemented local MVP; hosted deployment and production readiness are not claimed.**
