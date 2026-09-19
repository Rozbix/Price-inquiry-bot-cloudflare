// پردازش هر Update دریافتی از بله. تقریباً همان منطق bot/handlers.js
// تلگرام است (چون API بله بر پایهٔ API بات تلگرام است)، با تفاوت‌های
// زیر (همگی عیناً از نسخهٔ در حال اجرای فعلی روی Railway کپی شده‌اند):
// ۱) بله inline mode ندارد، پس هیچ handleInlineQuery ای اینجا نیست.
// ۲) پیام‌های ارسالی از کانال/سوپرگروه نادیده گرفته می‌شوند (چون وقتی
//    ربات را در کانال ادمین می‌کنید، بله پست‌های کانال را هم به وبهوک
//    می‌فرستد و نباید آن‌ها را «پیام کاربر» تلقی کرد).
// ۳) بررسی عضویت اجباری فقط برای چت خصوصی (پیوی) اعمال می‌شود.

import * as fmt from "../bot/format.js";
import * as kb from "../bot/keyboards.js";
import * as membership from "../bot/membership.js";

import * as config from "./config.js";
import * as baleApi from "./api.js";
import * as db from "./db.js";

export function getWelcomeText() {
  const lines = [
    "👋 به <b>ربات نرخ امروز چند؟</b> خوش آمدید!",
    "",
    "از منوی زیر یکی از دسته‌ها را انتخاب کنید، یا برای جستجوی سریع کافی‌ست " +
      "بخشی از نام یک نماد (مثلا «دلار» یا «سکه») را همین‌جا تایپ کنید.",
  ];
  return lines.join("\n");
}

export async function handleUpdate(update, env) {
  if (update.message) {
    const msg = update.message;
    const chat = msg.chat || {};
    const chatType = chat.type || "private";

    // اگر پیام از طرف کانال یا سوپرگروه باشد، کلاً نادیده گرفته می‌شود
    if (chatType === "channel" || chatType === "supergroup") return;

    await handleMessage(msg, env);
  } else if (update.callback_query) {
    await handleCallback(update.callback_query, env);
  }
  // بله inline_query ندارد؛ اگر هم در آپدیت بیاید، نادیده گرفته می‌شود.
}

// ---------------------------------------------------------------------------
// عضویت اجباری در کانال
// ---------------------------------------------------------------------------

async function checkGate(env, userId, chatObj = null) {
  // بررسی عضویت اجباری فقط برای چت‌های خصوصی (پیوی). اگر چت از نوع
  // کانال/گروه باشد یا شناسه منفی داشته باشد، بررسی کلاً لغو می‌شود.
  if (!config.REQUIRED_CHANNELS.length) return null;

  if (chatObj) {
    const chatType = chatObj.type || "";
    const chatId = chatObj.id || 0;
    if (
      chatType === "channel" ||
      chatType === "supergroup" ||
      chatType === "group" ||
      (Number.isInteger(chatId) && chatId < 0)
    ) {
      return null;
    }
  }

  const missing = await membership.getMissingChannels(env, baleApi, config.REQUIRED_CHANNELS, userId);
  return missing.length ? missing : null;
}

async function sendGateMessage(env, chatId, missingChannels) {
  await baleApi.sendMessage(
    env,
    chatId,
    membership.buildJoinMessage(missingChannels),
    membership.buildJoinKeyboard(missingChannels)
  );
}

// ---------------------------------------------------------------------------
// پیام‌های معمولی
// ---------------------------------------------------------------------------

async function handleMessage(message, env) {
  const chat = message.chat;
  const chatId = chat.id;
  const chatType = chat.type || "private";
  const userId = message.from.id;
  const text = (message.text || "").trim();

  // اگر پیام از چت خصوصی (پیوی) نباشد، هیچ پاسخی ارسال نشود
  if (chatType !== "private") return;

  if (text === "/start" || text === "/help") {
    await baleApi.sendMessage(env, chatId, getWelcomeText(), kb.mainMenu());
    const missing = await checkGate(env, userId, chat);
    if (missing) await sendGateMessage(env, chatId, missing);
    return;
  }

  const missing = await checkGate(env, userId, chat);
  if (missing) {
    await sendGateMessage(env, chatId, missing);
    return;
  }

  if (text === "/watchlist") {
    await sendWatchlist(env, chatId, userId);
    return;
  }

  if (!text || text.startsWith("/")) {
    await baleApi.sendMessage(env, chatId, "دستور ناشناخته. برای شروع /start را بزنید.", kb.mainMenu());
    return;
  }

  const results = await db.searchItems(env, text, 10);
  if (!results.length) {
    await baleApi.sendMessage(
      env,
      chatId,
      `🔍 برای «${text}» نتیجه‌ای پیدا نشد.\nاملای دیگری را امتحان کنید یا از منوی اصلی استفاده کنید.`,
      kb.mainMenu()
    );
    return;
  }

  await baleApi.sendMessage(env, chatId, `🔍 نتایج جستجو برای «${text}»:`, kb.searchResultsKeyboard(results));
}

async function sendWatchlist(env, chatId, userId) {
  const keys = await db.getWatchlistKeys(env, userId);
  const rows = await db.getItems(env, keys);
  await baleApi.sendMessage(env, chatId, fmt.buildWatchlistMessage(rows), kb.watchlistKeyboard(rows));
}

// ---------------------------------------------------------------------------
// کلیک روی دکمه‌های شیشه‌ای
// ---------------------------------------------------------------------------

async function handleCallback(cq, env) {
  const data = cq.data || "";
  const chat = cq.message.chat;
  const chatId = chat.id;
  const messageId = cq.message.message_id;
  const userId = cq.from.id;
  const cqId = cq.id;

  try {
    if (data === "check_membership") {
      const missing = await checkGate(env, userId, chat);
      if (missing) {
        const names = missing.map((ch) => ch.title).join("، ");
        await baleApi.answerCallbackQuery(env, cqId, `هنوز عضو این کانال(ها) نشده‌اید: ${names}`, true);
        return;
      }
      await baleApi.answerCallbackQuery(env, cqId, "🎉 عضویت شما تایید شد!");
      await baleApi.editMessageText(
        env,
        chatId,
        messageId,
        "🎉 عضویت شما تایید شد! حالا می‌توانید از ربات استفاده کنید.\n\n" + getWelcomeText(),
        kb.mainMenu()
      );
      return;
    }

    const missing = await checkGate(env, userId, chat);
    if (missing) {
      await baleApi.answerCallbackQuery(env, cqId, "🔒 لطفاً ابتدا عضو کانال(های) لازم شوید.", true);
      await sendGateMessage(env, chatId, missing);
      return;
    }

    if (data === "home") {
      await baleApi.editMessageText(env, chatId, messageId, getWelcomeText(), kb.mainMenu());
    } else if (data === "burmenu") {
      await baleApi.editMessageText(
        env,
        chatId,
        messageId,
        "📈 <b>شاخص‌های بورس و جهانی</b>\nیکی از زیردسته‌ها را انتخاب کنید:",
        kb.bourseSubmenu()
      );
    } else if (data === "watchlist") {
      const keys = await db.getWatchlistKeys(env, userId);
      const rows = await db.getItems(env, keys);
      await baleApi.editMessageText(env, chatId, messageId, fmt.buildWatchlistMessage(rows), kb.watchlistKeyboard(rows));
    } else if (data === "search_prompt") {
      await baleApi.editMessageText(
        env,
        chatId,
        messageId,
        "🔍 <b>جستجوی پیشرفته</b>\n\nبخشی از نام نماد مورد نظر را تایپ و ارسال کنید " +
          "(مثلا «یورو» یا «بیت‌کوین»)؛ ربات نزدیک‌ترین نتایج را نشان می‌دهد.",
        { inline_keyboard: [[{ text: "🏠 منوی اصلی", callback_data: "home" }]] }
      );
    } else if (data.startsWith("cat:") || data.startsWith("sub:") || data.startsWith("refresh_list:")) {
      const [, origin, pageS] = data.split(":");
      await showList(env, chatId, messageId, origin, parseInt(pageS, 10));
    } else if (data.startsWith("item:") || data.startsWith("refresh_item:")) {
      const [, key, origin, pageS] = data.split(":");
      await showItem(env, chatId, messageId, userId, key, origin, parseInt(pageS, 10));
    } else if (data.startsWith("fav_add:")) {
      const [, key, origin, pageS] = data.split(":");
      await db.addToWatchlist(env, userId, key);
      await baleApi.answerCallbackQuery(env, cqId, "⭐ به دیده‌بان اضافه شد.");
      await showItem(env, chatId, messageId, userId, key, origin, parseInt(pageS, 10));
      return;
    } else if (data.startsWith("fav_del:")) {
      const [, key, origin, pageS] = data.split(":");
      await db.removeFromWatchlist(env, userId, key);
      await baleApi.answerCallbackQuery(env, cqId, "🗑 از دیده‌بان حذف شد.");
      await showItem(env, chatId, messageId, userId, key, origin, parseInt(pageS, 10));
      return;
    } else if (data === "noop_search") {
      await baleApi.answerCallbackQuery(env, cqId, "برای جستجوی دوباره، عبارت جدید را تایپ کنید.");
      return;
    }

    await baleApi.answerCallbackQuery(env, cqId);
  } catch (e) {
    console.log(`[bale_handlers] callback error: ${e && e.message}`);
    await baleApi.answerCallbackQuery(env, cqId, "⚠️ خطایی رخ داد، دوباره تلاش کنید.");
  }
}

async function showList(env, chatId, messageId, origin, page) {
  const keys = kb.resolveKeys(origin);
  if (keys === null) {
    await baleApi.editMessageText(env, chatId, messageId, getWelcomeText(), kb.mainMenu());
    return;
  }

  const start = page * config.PAGE_SIZE;
  const pageKeys = keys.slice(start, start + config.PAGE_SIZE);
  const rows = await db.getItems(env, pageKeys);

  let title = null;
  if (config.CATEGORIES[origin]) {
    const cat = config.CATEGORIES[origin];
    title = `${cat.emoji} <b>${cat.title}</b>`;
  } else if (config.BOURSE_SUBCATEGORIES[origin]) {
    const cat = config.BOURSE_SUBCATEGORIES[origin];
    title = `${cat.emoji} <b>${cat.title}</b>`;
  }

  const text = `${title}\n\nبرای مشاهده جزئیات هر مورد، روی آن بزنید:`;
  await baleApi.editMessageText(env, chatId, messageId, text, kb.listKeyboard(origin, page, rows, keys.length));
}

async function showItem(env, chatId, messageId, userId, symbolKey, origin, page) {
  const row = await db.getItem(env, symbolKey);
  if (row === null) {
    await baleApi.editMessageText(env, chatId, messageId, "❌ این نماد پیدا نشد (ممکن است حذف شده باشد).", kb.mainMenu());
    return;
  }
  const isFav = await db.isInWatchlist(env, userId, symbolKey);
  const text = fmt.buildItemMessage(row);
  await baleApi.editMessageText(env, chatId, messageId, text, kb.itemDetailKeyboard(symbolKey, origin, page, isFav));
}
