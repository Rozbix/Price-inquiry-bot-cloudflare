import test from "node:test";
import assert from "node:assert/strict";
import * as membership from "../src/bot/membership.js";

const channels = [{ id: "@nerkhemroozchand", title: "کانال نرخ امروز چند؟", url: "https://t.me/nerkhemroozchand" }];

function fakeApi(statusMap) {
  return {
    async getChatMemberStatus(env, chatId, userId) {
      return statusMap[`${chatId}:${userId}`] ?? null;
    },
  };
}

test("getMissingChannels returns empty when user is a member", async () => {
  const api = fakeApi({ "@nerkhemroozchand:10": "member" });
  const missing = await membership.getMissingChannels({}, api, channels, 10);
  assert.deepEqual(missing, []);
});

test("getMissingChannels returns the channel when user left / unknown status", async () => {
  const apiLeft = fakeApi({ "@nerkhemroozchand:10": "left" });
  assert.equal((await membership.getMissingChannels({}, apiLeft, channels, 10)).length, 1);

  // اگر status قابل تشخیص نبود (مثلا ربات ادمین کانال نیست)، برای احتیاط
  // «عضو نشده» در نظر گرفته می‌شود
  const apiUnknown = fakeApi({});
  assert.equal((await membership.getMissingChannels({}, apiUnknown, channels, 999)).length, 1);
});

test("administrator/creator statuses count as member", async () => {
  for (const status of ["administrator", "creator"]) {
    const api = fakeApi({ "@nerkhemroozchand:5": status });
    const missing = await membership.getMissingChannels({}, api, channels, 5);
    assert.deepEqual(missing, [], `status=${status} should count as joined`);
  }
});

test("buildJoinMessage and buildJoinKeyboard reference the channel and check-membership button", () => {
  const msg = membership.buildJoinMessage(channels);
  assert.match(msg, /عضویت در کانال الزامی/);
  assert.match(msg, /nerkhemroozchand/);

  const kb = membership.buildJoinKeyboard(channels);
  const flat = kb.inline_keyboard.flat();
  assert.ok(flat.some((b) => b.url === "https://t.me/nerkhemroozchand"));
  assert.ok(flat.some((b) => b.callback_data === "check_membership"));
});
