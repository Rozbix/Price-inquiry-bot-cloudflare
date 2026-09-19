import test from "node:test";
import assert from "node:assert/strict";
import * as fmt from "../src/bot/format.js";

test("parseNumber handles comma-formatted, negative, percent, and dash values", () => {
  assert.equal(fmt.parseNumber("2,313,000"), 2313000);
  assert.equal(fmt.parseNumber("-27,000"), -27000);
  assert.equal(fmt.parseNumber("-0.18%"), -0.18);
  assert.equal(fmt.parseNumber("-"), null);
  assert.equal(fmt.parseNumber(""), null);
  assert.equal(fmt.parseNumber(null), null);
});

test("formatNumber matches Python's comma-integer / trimmed-decimal behaviour", () => {
  assert.equal(fmt.formatNumber(2313000), "2,313,000");
  assert.equal(fmt.formatNumber(-27000), "-27,000");
  assert.equal(fmt.formatNumber(null), "-");
  // 4-decimal formatting with trailing zero stripping (crypto-style prices)
  assert.equal(fmt.formatNumber(0.0851), "0.0851");
  assert.equal(fmt.formatNumber(1.5), "1.5");
});

test("changeEmoji picks the right arrow", () => {
  assert.equal(fmt.changeEmoji("27,000"), "🔺");
  assert.equal(fmt.changeEmoji("-27,000"), "🔻");
  assert.equal(fmt.changeEmoji("0"), "➖");
  assert.equal(fmt.changeEmoji("-"), "➖");
});

test("yesterdayPrice = price - change", () => {
  assert.equal(fmt.yesterdayPrice("2,313,000", "27,000"), 2286000);
  assert.equal(fmt.yesterdayPrice("-", "27,000"), null);
});

test("buildItemMessage renders the expected Persian layout", () => {
  const row = {
    symbol_key: "usd",
    title_fa: "دلار",
    price: "2,313,000",
    change_amount: "27,000",
    change_percent: "1.18%",
    updated_at: "2026-09-16 08:49:17",
  };
  const text = fmt.buildItemMessage(row);
  assert.match(text, /دلار/);
  assert.match(text, /نرخ فعلی: <b>2,313,000<\/b>/);
  assert.match(text, /نرخ دیروز: 2,286,000/);
  assert.match(text, /🔺 تغییر: \+27,000 \(1\.18%\)/);
});

test("buildWatchlistMessage handles empty and populated lists", () => {
  assert.match(fmt.buildWatchlistMessage([]), /خالی است/);
  const rows = [
    { symbol_key: "usd", title_fa: "دلار", price: "2,313,000", change_amount: "27,000", change_percent: "1.18%", updated_at: "x" },
  ];
  const text = fmt.buildWatchlistMessage(rows);
  assert.match(text, /دلار/);
  assert.match(text, /🔺/);
});
