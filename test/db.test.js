import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

// --- Fake @libsql/client/web so we never hit a real network/DB ---
const executedQueries = [];
function makeFakeClient(rows) {
  return {
    async execute(arg) {
      const sql = typeof arg === "string" ? arg : arg.sql;
      executedQueries.push(sql);
      return { rows };
    },
  };
}
let fakeClient = makeFakeClient([]);
mock.module("@libsql/client/web", {
  namedExports: {
    createClient: () => fakeClient,
  },
});

const FAKE_JSON_ROWS = [
  { symbol_key: "usd", title_fa: "دلار", price: "2,310,000", change_amount: "4,000", change_percent: "0.17%", updated_at: "2026-09-24 10:00:00" },
  { symbol_key: "eur", title_fa: "یورو", price: "2,651,000", change_amount: "0", change_percent: "0%", updated_at: "2026-09-24 10:00:00" },
];

const originalFetch = globalThis.fetch;
let fetchImpl = async () => ({ ok: true, json: async () => FAKE_JSON_ROWS });
globalThis.fetch = (...args) => fetchImpl(...args);

const env = { TURSO_DATABASE_URL: "libsql://fake.turso.io", TURSO_AUTH_TOKEN: "faketoken" };

test.after(() => {
  globalThis.fetch = originalFetch;
});

test("getItem/getItems/searchItems read from the cached data.json when the fetch succeeds", async () => {
  fetchImpl = async (url) => {
    assert.equal(url, "https://prices-landing-page.pages.dev/data.json");
    return { ok: true, json: async () => FAKE_JSON_ROWS };
  };
  // fresh module instance per test isn't trivial with ESM caching; instead we
  // just drive the already-imported module and rely on its 60s in-memory TTL
  // being long enough not to matter within a single fast test run.
  const db = await import("../src/bot/db.js");
  const usd = await db.getItem(env, "usd");
  assert.equal(usd.price, "2,310,000");

  const items = await db.getItems(env, ["eur", "usd", "does_not_exist"]);
  assert.deepEqual(items.map((i) => i.symbol_key), ["eur", "usd"]);

  const results = await db.searchItems(env, "یورو");
  assert.equal(results.length, 1);
  assert.equal(results[0].symbol_key, "eur");
});

test("falls back to Turso when data.json fetch fails and no warm cache exists", async () => {
  // یک ماژول db.js جداگانه (با ?fresh) تا کش درون‌حافظه‌ای تست قبلی تداخل نکند
  const db = await import("../src/bot/db.js?fresh1");
  fetchImpl = async () => {
    throw new Error("network down");
  };
  fakeClient = makeFakeClient([
    { symbol_key: "usd", title_fa: "دلار", price: "2,306,000", change_amount: "0", change_percent: "0%", updated_at: "2026-09-24 09:00:00" },
  ]);
  executedQueries.length = 0;

  const usd = await db.getItem(env, "usd");
  assert.equal(usd.price, "2,306,000");
  assert.ok(executedQueries.some((q) => q.includes("FROM market_prices")), "should have queried Turso as a fallback");
});

test("bale watchlist uses its own watchlist_bale table, never the telegram watchlist table", async () => {
  const baleDb = await import("../src/bale/db.js?fresh1");
  fakeClient = makeFakeClient([]);
  executedQueries.length = 0;

  await baleDb.addToWatchlist(env, 555, "usd");
  await baleDb.getWatchlistKeys(env, 555);
  await baleDb.isInWatchlist(env, 555, "usd");
  await baleDb.removeFromWatchlist(env, 555, "usd");

  assert.ok(executedQueries.length > 0);
  for (const sql of executedQueries) {
    assert.match(sql, /watchlist_bale/, `query must target watchlist_bale, got: ${sql}`);
    assert.doesNotMatch(sql, /\bwatchlist\s+WHERE\b|\bwatchlist\s*\(/i, `query must NOT target the plain telegram watchlist table: ${sql}`);
  }
});
