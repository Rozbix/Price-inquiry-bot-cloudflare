// منطق «عضویت اجباری در کانال». پورت مستقیم bot/membership.py؛ طوری
// نوشته شده که هم برای تلگرام و هم برای بله (که همان ساختار
// getChatMember را دارد) قابل استفاده مجدد است: کافی‌ست ماژول api متناظر
// (که تابع async getChatMemberStatus(env, chatId, userId) را دارد) و
// لیست کانال‌ها را بدهید.

export const MEMBER_STATUSES = ["member", "administrator", "creator"];

export async function getMissingChannels(env, apiModule, channels, userId) {
  // برای هر کانال، عضویت userId را چک می‌کند و لیست کانال‌هایی که کاربر
  // هنوز عضو نیست را برمی‌گرداند. اگر status قابل تشخیص نبود (مثلا ربات
  // ادمین کانال نیست)، برای احتیاط همان کانال را هم «عضو نشده» در نظر
  // می‌گیریم تا کاربر واقعاً از دسترسی محروم نشود در حالتی که مطمئن
  // نیستیم.
  const missing = [];
  for (const ch of channels) {
    const status = await apiModule.getChatMemberStatus(env, ch.id, userId);
    if (!MEMBER_STATUSES.includes(status)) missing.push(ch);
  }
  return missing;
}

export function buildJoinMessage(missingChannels) {
  const lines = [
    "🔒 <b>عضویت در کانال الزامی است</b>",
    "",
    "برای استفاده از این ربات، ابتدا باید عضو کانال(های) زیر شوید:",
    "",
  ];
  for (const ch of missingChannels) {
    lines.push(`📢 ${ch.title} — @${ch.id.replace(/^@/, "")}`);
  }
  lines.push("");
  lines.push("بعد از عضویت، روی دکمهٔ «✅ عضو شدم» بزنید.");
  return lines.join("\n");
}

export function buildJoinKeyboard(missingChannels) {
  const kb = [];
  for (const ch of missingChannels) {
    kb.push([{ text: `📢 عضویت در ${ch.title}`, url: ch.url }]);
  }
  kb.push([{ text: "✅ عضو شدم", callback_data: "check_membership" }]);
  return { inline_keyboard: kb };
}
