import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

const FAKE_ROWS = {
  usd: { symbol_key: "usd", title_fa: "دلار", price: "2,313,000", change_amount: "27,000", change_percent: "1.18%", updated_at: "2026-09-16 08:49:17" },
  eur: { symbol_key: "eur", title_fa: "یورو", price: "2,681,300", change_amount: "-16,900", change_percent: "-0.63%", updated_at: "2026-09-16 08:49:17" },
};

const sent = [];

mock.module("../src/bot/db.js", {
  namedExports: {
    getItems: async (env, keys) => keys.filter((k) => FAKE_ROWS[k]).map((k) => FAKE_ROWS[k]),
  },
});

mock.module("../src/eitaa/api.js", {
  namedExports: {
    sendMessage: async (env, chatId, text) => {
      sent.push({ chatId, text });
      return { ok: true };
    },
    cleanHtml: (t) => (t ? String(t).replace(/<[^>]*>/g, "") : t),
  },
});

const { sendCategoryDigest } = await import("../src/eitaa/broadcaster.js");

test("sendCategoryDigest builds a digest with all currency rows and posts to the configured chat", async () => {
  sent.length = 0;
  const env = { EITAA_CHAT_ID: "nerkhemroozchand", BOT_USERNAME: "nerkhemrooz_bot" };
  const result = await sendCategoryDigest(env, "cur");

  assert.equal(sent.length, 1);
  assert.equal(sent[0].chatId, "nerkhemroozchand");
  assert.match(sent[0].text, /دلار/);
  assert.match(sent[0].text, /یورو/);
  assert.match(sent[0].text, /🔺/);
  assert.match(sent[0].text, /🔻/);
  assert.deepEqual(result, { ok: true });
});

test("sendCategoryDigest falls back to DEFAULT_CHAT_ID when EITAA_CHAT_ID is unset", async () => {
  sent.length = 0;
  const env = { BOT_USERNAME: "nerkhemrooz_bot" };
  await sendCategoryDigest(env, "cur");
  assert.equal(sent[0].chatId, "nerkhemroozchand");
});

test("sendCategoryDigest returns null and does not send for an invalid category code", async () => {
  sent.length = 0;
  const env = { EITAA_CHAT_ID: "nerkhemroozchand" };
  const result = await sendCategoryDigest(env, "not_a_real_category");
  assert.equal(result, null);
  assert.equal(sent.length, 0);
});
