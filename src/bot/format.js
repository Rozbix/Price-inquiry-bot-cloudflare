// ابزارهای فرمت‌بندی اعداد و ساخت متن پیام‌ها. پورت مستقیم bot/format.py.
import { categoryEmojiForKey } from "./config.js";

export function parseNumber(s) {
  // رشتهٔ فرمت‌شده مثل '2,313,000' یا '-27,000' یا '-0.18%' را به عدد
  // تبدیل می‌کند. اگر عدد معتبری پیدا نشود null برمی‌گرداند.
  if (s === null || s === undefined) return null;
  let str = String(s).trim();
  if (str === "" || str === "-" || str === "None") return null;
  str = str.replace(/,/g, "").replace(/%/g, "").trim();
  const m = str.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  return parseFloat(m[0]);
}

export function formatNumber(n) {
  if (n === null || n === undefined) return "-";
  if (Number.isInteger(n)) {
    return Math.trunc(n).toLocaleString("en-US");
  }
  let s = n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

export function changeEmoji(changeAmountStr) {
  const val = parseNumber(changeAmountStr);
  if (val === null || val === 0) return "➖";
  return val > 0 ? "🔺" : "🔻";
}

export function yesterdayPrice(priceStr, changeAmountStr) {
  // نرخ دیروز = نرخ امروز - میزان تغییر.
  const priceVal = parseNumber(priceStr);
  const changeVal = parseNumber(changeAmountStr);
  if (priceVal === null || changeVal === null) return null;
  return priceVal - changeVal;
}

export function buildItemMessage(row) {
  // پیام کامل جزئیات یک نماد (برای نمایش در چت).
  const emoji = categoryEmojiForKey(row.symbol_key);
  const title = row.title_fa;
  const price = row.price;
  const changeAmount = row.change_amount;
  const changePercent = row.change_percent;
  const updatedAt = row.updated_at;

  const arrow = changeEmoji(changeAmount);
  const yPrice = yesterdayPrice(price, changeAmount);
  const yPriceText = yPrice !== null ? formatNumber(yPrice) : "-";

  const changeAmtVal = parseNumber(changeAmount);
  let changeAmtText = "-";
  if (changeAmtVal !== null) {
    const sign = changeAmtVal > 0 ? "+" : "";
    changeAmtText = `${sign}${formatNumber(changeAmtVal)}`;
  }

  const pctText = changePercent && changePercent !== "-" ? changePercent : "0%";

  const lines = [
    `${emoji} <b>${title}</b>`,
    "",
    `💰 نرخ فعلی: <b>${price}</b>`,
    `📅 نرخ دیروز: ${yPriceText}`,
    `${arrow} تغییر: ${changeAmtText} (${pctText})`,
    "",
    `🕒 آخرین بروزرسانی: ${updatedAt}`,
  ];
  return lines.join("\n");
}

export function buildListButtonLabel(row) {
  // متن کوتاه روی دکمهٔ هر آیتم داخل لیست یک دسته.
  const arrow = changeEmoji(row.change_amount);
  return `${arrow} ${row.title_fa} — ${row.price}`;
}

export function buildWatchlistMessage(rows) {
  if (!rows || rows.length === 0) {
    return (
      "⭐ <b>دیده‌بان من</b>\n\n" +
      "فهرست علاقه‌مندی‌های شما خالی است.\n" +
      "برای افزودن، وارد هر نماد شوید و روی «⭐ افزودن به علاقه‌مندی‌ها» بزنید."
    );
  }

  const lines = ["⭐ <b>دیده‌بان من</b>", ""];
  for (const row of rows) {
    const emoji = categoryEmojiForKey(row.symbol_key);
    const arrow = changeEmoji(row.change_amount);
    const pct = row.change_percent && row.change_percent !== "-" ? row.change_percent : "0%";
    lines.push(`${emoji} <b>${row.title_fa}</b>: ${row.price} ${arrow} (${pct})`);
  }
  lines.push("");
  lines.push("🕒 برای دیدن جزئیات کامل هر مورد، روی دکمهٔ آن در پایین بزنید.");
  return lines.join("\n");
}
