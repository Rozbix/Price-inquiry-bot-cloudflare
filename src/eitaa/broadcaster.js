// چون ایتا امکان تعامل دو طرفه ندارد، به‌جای منوی شیشه‌ای، این ماژول یک
// «گزارش نرخ» متنی برای یک دسته می‌سازد و به کانال ایتای شما پست می‌کند.
//
// در نسخهٔ پایتون این با اجرای دستیِ `python -m eitaa.broadcaster cur`
// (یا یک کرون خارجی مثل GitHub Actions) صدا زده می‌شد. در Cloudflare
// Workers هیچ CLI محلی به secrets واقعی دیپلوی‌شده دسترسی ندارد، برای
// همین دو راه معادل اضافه شده (هر دو در src/index.js سیم‌کشی شده‌اند):
//   ۱) یک Cron Trigger اختیاری (پیش‌فرض خاموش - رفتار فعلی حفظ می‌شود)
//   ۲) یک مسیر HTTP دستی با احراز هویت با سکرت، برای فراخوانی درخواستی

import * as db from "../bot/db.js";
import * as fmt from "../bot/format.js";
import * as sharedConfig from "../bot/config.js";
import * as api from "./api.js";
import * as config from "./config.js";

export async function buildDigestText(env, title, emoji, symbolKeys) {
  const rows = await db.getItems(env, symbolKeys);
  const lines = [`${emoji} <b>${title}</b>`, ""];
  if (!rows.length) lines.push("داده‌ای برای نمایش پیدا نشد.");
  for (const row of rows) {
    const arrow = fmt.changeEmoji(row.change_amount);
    const pct = row.change_percent && row.change_percent !== "-" ? row.change_percent : "0%";
    lines.push(`${arrow} ${row.title_fa}: <b>${row.price}</b> (${pct})`);
  }
  if (rows.length) {
    lines.push("");
    lines.push(`🕒 بروزرسانی: ${rows[0].updated_at}`);
  }
  lines.push("");
  const username = env.BOT_USERNAME || "nerkhemrooz_bot";
  lines.push(`📊 نرخ‌های بیشتر: ربات بلی و تلگرام @${username}`);
  return lines.join("\n");
}

export async function sendCategoryDigest(env, categoryCode, chatId = null) {
  // categoryCode یکی از کلیدهای bot/config.js -> CATEGORIES (مثلا 'cur')
  // یا BOURSE_SUBCATEGORIES (مثلا 'bir') است.
  chatId = chatId || env.EITAA_CHAT_ID || config.DEFAULT_CHAT_ID;
  const cat = sharedConfig.CATEGORIES[categoryCode] || sharedConfig.BOURSE_SUBCATEGORIES[categoryCode];
  if (!cat || cat.keys === null || cat.keys === undefined) {
    console.log(`[eitaa_broadcaster] دستهٔ نامعتبر یا بدون کلید: ${categoryCode}`);
    return null;
  }
  const text = await buildDigestText(env, cat.title, cat.emoji, cat.keys);
  return api.sendMessage(env, chatId, text);
}
