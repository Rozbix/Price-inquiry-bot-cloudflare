import { createClient } from "@libsql/client/web";

let _client = null;
let _watchlistReady = false;

// متغیرهای کش جهت بهینه‌سازی سرعت و کاهش تعداد fetch
let _cachedPrices = null;
let _lastFetchTime = 0;
const CACHE_TTL_MS = 60000; // کش ۶۰ ثانیه‌ای در حافظه ورکر

const DATA_JSON_URL = "https://nerkhemroozchand.pages.dev/data.json";

/**
 * دریافت و کش اطلاعات قیمت‌ها از فایل استاتیک JSON.
 *
 * نکته دربارهٔ حذف `?t=${Date.now()}`: این پارامتر کش لبه (edge cache) خود
 * Cloudflare Pages/CDN را برای این URL کاملاً دور می‌زد (چون هر بار یک URL
 * کاملاً جدید می‌ساخت)، در حالی که خودمان همین‌جا یک کش ۶۰ ثانیه‌ای در
 * حافظهٔ Worker داریم که تازگی داده را کنترل می‌کند. نتیجهٔ آن پارامتر فقط
 * این بود که هر ۶۰ ثانیه یک‌بار (به‌جای استفاده از کش CDN) مستقیم به مبدأ
 * Pages می‌رفتیم - بدون فایدهٔ اضافه، فقط کمی تأخیر بیشتر.
 */
async function fetchAllPrices() {
  const now = Date.now();
  if (_cachedPrices && (now - _lastFetchTime < CACHE_TTL_MS)) {
    return _cachedPrices;
  }

  try {
    const response = await fetch(DATA_JSON_URL, {
      headers: { "Accept": "application/json" }
    });
    if (!response.ok) return _cachedPrices || [];

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
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
// اتصال به Turso (برای دیده‌بان شخصی / Watchlist، و به‌عنوان fallback
// اضطراری برای خواندن نرخ‌ها - پایین‌تر توضیح داده شده)
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
// خواندن قیمت‌های عمومی (اول از data.json، با fallback اضطراری به Turso)
// ---------------------------------------------------------------------------
// چرا fallback لازم است: قبل از این تغییر، اگر fetch به data.json شکست
// می‌خورد و هیچ کش گرمی هم در حافظهٔ Worker نبود (مثلا سرد شدن instance،
// یا یک اختلال موقت در Cloudflare Pages)، fetchAllPrices آرایهٔ خالی
// برمی‌گرداند و کل ربات برای «همهٔ» نمادها «پیدا نشد» نشان می‌داد - یک
// قطعی کامل و بی‌صدا، دقیقاً برای همان لحظاتی که پایداری بیشتر لازم است.
// حالا اگر data.json عملاً خالی برگردد، همان یک تعامل به‌جای شکست کامل،
// مستقیم و فقط برای همان درخواست از Turso می‌خواند (دقیقاً رفتار نسخهٔ
// قبل از این بهینه‌سازی کش) و بار بعدی که data.json در دسترس باشد، خودکار
// دوباره از کش استفاده می‌شود.

function rowToObj(row) {
  return {
    symbol_key: row.symbol_key,
    title_fa: row.title_fa,
    price: row.price,
    change_amount: row.change_amount,
    change_percent: row.change_percent,
    updated_at: row.updated_at,
  };
}

async function getItemFromTurso(env, symbolKey) {
  const rs = await execute(
    env,
    "SELECT symbol_key, title_fa, price, change_amount, change_percent, updated_at FROM market_prices WHERE symbol_key = ?",
    [symbolKey]
  );
  const row = rs.rows[0];
  return row ? rowToObj(row) : null;
}

async function getItemsFromTurso(env, symbolKeys) {
  if (!symbolKeys || symbolKeys.length === 0) return [];
  const placeholders = symbolKeys.map(() => "?").join(",");
  const rs = await execute(
    env,
    `SELECT symbol_key, title_fa, price, change_amount, change_percent, updated_at FROM market_prices WHERE symbol_key IN (${placeholders})`,
    symbolKeys
  );
  const map = {};
  for (const row of rs.rows) map[row.symbol_key] = rowToObj(row);
  return symbolKeys.filter((k) => map[k]).map((k) => map[k]);
}

async function searchItemsFromTurso(env, query, limit) {
  const like = `%${query.trim()}%`;
  const rs = await execute(
    env,
    "SELECT symbol_key, title_fa, price, change_amount, change_percent, updated_at FROM market_prices WHERE title_fa LIKE ? ORDER BY title_fa LIMIT ?",
    [like, limit]
  );
  return rs.rows.map(rowToObj);
}

export async function getItem(env, symbolKey) {
  const prices = await fetchAllPrices();
  if (prices.length === 0) return getItemFromTurso(env, symbolKey);
  const item = prices.find((p) => p.symbol_key === symbolKey);
  return item || null;
}

export async function getItems(env, symbolKeys) {
  if (!symbolKeys || symbolKeys.length === 0) return [];
  const prices = await fetchAllPrices();
  if (prices.length === 0) return getItemsFromTurso(env, symbolKeys);
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
  if (prices.length === 0) return searchItemsFromTurso(env, query, limit);

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
