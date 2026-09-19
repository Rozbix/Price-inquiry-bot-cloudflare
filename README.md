# 🤖 ربات نسخهٔ Cloudflare Workers

مهاجرت کامل پروژهٔ Railway/Flask (تلگرام + بله + ایتا) به **Cloudflare
Workers**، با هدف حذف هزینهٔ اجرا در بلندمدت. منطق و خروجی ربات نسبت به
نسخهٔ قبلی **بدون تغییر عمدی** باقی مانده؛ فقط لایهٔ اجرا (runtime) عوض
شده است.

---

## 🧠 معماری در یک نگاه

```
تلگرام  --> POST /webhook       ---\
بله     --> POST /webhook/bale  ----+-->  Worker واحد (src/index.js)
درخواست دستی --> GET/POST /eitaa/broadcast  ---/         |
Cron Trigger (اختیاری، پیش‌فرض خاموش) --> scheduled()      |
                                                            v
                              src/bot, src/bale, src/eitaa
                              (همان منطق پایتون، پورت‌شده به JS)
                                                            |
                                                            v
                         Turso  (از طریق @libsql/client/web — HTTP)
```

هیچ D1/KV در این پروژه لازم نشد: تنها دیتابیس مورد نیاز همان Turso فعلی
شماست (`market_prices` + جدول‌های `watchlist`/`watchlist_bale`) و
`@libsql/client/web` مستقیماً و رسمی توسط خود Cloudflare برای اتصال
Workers به Turso معرفی شده (سند رسمی:
developers.cloudflare.com/workers/databases/native-integrations/turso).

### ساختار فایل‌ها

```
cloudflare-worker/
├── src/
│   ├── index.js              # نقطهٔ ورود: روتینگ + scheduled()
│   ├── bot/                   # ربات تلگرام (پورت کامل نسخهٔ پایتون)
│   │   ├── config.js, db.js, format.js, keyboards.js
│   │   ├── membership.js, telegram_api.js, handlers.js
│   ├── bale/                  # ربات بله (مستقل، جدول watchlist جدا)
│   │   ├── config.js, api.js, db.js, handlers.js
│   └── eitaa/                 # ارسال گزارش به کانال ایتا (send-only)
│       ├── config.js, api.js, broadcaster.js
├── test/                       # ۳۱ تست واقعی (node:test + mock.module)
├── scripts/
│   ├── setWebhookTelegram.js   # اجرای محلی: ثبت وبهوک تلگرام
│   └── setWebhookBale.js       # اجرای محلی: ثبت وبهوک بله
├── wrangler.toml
├── package.json
├── .dev.vars.example            # قالب Secretهای تست محلی (خودِ فایل .dev.vars هرگز کامیت نشود)
└── .gitignore
```

---

## 🔁 چرا JavaScript (نه Python)؟

Cloudflare یک ران‌تایم آزمایشی «Python Workers» هم دارد، اما مبتنی بر
Pyodide است و پکیج‌های native (مثل `libsql_experimental` که نسخهٔ قبلی
شما استفاده می‌کرد، یا `flask`/`gunicorn`) در آن اجرا نمی‌شوند. مسیر
پایدار و رسمی برای این نوع پروژه (وبهوک + دیتابیس) در Workers همان
JavaScript/TypeScript با `@libsql/client/web` است — دقیقاً همان چیزی که
مستندات رسمی Cloudflare برای اتصال به Turso پیشنهاد می‌دهد. برای همین کل
پروژه به JavaScript ساده (بدون مرحلهٔ کامپایل TypeScript، برای سادگی)
بازنویسی شد.

---

## 🌍 متغیرهای محیطی و Secretها

| نام | نوع | اجباری؟ | توضیح |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Secret | ✅ | توکن ربات تلگرام از BotFather |
| `TURSO_DATABASE_URL` | Secret | ✅ | آدرس دیتابیس Turso (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | Secret | ✅ | توکن Turso |
| `WEBHOOK_SECRET` | Secret | ✅ | رشتهٔ دلخواه برای اعتبارسنجی وبهوک تلگرام |
| `BOT_USERNAME` | Var (در wrangler.toml) | خیر (پیش‌فرض `nerkhemrooz_bot`) | برای متن خوش‌آمد و autofill |
| `BALE_BOT_TOKEN` | Secret | فقط اگر بله می‌خواهید | توکن ربات بله |
| `BALE_WEBHOOK_SECRET` | Secret | خیر (فعلاً چک آن غیرفعال است، پایین توضیح داده شده) | |
| `EITAA_TOKEN` | Secret | فقط اگر ایتا می‌خواهید | توکن از پنل eitaayar.ir |
| `EITAA_CHAT_ID` | Var (در wrangler.toml) | خیر (پیش‌فرض `nerkhemroozchand`) | یوزرنیم/شناسهٔ کانال مقصد گزارش |
| `EITAA_BROADCAST_SECRET` | Secret | توصیه‌شده | محافظت از مسیر `/eitaa/broadcast` در برابر فراخوانی ناخواسته |
| `EITAA_CRON_CATEGORY` | Var (اختیاری) | خیر | اگر ست شود، Cron Trigger هر بار این دسته را به‌صورت خودکار پست می‌کند |

**Secret** یعنی با `wrangler secret put NAME` تنظیم می‌شود (رمزگذاری‌شده،
هرگز در کد/گیت نیست). **Var** یعنی در بخش `[vars]` خودِ `wrangler.toml`
است (چون محرمانه نیست).

---

## 🚀 راه‌اندازی، قدم‌به‌قدم

### ۱) پیش‌نیاز
```bash
npm install
```

### ۲) ورود به Cloudflare
```bash
npx wrangler login
```

### ۳) تنظیم Secretها (هرکدام را جدا اجرا کنید، مقدار را تعاملی وارد می‌کنید)
```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TURSO_DATABASE_URL
npx wrangler secret put TURSO_AUTH_TOKEN
npx wrangler secret put WEBHOOK_SECRET

# اختیاری - فقط اگر بله می‌خواهید:
npx wrangler secret put BALE_BOT_TOKEN

# اختیاری - فقط اگر ایتا می‌خواهید:
npx wrangler secret put EITAA_TOKEN
npx wrangler secret put EITAA_BROADCAST_SECRET
```
مقادیر غیرمحرمانه (`BOT_USERNAME`, `EITAA_CHAT_ID`) از قبل در
`wrangler.toml` تنظیم شده‌اند؛ اگر خواستید عوضشان کنید، مستقیم همان فایل
را ویرایش کنید.

### ۴) دیپلوی
```bash
npx wrangler deploy
```
خروجی یک آدرس مثل `https://nerkhemroozchand-bot.<your-subdomain>.workers.dev`
می‌دهد.

### ۵) ثبت وبهوک تلگرام (روی کامپیوتر خودتان)
```bash
export TELEGRAM_BOT_TOKEN="همان توکن"
export WEBHOOK_SECRET="همان مقدار قدم ۳"
node scripts/setWebhookTelegram.js https://<آدرس-ورکر-شما>/webhook
```

### ۶) (اختیاری) ثبت وبهوک بله
```bash
export BALE_BOT_TOKEN="..."
node scripts/setWebhookBale.js https://<آدرس-ورکر-شما>/webhook/bale
```
> بله را حتماً در کانالتان ادمین کنید (برای عملکرد قفل عضویت، دقیقاً مثل
> تلگرام).

### ۷) تست سریع بعد از دیپلوی
```bash
curl https://<آدرس-ورکر-شما>/
curl https://<آدرس-ورکر-شما>/webhook
curl https://<آدرس-ورکر-شما>/webhook/bale
```
هرکدام باید `{"ok":true, ...}` برگردانند.

---

## ⏰ ارسال خودکار گزارش ایتا (Cron Trigger) — اختیاری

نسخهٔ قبلی هیچ ارسال خودکاری برای ایتا نداشت (فقط دستی/کرون بیرونی).
همین رفتار پیش‌فرض این نسخه هم هست: `scheduled()` وجود دارد ولی تا وقتی
فعالش نکنید کاری نمی‌کند. برای فعال کردن:

1. در `wrangler.toml` دو خط زیر را از حالت کامنت خارج کنید:
   ```toml
   [triggers]
   crons = ["0 */6 * * *"]   # هر ۶ ساعت یک‌بار، وقت UTC
   ```
2. در همان فایل، `EITAA_CRON_CATEGORY` را روی یکی از کدهای دسته بگذارید
   (`cur`, `gld`, `cry`, `bir`, `bwd`, `cmd`).
3. `npx wrangler deploy` را دوباره بزنید.

Cloudflare تا ۵ Cron Trigger رایگان در هر اکانت اجازه می‌دهد — این پروژه
فقط به یکی نیاز دارد.

### فراخوانی دستی گزارش ایتا (معادل CLI پایتون)
نسخهٔ پایتون با `python -m eitaa.broadcaster cur` اجرا می‌شد. چون Workers
CLI محلی با دسترسی به secretهای واقعی ندارد، معادلش یک مسیر HTTP
محافظت‌شده با سکرت است:
```bash
curl "https://<آدرس-ورکر-شما>/eitaa/broadcast?category=cur&secret=<EITAA_BROADCAST_SECRET>"
```

---

## 🧪 گزارش تست‌ها

### ✅ واقعاً اجرا و تأیید شد
1. **۳۱ تست unit/integration** (`npm test`؛ Node.js `node:test` +
   `mock.module` واقعی، نه شبیه‌سازی دستی) — همه پاس. پوشش می‌دهد:
   فرمت‌بندی اعداد/قیمت (`parseNumber`, `formatNumber`, `yesterdayPrice`)،
   ساخت کیبورد و صفحه‌بندی، منطق کامل قفل عضویت (join/gate/check_membership)،
   کل مسیر آپدیت تلگرام (start → gate → browse → item → fav_add → search →
   inline query)، رفتار خاص بله (نادیده‌گرفتن پیام کانال/سوپرگروه، عبور از
   gate در چت گروهی)، و ساخت/ارسال گزارش ایتا.
   - در همین فرآیند یک باگ واقعی (`buildDigestTextAsync is not defined`)
     پیدا و رفع شد.
2. **`npx wrangler deploy --dry-run`** واقعاً اجرا شد: کل پروژه (همراه
   `@libsql/client/web`) با esbuild باندل شد → **۲۰۵.۹۴ KiB (۴۰.۷۸ KiB
   gzip)**، بدون خطای resolve/syntax. این یعنی کد از نظر Workers runtime
   قابل‌اجراست، نه فقط از نظر Node.js.
3. **`npx wrangler dev --local`** (اجرای واقعی Miniflare، نه Node ساده) و
   تست با `curl` واقعی روی HTTP:
   - `GET /` و `GET /webhook` و `GET /webhook/bale` → `200` با JSON درست
   - مسیر ناشناخته → `404`
   - `POST /webhook` با سکرت غلط → `403`
   - `POST /webhook` با سکرت درست + `/start` → `200`، و لاگ‌ها نشان دادند
     جریان کامل (sendMessage → getChatMember → sendMessage دوم برای پیام
     عضویت) دقیقاً طبق انتظار اجرا شد؛ فقط چون sandbox من به
     `api.telegram.org`/`turso.io` دسترسی خروجی ندارد، خودِ درخواست‌های
     شبکه‌ای شکست خوردند — و **دقیقاً همین شکست را کد گرفت و همچنان ۲۰۰
     برگرداند** (رفتار مطلوب: تلگرام هرگز retry بی‌پایان نکند).
   - همین الگو برای `/webhook/bale` هم با توکن fake تکرار و تأیید شد.
   - `/eitaa/broadcast` با سکرت درست → مسیر احراز هویت را رد کرد، به DB
     وصل شد (و چون DB واقعی نبود خطا داد)، و بعد از رفع یک باگ کوچک
     (نبود try/catch)، حالا خطا را تمیز و به‌صورت JSON برمی‌گرداند نه
     stack trace خام.
   - `GET /__scheduled?cron=...` (شبیه‌سازی رسمی Cron Trigger خودِ
     wrangler) → اجرا شد و چون `EITAA_CRON_CATEGORY` ست نبود، طبق طراحی
     هیچ کاری نکرد (رفتار پیش‌فرض حفظ شد).

### ❌ چیزهایی که واقعاً تست *نشدند* (نیاز به Secret/سرویس واقعی دارند)
- اتصال واقعی به دیتابیس Turso شما (من فقط ساختار کوئری‌ها را تست کردم؛
  چون `TURSO_AUTH_TOKEN` واقعی ندارم و sandbox من به `*.turso.io` هم
  دسترسی خروجی ندارد).
- ارسال واقعی پیام به تلگرام/بله/ایتا (چون توکن واقعی ندارم و
  `api.telegram.org`/`tapi.bale.ai`/`eitaayar.ir` هم در sandbox من
  مسدودند).
- دیپلوی واقعی روی حساب Cloudflare شما (`wrangler deploy` بدون `--dry-run`
  نیاز به لاگین دارد که من ندارم).
- ثبت واقعی وبهوک نزد تلگرام/بله.
- رفتار واقعی Cron Trigger روی زیرساخت واقعی Cloudflare (فقط شبیه‌سازی
  محلی‌اش تست شد).

**روش تست نهایی توسط خودتان:** دقیقاً مراحل «راه‌اندازی» بالا را طی
کنید؛ در هر قدم یک `curl` برای همان مسیر گذاشته‌ام تا فوراً متوجه خطا
بشوید. اگر جایی خطا داد، تب **Logs** پروژه در داشبورد Cloudflare
(یا `npx wrangler tail`) دقیق‌ترین سرنخ را می‌دهد.

---

## ⚖️ مقایسهٔ کوتاه Railway ⇄ Cloudflare Workers

| | Railway (قبلی) | Cloudflare Workers (این نسخه) |
|---|---|---|
| هزینه | پلن Free محدود به $۱ اعتبار/ماه، معمولاً نیاز به کارت | پلن Free واقعی، تا ۱۰۰هزار درخواست/روز رایگان، ۵ Cron Trigger رایگان |
| مدل اجرا | کانتینر همیشه‌روشن (Flask + gunicorn) | Serverless edge (کد فقط هنگام درخواست اجرا می‌شود) |
| اتصال به Turso | `libsql_experimental` (native binding) | `@libsql/client/web` (HTTP، رسمی برای Workers) |
| متغیر محیطی | `os.environ` سراسری | پارامتر `env` در هر تابع (به کد اضافه شد، رفتار یکسان) |
| اتصال DB بین درخواست‌ها | یک اتصال TCP پایدار با auto-reconnect دستی روی خطای «stream expired» | هر کوئری یک درخواست HTTP مستقل (این کلاس خطا اصولاً رخ نمی‌دهد)؛ یک retry عمومی برای اطمینان نگه داشته شده |
| Inline mode تلگرام | ✅ | ✅ (بدون تغییر) |
| قفل عضویت کانال | ✅ | ✅ (بدون تغییر، همان منطق) |
| بله | ✅ (وبهوک) | ✅ (وبهوک، بدون تغییر رفتار) |
| ایتا | ارسال گزارش با CLI/کرون بیرونی | ارسال گزارش با مسیر HTTP محافظت‌شده + Cron Trigger داخلی اختیاری (معادل، نه حذف‌شده) |
| نیاز به کارت بانکی | معمولاً بله (حتی برای Free) | خیر برای پلن Free Workers |
| Deploy | `git push` → دیپلوی خودکار | `wrangler deploy` (دستی) یا اتصال گیت‌هاب در داشبورد Cloudflare برای دیپلوی خودکار |

هیچ قابلیتی از نسخهٔ قبلی حذف نشده؛ فقط دو مورد به‌خاطر ماهیت متفاوت
Workers **معادل‌سازی** شدند (اتصال DB و اجرای دستی گزارش ایتا)، که هر دو
بالا توضیح داده شدند.
