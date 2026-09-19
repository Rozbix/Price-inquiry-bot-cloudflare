// معادل دقیق set_webhook_bale.py نسخهٔ پایتون.
//
// اجرا:
//   export BALE_BOT_TOKEN="..."
//   export BALE_WEBHOOK_SECRET="یک-رشته-دلخواه-و-تصادفی"   (اختیاری - فعلا در کد استفاده نمی‌شود، به README نگاه کنید)
//   node scripts/setWebhookBale.js https://<subdomain>.workers.dev/webhook/bale

const TOKEN = process.env.BALE_BOT_TOKEN || "";
const SECRET = process.env.BALE_WEBHOOK_SECRET || "";

if (!TOKEN) {
  console.error("خطا: متغیر محیطی BALE_BOT_TOKEN تنظیم نشده.");
  process.exit(1);
}

const webhookUrl = process.argv[2];
if (!webhookUrl) {
  console.error("استفاده: node scripts/setWebhookBale.js https://<subdomain>.workers.dev/webhook/bale");
  process.exit(1);
}

async function main() {
  const setResp = await fetch(`https://tapi.bale.ai/bot${TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, secret_token: SECRET }),
  });
  console.log(await setResp.json());

  const cmdResp = await fetch(`https://tapi.bale.ai/bot${TOKEN}/setMyCommands`, {
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
}

main();
