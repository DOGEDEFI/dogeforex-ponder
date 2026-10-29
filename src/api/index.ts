import { and, desc, eq, graphql, gte, lte } from "ponder";
import { db, publicClients } from "ponder:api";
import schema, { challenge, heartbeat, position, protocolEvent } from "ponder:schema";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { manifest } from "../manifest";

const app = new Hono();
const allowedOrigins = (process.env.IMF_INDEXER_ALLOWED_ORIGINS ?? "https://app.imf.li,http://127.0.0.1:5182,http://localhost:5182")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsPolicy = cors({
  origin: (origin) => allowedOrigins.includes(origin) ? origin : undefined,
  allowHeaders: ["Content-Type"],
  allowMethods: ["GET", "POST"],
});

app.use("/indexer/*", corsPolicy);
app.use("/graphql", corsPolicy);
app.use("/graphql", graphql({ db, schema }));

const json = (value: unknown) => JSON.parse(JSON.stringify(value, (_, entry) =>
  typeof entry === "bigint" ? entry.toString() : entry,
));

function currency(code: string) {
  return manifest.currencies.find((candidate) => candidate.code === code.toUpperCase());
}

function optionalBigint(value: string | undefined, label: string) {
  if (value === undefined || value === "") return undefined;
  try {
    const parsed = BigInt(value);
    if (parsed < 0n) throw new Error("negative");
    return parsed;
  } catch {
    throw new Error(`${label} must be a nonnegative integer`);
  }
}

function result(c: any, value: unknown) {
  return c.json(json(value));
}

app.get("/indexer/health", async (c) => {
  const [latest] = await db.select().from(heartbeat).where(eq(heartbeat.chainId, 6281971)).limit(1);
  const latestChainBlock = await publicClients.chikyu.getBlockNumber();
  const positions = await db.select({ code: position.code, address: position.address }).from(position);
  return result(c, {
    schema: "imf.indexer-health.v1",
    chainId: 6281971,
    network: "chikyuV2",
    latestIndexedBlock: latest?.blockNumber ?? null,
    latestIndexedTimestamp: latest?.blockTimestamp ?? null,
    latestChainBlock,
    lagBlocks: latest ? latestChainBlock - latest.blockNumber : null,
    currencies: manifest.currencies.map((entry) => ({
      code: entry.code,
      startBlocks: entry.startBlocks,
      discoveredPositions: positions.filter((item) => item.code === entry.code).length,
    })),
  });
});

app.get("/indexer/:code/positions", (c) => {
  const entry = currency(c.req.param("code"));
  if (!entry) return c.json({ error: "Unknown currency" }, 404);
  return db.select().from(position)
    .where(eq(position.code, entry.code))
    .orderBy(desc(position.openedBlock))
    .limit(1000)
    .then((rows) => result(c, {
      schema: "imf.indexer-positions.v1",
      code: entry.code,
      positions: rows,
    }));
});

app.get("/indexer/:code/challenges", (c) => {
  const entry = currency(c.req.param("code"));
  if (!entry) return c.json({ error: "Unknown currency" }, 404);
  return db.select().from(challenge)
    .where(eq(challenge.code, entry.code))
    .orderBy(desc(challenge.startedBlock))
    .limit(1000)
    .then((rows) => result(c, {
      schema: "imf.indexer-challenges.v1",
      code: entry.code,
      challenges: rows,
    }));
});

app.get("/indexer/:code/events", async (c) => {
  const entry = currency(c.req.param("code"));
  if (!entry) return c.json({ error: "Unknown currency" }, 404);
  try {
    const fromBlock = optionalBigint(c.req.query("fromBlock"), "fromBlock");
    const toBlock = optionalBigint(c.req.query("toBlock"), "toBlock");
    const requestedLimit = Number(c.req.query("limit") ?? "500");
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) throw new Error("limit must be a positive integer");
    const limit = Math.min(requestedLimit, 5000);
    const conditions = [eq(protocolEvent.code, entry.code)];
    if (fromBlock !== undefined) conditions.push(gte(protocolEvent.blockNumber, fromBlock));
    if (toBlock !== undefined) conditions.push(lte(protocolEvent.blockNumber, toBlock));
    if (c.req.query("contract")) conditions.push(eq(protocolEvent.contract, c.req.query("contract")!));
    if (c.req.query("event")) conditions.push(eq(protocolEvent.event, c.req.query("event")!));
    const rows = await db.select().from(protocolEvent)
      .where(and(...conditions))
      .orderBy(desc(protocolEvent.blockNumber), desc(protocolEvent.logIndex))
      .limit(limit);
    return result(c, {
      schema: "imf.indexer-events.v1",
      code: entry.code,
      coverage: { fromBlock: fromBlock ?? null, toBlock: toBlock ?? null, limit },
      events: rows,
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});

export default app;
