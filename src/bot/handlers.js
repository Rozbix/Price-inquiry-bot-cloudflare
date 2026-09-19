// پردازش هر Update دریافتی از تلگرام (پیام، کلیک روی دکمهٔ شیشه‌ای، یا
// inline query برای autofill). پورت مستقیم bot/handlers.py؛ فقط env به
// همهٔ توابع اضافه شده چون Workers معادل os.environ سراسری ندارد.

import * as config from "./config.js";
import * as db from "./db.js";
import * as fmt from "./format.js";
import * as kb from "./keyboards.js";
import * as membership from "./membership.js";
import * as tg from "./telegram_api.js";

export function getWelcomeText(env) {
  const username = env.BOT_USERNAME || "nerkhemrooz_bot";
  return (
    "👋 به <b>ربات نرخ امروز چند؟</b> خوش آمدید!\n\n" +
    "از منوی زیر یکی از دسته‌ها را انتخاب کنید، یا برای جستجوی سریع کافی‌ست " +
    "بخشی از نام یک نماد (مثلا «دلار» یا «سکه») را همین‌جا تایپ کنید.\n\n" +
    "💡 در هر چت دیگری هم می‌توانید با نوشتن " +
    `<code>@${username} نام نماد</code> به‌صورت آنی پیشنهاد بگیرید.`
  );
}

export async function handleUpdate(update, env) {
  if (update.message) {
    await handleMessage(update.message, env);
  } else if (update.callback_query) {
    await handleCallback(update.callback_query, env);
  } else if (update.inline_query) {
    await handleInlineQuery(update.inline_query, env);
  }
}

// ---------------------------------------------------------------------------
// عضویت اجباری در کانال (join gate)
// ---------------------------------------------------------------------------

async function checkGate(env, userId) {
  // اگر کاربر عضو همهٔ کانال‌های اجباری بود null برمی‌گرداند (یعنی اجازه
  // عبور دارد)، وگرنه لیست کانال‌های ناقص را برمی‌گرداند.
  if (!config.REQUIRED_CHANNELS.length) return null;
  const missing = await membership.getMissingChannels(env, tg, config.REQUIRED_CHANNELS, userId);
  return missing.length ? missing : null;
}

async function sendGateMessage(env, chatId, missingChannels) {
  await tg.sendMessage(
    env,
    chatId,
    membership.buildJoinMessage(missingChannels),
    membership.buildJoinKeyboard(missingChannels)
  );
}

// ---------------------------------------------------------------------------
// پیام‌های معمولی (دستورها + جستجوی متنی)
// ---------------------------------------------------------------------------

async function handleMessage(message, env) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = (message.text || "").trim();

  if (text === "/start" || text === "/help") {
    await tg.sendMessage(env, chatId, getWelcomeText(env), kb.mainMenu());
    const missing = await checkGate(env, userId);
    if (missing) await sendGateMessage(env, chatId, missing);
    return;
  }

  // از اینجا به بعد، برای هر دستور/پیام دیگر ابتدا عضویت را چک می‌کنیم
  const missing = await checkGate(env, userId);
  if (missing) {
    await sendGateMessage(env, chatId, missing);
    return;
  }

  if (text === "/watchlist") {
    await sendWatchlist(env, chatId, userId);
    return;
  }

  if (!text || text.startsWith("/")) {
    await tg.sendMessage(env, chatId, "دستور ناشناخته. برای شروع /start را بزنید.", kb.mainMenu());
    return;
  }

  // هر متن آزاد دیگر = جستجوی سریع
  const results = await db.searchItems(env, text, 10);
  if (!results.length) {
    await tg.sendMessage(
      env,
      chatId,
      `🔍 برای «${text}» نتیجه‌ای پیدا نشد.\nاملای دیگری را امتحان کنید یا از منوی اصلی استفاده کنید.`,
      kb.mainMenu()
    );
    return;
  }

  await tg.sendMessage(env, chatId, `🔍 نتایج جستجو برای «${text}»:`, kb.searchResultsKeyboard(results));
}

async function sendWatchlist(env, chatId, userId) {
  const keys = await db.getWatchlistKeys(env, userId);
  const rows = await db.getItems(env, keys);
  await tg.sendMessage(env, chatId, fmt.buildWatchlistMessage(rows), kb.watchlistKeyboard(rows));
}

// ---------------------------------------------------------------------------
// کلیک روی دکمه‌های شیشه‌ای
// ---------------------------------------------------------------------------

async function handleCallback(cq, env) {
  const data = cq.data || "";
  const chatId = cq.message.chat.id;
  const messageId = cq.message.message_id;
  const userId = cq.from.id;
  const cqId = cq.id;

  try {
    // دکمهٔ «✅ عضو شدم» همیشه قابل کلیک است (خودش عضویت را می‌سنجد)
    if (data === "check_membership") {
      const missing = await checkGate(env, userId);
      if (missing) {
        const names = missing.map((ch) => ch.title).join("، ");
        await tg.answerCallbackQuery(env, cqId, `هنوز عضو این کانال(ها) نشده‌اید: ${names}`, true);
        return;
      }
      await tg.answerCallbackQuery(env, cqId, "🎉 عضویت شما تایید شد!");
      await tg.editMessageText(
        env,
        chatId,
        messageId,
        "🎉 عضویت شما تایید شد! حالا می‌توانید از ربات استفاده کنید.\n\n" + getWelcomeText(env),
        kb.mainMenu()
      );
      return;
    }

    // برای بقیهٔ دکمه‌ها، اول عضویت را چک می‌کنیم
    const missing = await checkGate(env, userId);
    if (missing) {
      await tg.answerCallbackQuery(env, cqId, "🔒 لطفاً ابتدا عضو کانال(های) لازم شوید.", true);
      await sendGateMessage(env, chatId, missing);
      return;
    }

    if (data === "home") {
      await tg.editMessageText(env, chatId, messageId, getWelcomeText(env), kb.mainMenu());
    } else if (data === "burmenu") {
      await tg.editMessageText(
        env,
        chatId,
        messageId,
        "📈 <b>شاخص‌های بورس و جهانی</b>\nیکی از زیردسته‌ها را انتخاب کنید:",
        kb.bourseSubmenu()
      );
    } else if (data === "watchlist") {
      const keys = await db.getWatchlistKeys(env, userId);
      const rows = await db.getItems(env, keys);
      await tg.editMessageText(env, chatId, messageId, fmt.buildWatchlistMessage(rows), kb.watchlistKeyboard(rows));
    } else if (data === "search_prompt") {
      const username = env.BOT_USERNAME || "nerkhemrooz_bot";
      await tg.editMessageText(
        env,
        chatId,
        messageId,
        "🔍 <b>جستجوی پیشرفته</b>\n\nبخشی از نام نماد مورد نظر را تایپ و ارسال کنید " +
          "(مثلا «یورو» یا «بیت‌کوین»)؛ ربات نزدیک‌ترین نتایج را نشان می‌دهد.\n\n" +
          `💡 در هر چت دیگری هم با <code>@${username} نام</code> autofill می‌گیرید.`,
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
      await tg.answerCallbackQuery(env, cqId, "⭐ به دیده‌بان اضافه شد.");
      await showItem(env, chatId, messageId, userId, key, origin, parseInt(pageS, 10));
      return;
    } else if (data.startsWith("fav_del:")) {
      const [, key, origin, pageS] = data.split(":");
      await db.removeFromWatchlist(env, userId, key);
      await tg.answerCallbackQuery(env, cqId, "🗑 از دیده‌بان حذف شد.");
      await showItem(env, chatId, messageId, userId, key, origin, parseInt(pageS, 10));
      return;
    } else if (data === "noop_search") {
      await tg.answerCallbackQuery(env, cqId, "برای جستجوی دوباره، عبارت جدید را تایپ کنید.");
      return;
    }

    await tg.answerCallbackQuery(env, cqId);
  } catch (e) {
    console.log(`[handlers] callback error: ${e && e.message}`);
    await tg.answerCallbackQuery(env, cqId, "⚠️ خطایی رخ داد، دوباره تلاش کنید.");
  }
}

async function showList(env, chatId, messageId, origin, page) {
  const keys = kb.resolveKeys(origin);
  if (keys === null) {
    await tg.editMessageText(env, chatId, messageId, getWelcomeText(env), kb.mainMenu());
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
  await tg.editMessageText(env, chatId, messageId, text, kb.listKeyboard(origin, page, rows, keys.length));
}

async function showItem(env, chatId, messageId, userId, symbolKey, origin, page) {
  const row = await db.getItem(env, symbolKey);
  if (row === null) {
    await tg.editMessageText(env, chatId, messageId, "❌ این نماد پیدا نشد (ممکن است حذف شده باشد).", kb.mainMenu());
    return;
  }
  const isFav = await db.isInWatchlist(env, userId, symbolKey);
  const text = fmt.buildItemMessage(row);
  await tg.editMessageText(env, chatId, messageId, text, kb.itemDetailKeyboard(symbolKey, origin, page, isFav));
}

// ---------------------------------------------------------------------------
// Inline mode (autofill در هر چتی با @ عبارت)
// ---------------------------------------------------------------------------
// توجه: عمداً اینجا هیچ gate عضویتی اعمال نشده. تلگرام هیچ راهی برای
// نمایش پیام «باید عضو شوید» داخل نتایج inline در اختیار نمی‌گذارد، و اگر
// نتیجه‌ای برنگردانیم، کاربر فقط یک لیست خالی می‌بیند (گیج‌کننده). محدودیت
// واقعی همان جایی اعمال می‌شود که کاربر وارد چت خود ربات می‌شود.

async function handleInlineQuery(iq, env) {
  const query = (iq.query || "").trim();
  const iqId = iq.id;

  let results = [];
  if (query) {
    const rows = await db.searchItems(env, query, 20);
    results = rows.map((row) => {
      const text = fmt.buildItemMessage(row);
      return {
        type: "article",
        id: crypto.randomUUID(),
        title: `${row.title_fa} — ${row.price}`,
        description: `تغییر: ${row.change_amount} (${row.change_percent})`,
        input_message_content: {
          message_text: text,
          parse_mode: "HTML",
        },
      };
    });
  }

  await tg.answerInlineQuery(env, iqId, results);
}
