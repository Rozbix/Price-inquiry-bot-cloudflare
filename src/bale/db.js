// داده‌های نرخ (getItem/getItems/searchItems) کاملاً مستقل از پیام‌رسان
// است، پس همان توابع bot/db.js مستقیم استفاده می‌شوند (فقط خواندن، هیچ
// خطری برای ربات تلگرام ندارد).
//
// اما دیده‌بان (watchlist) را در یک جدول جداگانه به اسم watchlist_bale
// نگه می‌داریم، چون شناسهٔ کاربر (user_id) در بله فضای عددی کاملاً
// متفاوتی از تلگرام دارد؛ اگر از همان جدول watchlist تلگرام استفاده
// می‌کردیم، ممکن بود یک عدد به‌طور اتفاقی هم در تلگرام و هم در بله وجود
// داشته باشد و دیده‌بان دو کاربر متفاوت با هم قاطی شود.

import * as sharedDb from "../bot/db.js";

export const getItem = sharedDb.getItem;
export const getItems = sharedDb.getItems;
export const searchItems = sharedDb.searchItems;

let _tableReady = false;

async function ensureTable(env) {
  if (_tableReady) return;
  const client = sharedDb.getClient(env);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS watchlist_bale (
      user_id     INTEGER NOT NULL,
      symbol_key  TEXT NOT NULL,
      added_at    TEXT,
      PRIMARY KEY (user_id, symbol_key)
    )
  `);
  _tableReady = true;
}

export async function addToWatchlist(env, userId, symbolKey) {
  await ensureTable(env);
  const client = sharedDb.getClient(env);
  const now = new Date().toISOString();
  await client.execute({
    sql:
      "INSERT INTO watchlist_bale (user_id, symbol_key, added_at) VALUES (?, ?, ?) " +
      "ON CONFLICT(user_id, symbol_key) DO NOTHING",
    args: [userId, symbolKey, now],
  });
}

export async function removeFromWatchlist(env, userId, symbolKey) {
  await ensureTable(env);
  const client = sharedDb.getClient(env);
  await client.execute({
    sql: "DELETE FROM watchlist_bale WHERE user_id = ? AND symbol_key = ?",
    args: [userId, symbolKey],
  });
}

export async function isInWatchlist(env, userId, symbolKey) {
  await ensureTable(env);
  const client = sharedDb.getClient(env);
  const rs = await client.execute({
    sql: "SELECT 1 FROM watchlist_bale WHERE user_id = ? AND symbol_key = ?",
    args: [userId, symbolKey],
  });
  return rs.rows.length > 0;
}

export async function getWatchlistKeys(env, userId) {
  await ensureTable(env);
  const client = sharedDb.getClient(env);
  const rs = await client.execute({
    sql: "SELECT symbol_key FROM watchlist_bale WHERE user_id = ? ORDER BY added_at",
    args: [userId],
  });
  return rs.rows.map((r) => r.symbol_key);
}
