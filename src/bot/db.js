// لایهٔ دیتابیس. همان Turso که پروژهٔ اسکرِیپر «نرخ‌خروچند» با آن کار
// می‌کند؛ این ربات فقط از جدول market_prices می‌خواند (هیچ‌وقت آن را
// دستکاری نمی‌کند) و یک جدول کوچک مستقل به اسم watchlist برای دیده‌بان
// شخصی هر کاربر اضافه می‌کند.
//
// نکتهٔ مهاجرت: در پایتون از libsql_experimental (اتصال native) استفاده
// می‌شد. Cloudflare Workers نمی‌تواند native binding اجرا کند، برای همین
// اینجا از @libsql/client/web استفاده شده — همان بسته‌ای که مستندات رسمی
// Cloudflare برای اتصال Workers به Turso معرفی می‌کند (HTTP-based، بدون
// نیاز به سوکت پایدار).

import { createClient } from "@libsql/client/web";

let _client = null;
let _watchlistReady = false;

export function getClient(env) {
  if (_client) return _client;

  let url = env.TURSO_DATABASE_URL;
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

/**
 * اجرای امن یک کوئری. معادل _safe_execute نسخهٔ پایتون، با این تفاوت که
 * چون @libsql/client/web از ترنسپورت HTTP بدون‌حالت (هر درخواست کاملاً
 * مستقل) استفاده می‌کند، خطای خاص «stream expired» که در نسخهٔ پایتون
 * (به‌خاطر یک اتصال native پایدار بین اجراها) رخ می‌داد، اینجا اصولاً
 * نباید پیش بیاید. با این حال، برای مقاومت در برابر خطاهای گذرای شبکه، اگر
 * اجرای اول شکست بخورد، یک بار کلاینت را بازسازی و دوباره تلاش می‌کنیم.
 */
export async function execute(env, sql, args = []) {
  await ensureWatchlistTable(env);
  try {
    const client = getClient(env);
    return await client.execute({ sql, args });
  } catch (e) {
    console.log(`[db] اجرای کوئری شکست خورد، یک‌بار تلاش مجدد: ${e && e.message}`);
    _client = null;
    const client2 = getClient(env);
    return await client2.execute({ sql, args });
  }
}

// ---------------------------------------------------------------------------
// خواندن از market_prices
// ---------------------------------------------------------------------------

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

export async function getItem(env, symbolKey) {
  const rs = await execute(
    env,
    "SELECT symbol_key, title_fa, price, change_amount, change_percent, updated_at " +
      "FROM market_prices WHERE symbol_key = ?",
    [symbolKey]
  );
  const row = rs.rows[0];
  return row ? rowToObj(row) : null;
}

export async function getItems(env, symbolKeys) {
  // چند نماد را می‌خواند و دقیقا به همان ترتیب symbolKeys برمی‌گرداند
  // (SQL با IN ترتیب را حفظ نمی‌کند، پس اینجا دوباره مرتب می‌شود).
  if (!symbolKeys || symbolKeys.length === 0) return [];
  const placeholders = symbolKeys.map(() => "?").join(",");
  const rs = await execute(
    env,
    `SELECT symbol_key, title_fa, price, change_amount, change_percent, updated_at ` +
      `FROM market_prices WHERE symbol_key IN (${placeholders})`,
    symbolKeys
  );
  const map = {};
  for (const row of rs.rows) {
    const obj = rowToObj(row);
    map[obj.symbol_key] = obj;
  }
  return symbolKeys.filter((k) => map[k]).map((k) => map[k]);
}

export async function searchItems(env, query, limit = 15) {
  const like = `%${query.trim()}%`;
  const rs = await execute(
    env,
    "SELECT symbol_key, title_fa, price, change_amount, change_percent, updated_at " +
      "FROM market_prices WHERE title_fa LIKE ? ORDER BY title_fa LIMIT ?",
    [like, limit]
  );
  return rs.rows.map(rowToObj);
}

// ---------------------------------------------------------------------------
// دیده‌بان شخصی (watchlist) — تلگرام
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
