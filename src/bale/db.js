// داده‌های نرخ (getItem/getItems/searchItems) کاملاً مستقل از پیام‌رسان
// است، پس همان توابع bot/db.js مستقیم استفاده می‌شوند (همان کش data.json +
// fallback اضطراری Turso؛ هیچ خطری برای ربات تلگرام ندارد چون فقط خواندن
// است).
//
// ⚠️ نکتهٔ مهم (رفع یک باگ واقعی): در یک نسخهٔ میانی این فایل به‌جای
// استفادهٔ مجدد از bot/db.js، یک کپی کامل و مستقل از منطق اتصال به Turso
// در خودش ساخته بود - و در همان کپی، به‌اشتباه دیده‌بان بله را هم روی
// همان جدول `watchlist` تلگرام می‌نوشت (نه `watchlist_bale`). چون شناسهٔ
// کاربر (user_id) در بله و تلگرام دو فضای عددی کاملاً مستقل و بی‌ربط به
// هم هستند، این باگ می‌توانست باعث شود یک کاربر تلگرام و یک کاربر بله با
// همان عدد شناسه (کاملاً تصادفی و محتمل)، دیده‌بان همدیگر را ببینند/حذف
// کنند. با استفادهٔ مجدد از bot/db.js (به‌جای کپی‌کردن منطق اتصال)، هم این
// باگ رفع می‌شود و هم دیگر امکان ندارد این دو فایل در آینده از هم واگرا
// شوند.

import * as sharedDb from "../bot/db.js";

export const getItem = sharedDb.getItem;
export const getItems = sharedDb.getItems;
export const searchItems = sharedDb.searchItems;

let _tableReady = false;

async function ensureTable(env) {
  if (_tableReady) return;
  const client = sharedDb.getClient(env);
  if (!client) return;
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
