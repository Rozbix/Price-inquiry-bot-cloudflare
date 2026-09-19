// تنظیمات ربات تلگرام: فقط داده‌های ایستا (دسته‌بندی‌ها، کانال‌های اجباری).
//
// نکتهٔ مهاجرت از پایتون: در نسخهٔ Railway این مقادیر با os.environ.get در
// زمان import خوانده می‌شدند. در Cloudflare Workers چیزی معادل
// process.env سراسری وجود ندارد؛ مقادیر محرمانه/محیطی فقط از طریق پارامتر
// env که به fetch()/scheduled() داده می‌شود در دسترس‌اند. برای همین در این
// پروژه هر تابعی که به یک secret نیاز دارد (توکن‌ها و ...) آن را به‌عنوان
// اولین آرگومان env می‌گیرد؛ این فایل فقط دادهٔ ایستا (بدون env) را نگه
// می‌دارد.

// ---------------------------------------------------------------------------
// عضویت اجباری در کانال (join gate) — دقیقا همان لیست نسخهٔ پایتون
// ---------------------------------------------------------------------------
export const REQUIRED_CHANNELS = [
  {
    id: "@nerkhemroozchand",
    title: "کانال نرخ امروز چند؟",
    url: "https://t.me/nerkhemroozchand",
  },
];

// ---------------------------------------------------------------------------
// دسته‌بندی‌های سطح اول منوی شیشه‌ای — دقیقا همان لیست‌های نسخهٔ پایتون
// ---------------------------------------------------------------------------

export const CURRENCY_KEYS = [
  "usd", "eur", "gbp", "aed", "try", "chf", "cny", "jpy", "krw", "cad",
  "aud", "nzd", "sgd", "hkd", "thb", "inr", "pkr", "afn", "iqd", "syp",
  "amd", "azn", "bhd", "dkk", "gel", "kgs", "kwd", "myr", "nok", "omr",
  "qar", "rub", "sar", "sek", "tjs", "tmt",
];

export const GOLD_COIN_KEYS = [
  "coin_emami", "coin_azadi", "coin_half", "coin_quarter", "coin_gram",
  "gold_18k", "gold_24k", "gold_used", "gold_mesghal", "gold_ounce",
  "silver_gram", "silver_ounce", "platinum_ounce", "palladium_ounce",
  "abshedeh_cash", "abshedeh_trade", "mesghal_no_bubble",
  "bubble_emami", "bubble_azadi", "bubble_half", "bubble_quarter", "bubble_gram",
  "fund_ayar", "fund_lotus", "fund_gohar", "fund_mesghal", "fund_kahreba",
  "fund_nab", "fund_riton", "fund_tabesh", "fund_zarvan",
];

export const CRYPTO_KEYS = [
  "btc", "eth", "usdt", "xrp", "bnb", "sol", "doge", "trx", "ada",
  "ton", "avax", "shib", "dot", "ltc", "bch", "xlm", "dash",
];

export const BOURSE_IR_KEYS = [
  "bourse_total", "bourse_market1", "bourse_market2",
  "bourse_pequal", "bourse_pweighted", "ifb_market1", "ifb_market2",
];

export const BOURSE_WORLD_KEYS = [
  "dow_jones", "nasdaq", "smi_swiss", "nifty_50", "ftse_100",
  "dax", "cac_40", "nikkei_225", "shanghai_composite", "ibex_35",
];

export const COMMODITY_KEYS = [
  "oil_crude", "oil_brent", "oil_opec", "gasoline", "natural_gas", "coal",
  "aluminum", "nickel", "lead", "zinc", "copper", "tin",
  "cotton", "sugar", "soybeans", "wheat", "corn", "rice",
];

export const CATEGORIES = {
  cur: { emoji: "💵", title: "ارزهای اصلی و سنتی", keys: CURRENCY_KEYS },
  gld: { emoji: "🪙", title: "طلا، سکه و حباب‌ها", keys: GOLD_COIN_KEYS },
  bur: { emoji: "📈", title: "شاخص‌های بورس و جهانی", keys: null }, // زیرمنو دارد
  cry: { emoji: "💎", title: "ارزهای دیجیتال", keys: CRYPTO_KEYS },
};

export const BOURSE_SUBCATEGORIES = {
  bir: { emoji: "🏛", title: "بورس و فرابورس ایران", keys: BOURSE_IR_KEYS },
  bwd: { emoji: "🌍", title: "شاخص‌های جهانی", keys: BOURSE_WORLD_KEYS },
  cmd: { emoji: "🛢", title: "کالا، نفت و فلزات", keys: COMMODITY_KEYS },
};

export const PAGE_SIZE = 8;

export function categoryEmojiForKey(symbolKey) {
  if (CURRENCY_KEYS.includes(symbolKey)) return "💵";
  if (GOLD_COIN_KEYS.includes(symbolKey)) return "🪙";
  if (CRYPTO_KEYS.includes(symbolKey)) return "💎";
  if (BOURSE_IR_KEYS.includes(symbolKey) || BOURSE_WORLD_KEYS.includes(symbolKey)) return "📈";
  if (COMMODITY_KEYS.includes(symbolKey)) return "🛢";
  return "🔹";
}
