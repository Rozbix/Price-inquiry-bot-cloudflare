// ساخت ساختار inline_keyboard برای پیام‌های تلگرام. پورت مستقیم
// bot/keyboards.py — قرارداد callback_data کاملاً یکسان نگه داشته شده تا
// منطق بازگشت/صفحه‌بندی هیچ تفاوتی با نسخهٔ قبلی نداشته باشد:
//
//   home                                 -> بازگشت به منوی اصلی
//   burmenu                              -> نمایش زیردسته‌های بورس/جهانی
//   cat:<code>:<page>                    -> لیست یک دستهٔ سطح اول
//   sub:<code>:<page>                    -> لیست یک زیردستهٔ بورس
//   item:<key>:<origin>:<page>           -> نمایش جزئیات یک نماد
//   fav_add:<key>:<origin>:<page>        -> افزودن به دیده‌بان
//   fav_del:<key>:<origin>:<page>        -> حذف از دیده‌بان
//   refresh_item:<key>:<origin>:<page>   -> بروزرسانی صفحهٔ جزئیات
//   refresh_list:<origin>:<page>         -> بروزرسانی لیست
//   watchlist                            -> نمایش دیده‌بان من
//   search_prompt                        -> راهنمای جستجو

import * as config from "./config.js";
import { buildListButtonLabel } from "./format.js";

export function mainMenu() {
  const rows = [
    [{ text: "💵 ارزهای اصلی و سنتی", callback_data: "cat:cur:0" }],
    [{ text: "🪙 طلا، سکه و حباب‌ها", callback_data: "cat:gld:0" }],
    [{ text: "📈 شاخص‌های بورس و جهانی", callback_data: "burmenu" }],
    [{ text: "💎 ارزهای دیجیتال", callback_data: "cat:cry:0" }],
    [{ text: "🔍 جستجوی پیشرفته / استعلام سریع", callback_data: "search_prompt" }],
    [{ text: "⭐ دیده‌بان من", callback_data: "watchlist" }],
  ];
  return { inline_keyboard: rows };
}

export function bourseSubmenu() {
  const rows = [];
  for (const [code, cat] of Object.entries(config.BOURSE_SUBCATEGORIES)) {
    rows.push([{ text: `${cat.emoji} ${cat.title}`, callback_data: `sub:${code}:0` }]);
  }
  rows.push([{ text: "🔙 بازگشت به منوی اصلی", callback_data: "home" }]);
  return { inline_keyboard: rows };
}

export function resolveKeys(origin) {
  if (config.CATEGORIES[origin] && config.CATEGORIES[origin].keys !== null) {
    return config.CATEGORIES[origin].keys;
  }
  if (config.BOURSE_SUBCATEGORIES[origin]) {
    return config.BOURSE_SUBCATEGORIES[origin].keys;
  }
  return null;
}

function listPrefix(origin) {
  return config.BOURSE_SUBCATEGORIES[origin] ? "sub" : "cat";
}

export function listKeyboard(origin, page, rowsData, totalItems) {
  const kb = [];
  for (const item of rowsData) {
    const label = buildListButtonLabel(item);
    kb.push([{ text: label, callback_data: `item:${item.symbol_key}:${origin}:${page}` }]);
  }

  const navRow = [];
  if (page > 0) {
    navRow.push({ text: "◀️ قبلی", callback_data: `${listPrefix(origin)}:${origin}:${page - 1}` });
  }
  if ((page + 1) * config.PAGE_SIZE < totalItems) {
    navRow.push({ text: "بعدی ▶️", callback_data: `${listPrefix(origin)}:${origin}:${page + 1}` });
  }
  if (navRow.length) kb.push(navRow);

  kb.push([{ text: "🔄 بروزرسانی", callback_data: `refresh_list:${origin}:${page}` }]);

  const backRow = [];
  if (config.BOURSE_SUBCATEGORIES[origin]) {
    backRow.push({ text: "🔙 بازگشت به شاخص‌ها", callback_data: "burmenu" });
  }
  backRow.push({ text: "🏠 منوی اصلی", callback_data: "home" });
  kb.push(backRow);

  return { inline_keyboard: kb };
}

export function itemDetailKeyboard(symbolKey, origin, page, isFavorite) {
  const favBtn = isFavorite
    ? { text: "💔 حذف از علاقه‌مندی‌ها", callback_data: `fav_del:${symbolKey}:${origin}:${page}` }
    : { text: "⭐ افزودن به علاقه‌مندی‌ها", callback_data: `fav_add:${symbolKey}:${origin}:${page}` };

  const kb = [
    [favBtn],
    [{ text: "🔄 بروزرسانی لحظه‌ای", callback_data: `refresh_item:${symbolKey}:${origin}:${page}` }],
  ];

  const backRow = [];
  if (config.CATEGORIES[origin] || config.BOURSE_SUBCATEGORIES[origin]) {
    backRow.push({ text: "🔙 بازگشت به لیست", callback_data: `${listPrefix(origin)}:${origin}:${page}` });
  } else if (origin === "wl") {
    backRow.push({ text: "🔙 بازگشت به دیده‌بان", callback_data: "watchlist" });
  } else if (origin === "srch") {
    backRow.push({ text: "🔙 بازگشت به نتایج جستجو", callback_data: "noop_search" });
  }
  backRow.push({ text: "🏠 منوی اصلی", callback_data: "home" });
  kb.push(backRow);

  return { inline_keyboard: kb };
}

export function searchResultsKeyboard(rowsData) {
  const kb = [];
  for (const item of rowsData) {
    const label = buildListButtonLabel(item);
    kb.push([{ text: label, callback_data: `item:${item.symbol_key}:srch:0` }]);
  }
  kb.push([{ text: "🏠 منوی اصلی", callback_data: "home" }]);
  return { inline_keyboard: kb };
}

export function watchlistKeyboard(rowsData) {
  const kb = [];
  for (const item of rowsData) {
    const label = buildListButtonLabel(item);
    kb.push([{ text: label, callback_data: `item:${item.symbol_key}:wl:0` }]);
  }
  kb.push([{ text: "🔄 بروزرسانی", callback_data: "watchlist" }]);
  kb.push([{ text: "🏠 منوی اصلی", callback_data: "home" }]);
  return { inline_keyboard: kb };
}
