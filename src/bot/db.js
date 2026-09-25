import { createClient } from "@libsql/client/web";

let _client = null;
let _watchlistReady = false;

// متغیرهای کش جهت بهینه‌سازی سرعت و کاهش تعداد fetch
let _cachedPrices = null;
let _lastFetchTime = 0;
const CACHE_TTL_MS = 60000; // کش ۶۰ ثانیه‌ای در حافظه ورکر

const DATA_JSON_URL = "https://nerkhemroozchand.pages.dev/data.json";

/**
 * دریافت و کش اطلاعات قیمت‌ها از فایل استاتیک JSON
 */
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
    console.error("[bot-db] Error fetching data.json:", e);
    return _cachedPrices || [];
  }
}

// ---------------------------------------------------------------------------
// اتصال به Turso (منحصراً برای مدیریت دیده‌بان شخصی / Watchlist)
// ---------------------------------------------------------------------------

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
    console.log(`[bot-db] اجرای کوئری شکست خورد، یک‌بار تلاش مجدد: ${e && e.message}`);
    _client = null;
    const client2 = getClient(env);
    return await client2.execute({ sql, args });
  }
}

// ---------------------------------------------------------------------------
// خواندن قیمت‌های عمومی (جایگزین شده با data.json)
// ---------------------------------------------------------------------------

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
  // حفظ دقیق ترتیب symbolKeys ورودی (مطابق رفتار سورس اصلی)
  return symbolKeys.filter((k) => map[k]).map((k) => map[k]);
}

export async function searchItems(env, query, limit = 15) {
  if (!query) return [];
  const q = query.trim().toLowerCase();
  const prices = await fetchAllPrices();
  
  const filtered = prices
    .filter((item) => item.title_fa && item.title_fa.toLowerCase().includes(q))
    .sort((a, b) => (a.title_fa || "").localeCompare(b.title_fa || "", "fa")); // مرتب‌سازی الفبایی دقیقاً مثل ORDER BY title_fa

  return filtered.slice(0, limit);
}

// ---------------------------------------------------------------------------
// دیده‌بان شخصی (watchlist) — اتصال به Turso
// ---------------------------------------------------------------------------

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
