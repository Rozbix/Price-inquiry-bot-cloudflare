// تماس مستقیم با HTTP API تلگرام. پورت مستقیم bot/telegram_api.py؛ در
// پایتون از requests استفاده می‌شد، اینجا از fetch() بومی Workers.

async function call(env, method, payload) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!data.ok) {
      console.log(`[telegram_api] ${method} failed: ${JSON.stringify(data)}`);
    }
    return data;
  } catch (e) {
    console.log(`[telegram_api] ${method} exception: ${e && e.message}`);
    return null;
  }
}

export async function sendMessage(env, chatId, text, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (replyMarkup !== null) payload.reply_markup = replyMarkup;
  return call(env, "sendMessage", payload);
}

export async function editMessageText(env, chatId, messageId, text, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (replyMarkup !== null) payload.reply_markup = replyMarkup;
  // اگر متن/کیبورد جدید دقیقا مثل قبل باشد، تلگرام خطای
  // "message is not modified" می‌دهد؛ این خطا بی‌ضرر است (مثلا وقتی
  // کاربر روی «بروزرسانی» می‌زند ولی قیمت هنوز عوض نشده).
  return call(env, "editMessageText", payload);
}

export async function answerCallbackQuery(env, callbackQueryId, text = null, showAlert = false) {
  const payload = { callback_query_id: callbackQueryId };
  if (text) {
    payload.text = text;
    payload.show_alert = showAlert;
  }
  return call(env, "answerCallbackQuery", payload);
}

export async function answerInlineQuery(env, inlineQueryId, results, cacheTime = 15) {
  const payload = {
    inline_query_id: inlineQueryId,
    results,
    cache_time: cacheTime,
    is_personal: false,
  };
  return call(env, "answerInlineQuery", payload);
}

export async function getChatMember(env, chatId, userId) {
  // برای بررسی عضویت کاربر در یک کانال/گروه استفاده می‌شود. نکته: ربات
  // باید خودش عضو (ترجیحاً ادمین) همان چت باشد وگرنه تلگرام خطا می‌دهد.
  return call(env, "getChatMember", { chat_id: chatId, user_id: userId });
}

export async function getChatMemberStatus(env, chatId, userId) {
  // فقط رشتهٔ status را برمی‌گرداند (مثلا 'member', 'left', 'kicked') یا
  // null اگر خطایی رخ داد (مثلا ربات ادمین کانال نیست).
  const result = await getChatMember(env, chatId, userId);
  if (result && result.ok) {
    return (result.result || {}).status || null;
  }
  return null;
}

export async function setMyCommands(env, commands) {
  return call(env, "setMyCommands", { commands });
}
