// تماس مستقیم با HTTP API بله (tapi.bale.ai). API بله «بر پایهٔ API بات
// تلگرام و با تغییراتی جزئی» طراحی شده، برای همین ساختار این فایل تقریبا
// عین bot/telegram_api.js است. طبق تجربهٔ واقعی نسخهٔ پایتون در تولید:
// بله از inline mode و از parse_mode (مثل HTML) پشتیبانی نمی‌کند، پس
// تگ‌ها پیش از ارسال پاک‌سازی می‌شوند (cleanHtml) — این رفتار عیناً از
// نسخهٔ در حال اجرای فعلی کپی شده، نه یک حدس جدید.

export function cleanHtml(text) {
  if (!text) return text;
  return String(text).replace(/<[^>]*>/g, "");
}

async function call(env, method, payload) {
  const url = `https://tapi.bale.ai/bot${env.BALE_BOT_TOKEN}/${method}`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!data.ok) {
      console.log(`[bale_api] ${method} failed: ${JSON.stringify(data)}`);
    }
    return data;
  } catch (e) {
    console.log(`[bale_api] ${method} exception: ${e && e.message}`);
    return null;
  }
}

export async function sendMessage(env, chatId, text, replyMarkup = null) {
  const payload = { chat_id: chatId, text: cleanHtml(text) };
  if (replyMarkup !== null) payload.reply_markup = replyMarkup;
  return call(env, "sendMessage", payload);
}

export async function editMessageText(env, chatId, messageId, text, replyMarkup = null) {
  const payload = { chat_id: chatId, message_id: messageId, text: cleanHtml(text) };
  if (replyMarkup !== null) payload.reply_markup = replyMarkup;
  return call(env, "editMessageText", payload);
}

export async function answerCallbackQuery(env, callbackQueryId, text = null, showAlert = false) {
  const payload = { callback_query_id: callbackQueryId };
  if (text) {
    payload.text = cleanHtml(text);
    payload.show_alert = showAlert;
  }
  return call(env, "answerCallbackQuery", payload);
}

export async function getChatMember(env, chatId, userId) {
  return call(env, "getChatMember", { chat_id: chatId, user_id: userId });
}

export async function getChatMemberStatus(env, chatId, userId) {
  const result = await getChatMember(env, chatId, userId);
  if (result && result.ok) {
    return (result.result || {}).status || null;
  }
  return null;
}

export async function setMyCommands(env, commands) {
  return call(env, "setMyCommands", { commands });
}
