import { createClient } from "@libsql/client/web";

let _client = null;
let _watchlistReady = false;

let _cachedPrices = null;
let _lastFetchTime = 0;
const CACHE_TTL_MS = 60000;

const DATA_JSON_URL = "https://prices-landing-page.pages.dev/data.json";

async function fetchAllPrices() {
  const now = Date.now();
  if (_cachedPrices && (now - _lastFetchTime < CACHE_TTL_MS)) {
    return _cachedPrices;
  }

  try {
    const response = await fetch(`${DATA_JSON_URL}?t=${now}`, {
      headers: { "Accept": "application/json" }
    });
    if (!response.ok) return _cachedPrices || [];
    
    const data = await response.json();
    if (Array.isArray(data)) {
      _cachedPrices = data;
      _lastFetchTime = now;
      return _cachedPrices;
    }
    return _cachedPrices || [];
  } catch (e) {
    console.error("[bale-db] Error fetching data.json:", e);
    return _cachedPrices || [];
  }
}

export function getClient(env) {
  if (_client) return _client;

  let url = env.TURSO_DATABASE_URL;
  if (!url) return null;

  if (url.startsWith("libsql://")) {
    url = url.replace("libsql://", "https://");
  } else if (!url.startsWith("https://")) {
    url = `https://${url}`;
  }

  _client = createClient({ url, authToken: env.TURSO_AUTH_TOKEN });
  return _client;
}

async function ensureWatchlistTable(env) {
  if (_watchlistReady) return;
  const client = getClient(env);
  if (!client) return;

  await client.execute(`
    CREATE TABLE IF NOT EXISTS watchlist (
      user_id     INTEGER NOT NULL,
      symbol_key  TEXT NOT NULL,
      added_at    TEXT,
      PRIMARY KEY (user_id, symbol_key)
    )
  `);
  _watchlistReady = true;
}

export async function execute(env, sql, args = []) {
  await ensureWatchlistTable(env);
  try {
    const client = getClient(env);
    return await client.execute({ sql, args });
  } catch (e) {
    console.log(`[bale-db] اجرای کوئری شکست خورد، یک‌بار تلاش مجدد: ${e && e.message}`);
    _client = null;
    const client2 = getClient(env);
    return await client2.execute({ sql, args });
  }
}

export async function getItem(env, symbolKey) {
  const prices = await fetchAllPrices();
  const item = prices.find((p) => p.symbol_key === symbolKey);
  return item || null;
}

export async function getItems(env, symbolKeys) {
  if (!symbolKeys || symbolKeys.length === 0) return [];
  const prices = await fetchAllPrices();
  const map = {};
  for (const item of prices) {
    map[item.symbol_key] = item;
  }
  return symbolKeys.filter((k) => map[k]).map((k) => map[k]);
}

export async function searchItems(env, query, limit = 15) {
  if (!query) return [];
  const q = query.trim().toLowerCase();
  const prices = await fetchAllPrices();
  
  const filtered = prices
    .filter((item) => item.title_fa && item.title_fa.toLowerCase().includes(q))
    .sort((a, b) => (a.title_fa || "").localeCompare(b.title_fa || "", "fa"));

  return filtered.slice(0, limit);
}

export async function addToWatchlist(env, userId, symbolKey) {
  const now = new Date().toISOString();
  await execute(
    env,
    "INSERT INTO watchlist (user_id, symbol_key, added_at) VALUES (?, ?, ?) " +
      "ON CONFLICT(user_id, symbol_key) DO NOTHING",
    [userId, symbolKey, now]
  );
}

export async function removeFromWatchlist(env, userId, symbolKey) {
  await execute(env, "DELETE FROM watchlist WHERE user_id = ? AND symbol_key = ?", [
    userId,
    symbolKey,
  ]);
}

export async function isInWatchlist(env, userId, symbolKey) {
  const rs = await execute(
    env,
    "SELECT 1 FROM watchlist WHERE user_id = ? AND symbol_key = ?",
    [userId, symbolKey]
  );
  return rs.rows.length > 0;
}

export async function getWatchlistKeys(env, userId) {
  const rs = await execute(
    env,
    "SELECT symbol_key FROM watchlist WHERE user_id = ? ORDER BY added_at",
    [userId]
  );
  return rs.rows.map((r) => r.symbol_key);
}
