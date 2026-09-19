// پیاده‌سازی دقیق سه متد مستندشدهٔ eitaayar.ir. آدرس فراخوانی طبق
// مستندات: https://eitaayar.ir/api/TOKEN/METHOD_NAME

export function cleanHtml(text) {
  if (!text) return text;
  return String(text).replace(/<[^>]*>/g, "");
}

async function call(env, method, payload) {
  const url = `https://eitaayar.ir/api/${env.EITAA_TOKEN}/${method}`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!data.ok) {
      console.log(`[eitaa_api] ${method} failed: ${JSON.stringify(data)}`);
    }
    return data;
  } catch (e) {
    console.log(`[eitaa_api] ${method} exception: ${e && e.message}`);
    return null;
  }
}

export async function getMe(env) {
  // ساده‌ترین متد؛ بدون ورودی، برای تست صحت توکن مفید است.
  return call(env, "getMe", {});
}

export async function sendMessage(env, chatId, text, { title, disableNotification, pin } = {}) {
  // ارسال پیام متنی. chatId می‌تواند یوزرنیم کانال بدون @ باشد (مثلا
  // 'nerkhemroozchand') یا شناسهٔ عددی.
  const payload = { chat_id: chatId, text: cleanHtml(text) };
  if (title) payload.title = cleanHtml(title);
  if (disableNotification !== undefined) payload.disable_notification = disableNotification ? 1 : 0;
  if (pin !== undefined) payload.pin = pin ? 1 : 0;
  return call(env, "sendMessage", payload);
}

export async function sendFile(env, chatId, fileUrlOrPath, caption = null) {
  // ارسال فایل/مدیا.
  const payload = { chat_id: chatId, file: fileUrlOrPath };
  if (caption) payload.caption = cleanHtml(caption);
  return call(env, "sendFile", payload);
}
