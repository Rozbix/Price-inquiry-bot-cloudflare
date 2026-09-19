// این اسکریپت را روی کامپیوتر خودتان (نه داخل Worker) اجرا کنید تا به
// تلگرام بگویید آپدیت‌ها را به کجا بفرستد. معادل دقیق set_webhook.py
// نسخهٔ پایتون.
//
// اجرا:
//   export TELEGRAM_BOT_TOKEN="..."
//   export WEBHOOK_SECRET="یک-رشته-دلخواه-و-تصادفی"
//   node scripts/setWebhookTelegram.js https://<subdomain>.workers.dev/webhook

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const SECRET = process.env.WEBHOOK_SECRET || "";

if (!TOKEN) {
  console.error("خطا: متغیر محیطی TELEGRAM_BOT_TOKEN تنظیم نشده.");
  process.exit(1);
}

const webhookUrl = process.argv[2];
if (!webhookUrl) {
  console.error("استفاده: node scripts/setWebhookTelegram.js https://<subdomain>.workers.dev/webhook");
  process.exit(1);
}

async function main() {
  const setResp = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: SECRET,
      allowed_updates: ["message", "callback_query", "inline_query"],
    }),
  });
  console.log(await setResp.json());

  const cmdResp = await fetch(`https://api.telegram.org/bot${TOKEN}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commands: [
        { command: "start", description: "شروع و نمایش منوی اصلی" },
        { command: "watchlist", description: "نمایش دیده‌بان من" },
        { command: "help", description: "راهنما" },
      ],
    }),
  });
  console.log(await cmdResp.json());

  const infoResp = await fetch(`https://api.telegram.org/bot${TOKEN}/getWebhookInfo`);
  console.log("وضعیت فعلی وبهوک:", await infoResp.json());
}

main();
