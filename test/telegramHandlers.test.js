import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

const FAKE_ROWS = {
  usd: { symbol_key: "usd", title_fa: "دلار", price: "2,313,000", change_amount: "27,000", change_percent: "1.18%", updated_at: "2026-09-16 08:49:17" },
};

const sent = []; // { method, args }
let memberStatus = "left";

mock.module("../src/bot/db.js", {
  namedExports: {
    getItem: async (env, key) => FAKE_ROWS[key] || null,
    getItems: async (env, keys) => keys.filter((k) => FAKE_ROWS[k]).map((k) => FAKE_ROWS[k]),
    searchItems: async (env, q) => Object.values(FAKE_ROWS).filter((r) => r.title_fa.includes(q)),
    addToWatchlist: async () => {},
    removeFromWatchlist: async () => {},
    isInWatchlist: async () => false,
    getWatchlistKeys: async () => [],
  },
});

mock.module("../src/bot/telegram_api.js", {
  namedExports: {
    sendMessage: async (env, chatId, text, replyMarkup) => {
      sent.push({ method: "sendMessage", chatId, text, replyMarkup });
    },
    editMessageText: async (env, chatId, messageId, text, replyMarkup) => {
      sent.push({ method: "editMessageText", chatId, messageId, text, replyMarkup });
    },
    answerCallbackQuery: async (env, cqId, text, showAlert) => {
      sent.push({ method: "answerCallbackQuery", cqId, text, showAlert });
    },
    answerInlineQuery: async (env, iqId, results) => {
      sent.push({ method: "answerInlineQuery", iqId, results });
    },
    getChatMemberStatus: async () => memberStatus,
  },
});

const { handleUpdate } = await import("../src/bot/handlers.js");
const env = { BOT_USERNAME: "nerkhemrooz_bot" };

test("/start sends welcome + gate message when user has not joined the channel", async () => {
  sent.length = 0;
  memberStatus = "left";
  await handleUpdate({ message: { chat: { id: 1 }, from: { id: 10 }, text: "/start" } }, env);

  const sends = sent.filter((s) => s.method === "sendMessage");
  assert.equal(sends.length, 2);
  assert.match(sends[0].text, /nerkhemrooz_bot/);
  assert.doesNotMatch(sends[0].text, /your_bot_username/);
  assert.match(sends[1].text, /عضویت در کانال الزامی/);
});

test("category button is blocked (no editMessageText) while user has not joined", async () => {
  sent.length = 0;
  memberStatus = "left";
  await handleUpdate(
    { callback_query: { id: "cq1", data: "cat:cur:0", message: { chat: { id: 1 }, message_id: 5 }, from: { id: 10 } } },
    env
  );
  assert.ok(!sent.some((s) => s.method === "editMessageText"));
  assert.ok(sent.some((s) => s.method === "sendMessage")); // gate re-sent
});

test("check_membership succeeds once member and unlocks the main menu", async () => {
  sent.length = 0;
  memberStatus = "member";
  await handleUpdate(
    { callback_query: { id: "cq2", data: "check_membership", message: { chat: { id: 1 }, message_id: 5 }, from: { id: 10 } } },
    env
  );
  const edit = sent.find((s) => s.method === "editMessageText");
  assert.ok(edit);
  assert.match(edit.text, /عضویت شما تایید شد/);
});

test("once a member, category browsing and item detail work", async () => {
  sent.length = 0;
  memberStatus = "member";
  await handleUpdate(
    { callback_query: { id: "cq3", data: "cat:cur:0", message: { chat: { id: 1 }, message_id: 5 }, from: { id: 10 } } },
    env
  );
  assert.ok(sent.some((s) => s.method === "editMessageText"));

  sent.length = 0;
  await handleUpdate(
    { callback_query: { id: "cq4", data: "item:usd:cur:0", message: { chat: { id: 1 }, message_id: 5 }, from: { id: 10 } } },
    env
  );
  const edit = sent.find((s) => s.method === "editMessageText");
  assert.match(edit.text, /دلار/);
  assert.match(edit.text, /نرخ دیروز/);
});

test("free-text search returns matching results as a keyboard", async () => {
  sent.length = 0;
  memberStatus = "member";
  await handleUpdate({ message: { chat: { id: 1 }, from: { id: 10 }, text: "دلار" } }, env);
  const send = sent.find((s) => s.method === "sendMessage");
  assert.ok(send.replyMarkup.inline_keyboard.some((row) => row[0].callback_data === "item:usd:srch:0"));
});

test("inline query returns article results built from buildItemMessage", async () => {
  sent.length = 0;
  await handleUpdate({ inline_query: { id: "iq1", query: "دلار" } }, env);
  const answer = sent.find((s) => s.method === "answerInlineQuery");
  assert.equal(answer.results.length, 1);
  assert.match(answer.results[0].input_message_content.message_text, /دلار/);
});

test("fav_add calls db.addToWatchlist then re-renders item detail", async () => {
  sent.length = 0;
  memberStatus = "member";
  await handleUpdate(
    { callback_query: { id: "cq5", data: "fav_add:usd:cur:0", message: { chat: { id: 1 }, message_id: 5 }, from: { id: 10 } } },
    env
  );
  assert.ok(sent.some((s) => s.method === "answerCallbackQuery" && /دیده‌بان اضافه/.test(s.text)));
  assert.ok(sent.some((s) => s.method === "editMessageText"));
});
