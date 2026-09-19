import test from "node:test";
import assert from "node:assert/strict";
import * as kb from "../src/bot/keyboards.js";

test("mainMenu has the 6 expected buttons with correct callback_data", () => {
  const menu = kb.mainMenu();
  const flat = menu.inline_keyboard.flat();
  const dataList = flat.map((b) => b.callback_data);
  assert.deepEqual(dataList, ["cat:cur:0", "cat:gld:0", "burmenu", "cat:cry:0", "search_prompt", "watchlist"]);
});

test("resolveKeys returns category or subcategory keys, null for unknown", () => {
  assert.ok(Array.isArray(kb.resolveKeys("cur")));
  assert.ok(Array.isArray(kb.resolveKeys("bir")));
  assert.equal(kb.resolveKeys("bur"), null); // 'bur' itself has keys: null (has submenu)
  assert.equal(kb.resolveKeys("nope"), null);
});

test("listKeyboard pagination: next/prev buttons appear only when needed", () => {
  const rows = [{ symbol_key: "usd", title_fa: "دلار", price: "1", change_amount: "0" }];
  // 20 total items, page 0, page size 8 => should show "next" but not "prev"
  const kb0 = kb.listKeyboard("cur", 0, rows, 20);
  const flat0 = kb0.inline_keyboard.flat().map((b) => b.callback_data);
  assert.ok(flat0.includes("cat:cur:1"));
  assert.ok(!flat0.some((d) => d === "cat:cur:-1"));

  // page 1 of 20 items (page size 8) => both prev and next
  const kb1 = kb.listKeyboard("cur", 1, rows, 20);
  const flat1 = kb1.inline_keyboard.flat().map((b) => b.callback_data);
  assert.ok(flat1.includes("cat:cur:0"));
  assert.ok(flat1.includes("cat:cur:2"));

  // last page => no next
  const kbLast = kb.listKeyboard("cur", 2, rows, 20); // pages 0,1,2 (0-7,8-15,16-19)
  const flatLast = kbLast.inline_keyboard.flat().map((b) => b.callback_data);
  assert.ok(!flatLast.includes("cat:cur:3"));
});

test("listKeyboard uses sub: prefix and burmenu back-button for bourse subcategories", () => {
  const kbSub = kb.listKeyboard("bir", 0, [], 3);
  const flat = kbSub.inline_keyboard.flat().map((b) => b.callback_data);
  assert.ok(flat.includes("burmenu"));
  assert.ok(flat.includes("home"));
});

test("itemDetailKeyboard shows correct favourite toggle and back target per origin", () => {
  const notFav = kb.itemDetailKeyboard("usd", "cur", 0, false);
  assert.equal(notFav.inline_keyboard[0][0].callback_data, "fav_add:usd:cur:0");

  const fav = kb.itemDetailKeyboard("usd", "cur", 0, true);
  assert.equal(fav.inline_keyboard[0][0].callback_data, "fav_del:usd:cur:0");

  const fromCat = kb.itemDetailKeyboard("usd", "cur", 2, false);
  const backRowCat = fromCat.inline_keyboard[fromCat.inline_keyboard.length - 1];
  assert.ok(backRowCat.some((b) => b.callback_data === "cat:cur:2"));

  const fromSearch = kb.itemDetailKeyboard("usd", "srch", 0, false);
  const backRowSearch = fromSearch.inline_keyboard[fromSearch.inline_keyboard.length - 1];
  assert.ok(backRowSearch.some((b) => b.callback_data === "noop_search"));

  const fromWatchlist = kb.itemDetailKeyboard("usd", "wl", 0, false);
  const backRowWl = fromWatchlist.inline_keyboard[fromWatchlist.inline_keyboard.length - 1];
  assert.ok(backRowWl.some((b) => b.callback_data === "watchlist"));
});
