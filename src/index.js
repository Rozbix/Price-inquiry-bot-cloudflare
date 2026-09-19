// نقطهٔ ورود Worker. معادل app.py نسخهٔ Railway: همان دو مسیر وبهوک
// (/webhook برای تلگرام، /webhook/bale برای بله) + یک مسیر جدید برای
// فراخوانی دستی گزارش ایتا (چون CLI محلی eitaa/broadcaster.py در Workers
// معادل مستقیم ندارد) + یک scheduled() اختیاری برای Cron Trigger.
//
// نکتهٔ مهم دربارهٔ رفتار فعلی حفظ‌شده: نسخهٔ پایتون هیچ ارسال خودکار
// زمان‌بندی‌شده‌ای برای ایتا نداشت (فقط دستی/با کرون بیرونی). برای همین
// اینجا هم scheduled() به‌صورت پیش‌فرض هیچ کاری نمی‌کند مگر این‌که صریحاً
// با متغیر EITAA_CRON_CATEGORY فعالش کنید (به README نگاه کنید).

import { handleUpdate as handleTelegramUpdate } from "./bot/handlers.js";
import { handleUpdate as handleBaleUpdate } from "./bale/handlers.js";
import { sendCategoryDigest } from "./eitaa/broadcaster.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function readJsonSafe(request) {
  try {
    return await request.json();
  } catch (e) {
    return {};
  }
}

async function handleTelegramWebhook(request, env) {
  const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
  if (env.WEBHOOK_SECRET && secretHeader !== env.WEBHOOK_SECRET) {
    return json({ ok: false, error: "invalid secret" }, 403);
  }

  const update = await readJsonSafe(request);
  try {
    // دقیقاً مثل نسخهٔ Flask: پردازش قبل از پاسخ‌دادن انجام می‌شود (نه
    // پس‌زمینه)، تا رفتار و ترتیب پیام‌ها با نسخهٔ قبلی یکسان بماند.
    await handleTelegramUpdate(update, env);
  } catch (e) {
    // هرگز نباید خطای داخلی باعث شود تلگرام کد غیر ۲۰۰ ببیند (وگرنه
    // همان آپدیت را دوباره و دوباره retry می‌کند)
    console.log(`[webhook] unhandled error: ${e && e.message}`);
  }
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// مسیر بله. اگر BALE_BOT_TOKEN تنظیم نشده باشد، این مسیر هم‌چنان بالا
// می‌آید ولی هر درخواستی را رد می‌کند (بی‌ضرر برای دیپلوی‌هایی که فقط
// تلگرام می‌خواهند).
// ---------------------------------------------------------------------------

async function handleBaleWebhook(request, env) {
  if (!env.BALE_BOT_TOKEN) {
    return json({ ok: false, error: "bale not configured" }, 404);
  }

  // نکته: طبق تجربهٔ واقعی نسخهٔ پایتون در تولید، بررسی هدر مخفی بله چون
  // نام هدر دقیق مستند نیست، غیرفعال نگه داشته شده (دقیقاً مثل کد فعلی
  // Railway که app.py این بخش را کامنت کرده بود). اگر بعداً نام دقیق هدر
  // را پیدا کردید، همین‌جا اضافه کنید.
  // const secretHeader = request.headers.get("X-Bale-Bot-Api-Secret-Token") || request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
  // if (env.BALE_WEBHOOK_SECRET && secretHeader !== env.BALE_WEBHOOK_SECRET) {
  //   return json({ ok: false, error: "invalid secret" }, 403);
  // }

  const update = await readJsonSafe(request);
  try {
    await handleBaleUpdate(update, env);
  } catch (e) {
    console.log(`[webhook_bale] unhandled error: ${e && e.message}`);
  }
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// فراخوانی دستی گزارش ایتا (معادل `python -m eitaa.broadcaster <cat>` که
// در Workers دیگر CLI محلی به secrets واقعی دسترسی ندارد). با یک سکرت
// جداگانه محافظت می‌شود تا کسی نتواند بدون اجازه به کانال شما پیام بفرستد.
// ---------------------------------------------------------------------------

async function handleEitaaBroadcast(request, env) {
  if (!env.EITAA_TOKEN) {
    return json({ ok: false, error: "eitaa not configured" }, 404);
  }

  const url = new URL(request.url);
  const providedSecret =
    request.headers.get("X-Broadcast-Secret") || url.searchParams.get("secret") || "";
  const expectedSecret = env.EITAA_BROADCAST_SECRET || env.WEBHOOK_SECRET || "";
  if (expectedSecret && providedSecret !== expectedSecret) {
    return json({ ok: false, error: "invalid secret" }, 403);
  }

  const category = url.searchParams.get("category") || "cur";
  try {
    const result = await sendCategoryDigest(env, category);
    return json({ ok: true, category, telegram_style_result: result });
  } catch (e) {
    console.log(`[eitaa_broadcast] error: ${e && e.message}`);
    return json({ ok: false, error: String(e && e.message) }, 500);
  }
}

function healthResponse(extra = {}) {
  return json({ ok: true, service: "تلگرام‌بات نرخ امروز چند؟", ...extra });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path === "/" && method === "GET") {
      return healthResponse();
    }

    if (path === "/webhook" && method === "POST") {
      return handleTelegramWebhook(request, env);
    }
    if (path === "/webhook" && method === "GET") {
      return healthResponse();
    }

    if (path === "/webhook/bale" && method === "POST") {
      return handleBaleWebhook(request, env);
    }
    if (path === "/webhook/bale" && method === "GET") {
      return healthResponse({
        service: "ربات بله - نرخ امروز چند؟",
        configured: Boolean(env.BALE_BOT_TOKEN),
      });
    }

    if (path === "/eitaa/broadcast" && (method === "POST" || method === "GET")) {
      return handleEitaaBroadcast(request, env);
    }

    return json({ ok: false, error: "not found" }, 404);
  },

  async scheduled(controller, env, ctx) {
    // معادل اختیاری کرون برای ارسال خودکار گزارش ایتا. طبق رفتار فعلی
    // پروژه (که چنین ارسال خودکاری نداشت)، این تابع فقط وقتی کاری انجام
    // می‌دهد که صریحاً EITAA_CRON_CATEGORY تنظیم شده باشد؛ در غیر این
    // صورت هیچ کاری نمی‌کند و رفتار پیش‌فرض بدون تغییر می‌ماند.
    if (!env.EITAA_CRON_CATEGORY) {
      console.log("[scheduled] EITAA_CRON_CATEGORY تنظیم نشده؛ کاری انجام نشد.");
      return;
    }
    ctx.waitUntil(
      sendCategoryDigest(env, env.EITAA_CRON_CATEGORY).catch((e) =>
        console.log(`[scheduled] خطا در ارسال گزارش ایتا: ${e && e.message}`)
      )
    );
  },
};
