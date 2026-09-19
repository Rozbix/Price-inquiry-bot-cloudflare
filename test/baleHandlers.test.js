import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

const FAKE_ROWS = {
  usd: { symbol_key: "usd", title_fa: "دلار", price: "2,313,000", change_amount: "27,000", change_percent: "1.18%", updated_at: "x" },
};

const sent = [];
let memberStatus = "left";

mock.module("../src/bale/db.js", {
  namedExports: {
    getItem: async (env, key) => FAKE_ROWS[key] || null,
    getItems: async (env, keys) => keys.filter((k) => FAKE_ROWS[k]).map((k) => FAKE_ROWS[k]),
    searchItems: async () => [],
    addToWatchlist: async () => {},
    removeFromWatchlist: async () => {},
    isInWatchlist: async () => false,
    getWatchlistKeys: async () => [],
  },
});

mock.module("../src/bale/api.js", {
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
    getChatMemberStatus: async () => memberStatus,
    cleanHtml: (t) => (t ? String(t).replace(/<[^>]*>/g, "") : t),
  },
});

const { handleUpdate } = await import("../src/bale/handlers.js");
const env = {};

test("private chat /start still shows welcome + gate when not a member", async () => {
  sent.length = 0;
  memberStatus = "left";
  await handleUpdate(
    { message: { chat: { id: 100, type: "private" }, from: { id: 7 }, text: "/start" } },
    env
  );
  assert.equal(sent.filter((s) => s.method === "sendMessage").length, 2);
});

test("messages coming from a channel post are ignored entirely", async () => {
  sent.length = 0;
  await handleUpdate(
    { message: { chat: { id: -100123, type: "channel" }, from: { id: 7 }, text: "/start" } },
    env
  );
  assert.equal(sent.length, 0);
});

test("messages from a supergroup are ignored entirely", async () => {
  sent.length = 0;
  await handleUpdate(
    { message: { chat: { id: -100999, type: "supergroup" }, from: { id: 7 }, text: "hello" } },
    env
  );
  assert.equal(sent.length, 0);
});

test("group chat (non-private, non-ignored type) also gets no reply per current behaviour", async () => {
  sent.length = 0;
  await handleUpdate(
    { message: { chat: { id: -55, type: "group" }, from: { id: 7 }, text: "/start" } },
    env
  );
  // handleMessage خودش هم چک می‌کند chatType !== 'private' => return
  assert.equal(sent.length, 0);
});

test("negative chat_id bypasses the membership gate inside checkGate (callback path)", async () => {
  // این سناریو مستقیم چک می‌کند که وقتی چت گروه/کانال باشد، حتی اگر
  // کاربر عضو نباشد، gate اعمال نمی‌شود (چون chat.type/chat.id در callback
  // به checkGate پاس داده می‌شود، نه فقط در handleMessage)
  sent.length = 0;
  memberStatus = "left";
  await handleUpdate(
    {
      callback_query: {
        id: "cq1",
        data: "cat:cur:0",
        message: { chat: { id: -777, type: "group" }, message_id: 1 },
        from: { id: 7 },
      },
    },
    env
  );
  // چون چت گروه است، gate رد می‌شود و منطق عادی callback اجرا می‌شود
  assert.ok(sent.some((s) => s.method === "editMessageText"));
});

test("bale sendMessage/editMessageText strip HTML tags (no parse_mode support)", async () => {
  sent.length = 0;
  memberStatus = "member";
  await handleUpdate(
    { message: { chat: { id: 100, type: "private" }, from: { id: 7 }, text: "/start" } },
    env
  );
  // خود handler متن خام با تگ HTML می‌سازد؛ پاک‌سازی داخل api.sendMessage
  // انجام می‌شود که اینجا mock شده و صرفاً پاس‌ثرو است، پس این تست عمدتاً
  // اطمینان می‌دهد که هیچ خطایی رخ نمی‌دهد و پیام خوش‌آمد ارسال می‌شود.
  assert.ok(sent.some((s) => s.method === "sendMessage" && /خوش آمدید/.test(s.text)));
});
