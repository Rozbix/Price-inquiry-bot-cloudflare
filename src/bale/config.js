// تنظیمات ایستای ربات بله. توکن/سکرت‌ها env-dependent هستند و مستقیم از
// env در نقطهٔ استفاده خوانده می‌شوند (به توضیح بالای bot/config.js نگاه
// کنید). دسته‌بندی‌ها را از bot/config.js «قرض» می‌گیریم تا در دو جا
// تعریف نشوند و همیشه هماهنگ بمانند.

import * as tgConfig from "../bot/config.js";

export const CATEGORIES = tgConfig.CATEGORIES;
export const BOURSE_SUBCATEGORIES = tgConfig.BOURSE_SUBCATEGORIES;
export const PAGE_SIZE = tgConfig.PAGE_SIZE;
export const categoryEmojiForKey = tgConfig.categoryEmojiForKey;

// کانال اجباری برای بله (نسخهٔ پایتون فعلی همین یک کانال را دارد؛ برای
// افزودن کانال دوم یک آبجکت دیگر به این آرایه اضافه کنید).
export const REQUIRED_CHANNELS = [
  {
    id: "@nerkhemroozchand",
    title: "کانال نرخ امروز چند؟",
    url: "https://ble.ir/nerkhemroozchand",
  },
];
