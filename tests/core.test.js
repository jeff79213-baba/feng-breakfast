import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  pad2, keyOf, dateKey, parseKey, addDays, weekOf, weekStartOf, monthMatrix, todayKey,
  BRACKETS, bracketOf, suggestDishes, suggestFruitDessert,
  DEFAULT_SUGGEST, SUGGEST_FIELDS, normalizeSuggest, suggestFor,
  peopleSum, peopleFor, emptyHead,
  DEFAULT_PREP, DEFAULT_SLOTS, DEFAULT_PANTRY,
  prepBase, prepLine, drinkTotals, pantrySplit, summaryLine,
  ROLES, normalizeEmail, isValidEmail, isValidRole, roleLabel, memberOf,
  ACCOUNT_DOMAIN, accountToEmail, DEFAULT_MEMBER_PASSWORD, isValidPassword,
  csvEscape, buildCsv,
} from '../core.js';

test('pad2 補零到兩位', () => {
  assert.equal(pad2(3), '03');
  assert.equal(pad2(12), '12');
});

test('keyOf 組出日期鍵', () => {
  assert.equal(keyOf(2026, 10, 4), '2026-10-04');
});

test('dateKey 以 Asia/Taipei 判定日期（UTC 深夜也要算台北的今天）', () => {
  assert.equal(dateKey(new Date('2026-10-04T16:30:00Z')), '2026-10-05');
  assert.equal(dateKey(new Date('2026-10-03T15:30:00Z')), '2026-10-03');
});

test('parseKey 反解日期鍵', () => {
  assert.deepEqual(parseKey('2026-10-04'), { y: 2026, m: 10, d: 4 });
});

test('addDays 跨月跨年都正確', () => {
  assert.equal(addDays('2026-10-04', 1), '2026-10-05');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('weekOf 回傳含當日共 7 天', () => {
  assert.deepEqual(weekOf('2026-10-04'), [
    '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07',
    '2026-10-08', '2026-10-09', '2026-10-10',
  ]);
});

test('weekStartOf 回傳當週週日', () => {
  assert.equal(weekStartOf('2026-10-04'), '2026-10-04');
  assert.equal(weekStartOf('2026-10-06'), '2026-10-04');
  assert.equal(weekStartOf('2026-10-10'), '2026-10-04');
  assert.equal(weekStartOf('2026-10-11'), '2026-10-11');
  assert.equal(weekStartOf('2026-10-01'), '2026-09-27');
});

test('monthMatrix 以週日為每週起點，並補齊前後月', () => {
  const weeks = monthMatrix(2026, 10);
  assert.ok(weeks.length >= 5 && weeks.length <= 6);
  for (const row of weeks) assert.equal(row.length, 7);
  assert.equal(weeks[0][0], '2026-09-27');
  assert.equal(weeks[0][4], '2026-10-01');
  const flat = weeks.flat();
  assert.ok(flat.includes('2026-10-31'));
  assert.ok(!flat.includes('2026-11-01'));
});

test('todayKey 回傳合法日期鍵', () => {
  assert.match(todayKey(), /^\d{4}-\d{2}-\d{2}$/);
});

test('bracketOf 把房間數四捨五入到 5 的倍數並夾在 5~30', () => {
  assert.deepEqual(BRACKETS, [5, 10, 15, 20, 25, 30]);
  assert.equal(bracketOf(0), 5);
  assert.equal(bracketOf(2), 5);
  assert.equal(bracketOf(3), 5);
  assert.equal(bracketOf(7), 5);
  assert.equal(bracketOf(8), 10);
  assert.equal(bracketOf(13), 15);
  assert.equal(bracketOf(23), 25);
  assert.equal(bracketOf(28), 30);
  assert.equal(bracketOf(40), 30);
  assert.equal(bracketOf(-5), 5);
  assert.equal(bracketOf('12'), 10);
  assert.equal(bracketOf(null), 5);
});

test('suggestDishes 對應規格表', () => {
  assert.deepEqual(suggestDishes(3), { meat: 1, veg: 1, egg: 1, side: 3, fry: 1, braise: 0 });
  assert.deepEqual(suggestDishes(12), { meat: 1, veg: 2, egg: 1, side: 3, fry: 1, braise: 1 });
  assert.deepEqual(suggestDishes(23), { meat: 1, veg: 4, egg: 1, side: 3, fry: 3, braise: 2 });
  assert.deepEqual(suggestDishes(35), { meat: 1, veg: 4, egg: 1, side: 3, fry: 3, braise: 2 });
});

test('suggestFruitDessert 對應規格表', () => {
  assert.deepEqual(suggestFruitDessert(3), { fruit: 2, dessert: 1 });
  assert.deepEqual(suggestFruitDessert(12), { fruit: 2, dessert: 1 });
  assert.deepEqual(suggestFruitDessert(15), { fruit: 3, dessert: 1 });
  assert.deepEqual(suggestFruitDessert(23), { fruit: 5, dessert: 2 });
  assert.deepEqual(suggestFruitDessert(35), { fruit: 6, dessert: 3 });
});

test('DEFAULT_SUGGEST 每個級距都有八個欄位', () => {
  assert.deepEqual(DEFAULT_SUGGEST.map(r => r.rooms), [5, 10, 15, 20, 25, 30]);
  for (const row of DEFAULT_SUGGEST) {
    for (const k of SUGGEST_FIELDS) assert.equal(typeof row[k], 'number');
  }
  assert.equal(DEFAULT_SUGGEST[0].meat, 1);
  assert.equal(DEFAULT_SUGGEST[0].fruit, 2);
});

test('normalizeSuggest 排序、補零、容錯', () => {
  const rows = normalizeSuggest([{ rooms: 20, veg: 5 }, { rooms: 10, meat: 2 }, null, 'x']);
  assert.deepEqual(rows.map(r => r.rooms), [10, 20]);
  assert.equal(rows[0].meat, 2);
  assert.equal(rows[0].veg, 0);
  assert.equal(rows[1].veg, 5);
  assert.equal(rows[0].dessert, 0);
});

test('suggestFor 依最近級距取自訂表；空表回全零；未給表用預設', () => {
  const custom = [
    { rooms: 5, meat: 9, veg: 9, egg: 9, side: 9, fry: 9, braise: 9, fruit: 9, dessert: 9 },
    { rooms: 30, meat: 1, veg: 1, egg: 1, side: 1, fry: 1, braise: 1, fruit: 1, dessert: 1 },
  ];
  assert.equal(suggestFor(6, custom).meat, 9);
  assert.equal(suggestFor(28, custom).meat, 1);
  assert.deepEqual(suggestFor(5, []), {
    meat: 0, veg: 0, egg: 0, side: 0, fry: 0, braise: 0, fruit: 0, dessert: 0,
  });
  assert.equal(suggestFor(12, null).veg, 2);
  assert.equal(suggestFor(12, null).fruit, 2);
});

test('emptyHead 全部為 0', () => {
  assert.deepEqual(emptyHead(), { rooms: 0, adult: 0, child: 0, infant: 0, kid: 0, total: 0 });
});

test('peopleSum 加總兩館並把嬰幼兒算進小孩', () => {
  const b1 = { rooms: 10, adult: 20, child: 5, infant: 2 };
  const b2 = { rooms: 8, adult: 16, child: 4, infant: 0 };
  assert.deepEqual(peopleSum(b1, b2), {
    rooms: 18, adult: 36, child: 9, infant: 2, kid: 11, total: 47,
  });
});

test('peopleSum 缺欄位視為 0', () => {
  assert.deepEqual(peopleSum(null, undefined), emptyHead());
  assert.deepEqual(peopleSum({ rooms: 3 }, { adult: 2 }), {
    rooms: 3, adult: 2, child: 0, infant: 0, kid: 0, total: 2,
  });
});

test('peopleFor 依 target 取單館或兩館合計', () => {
  const b1 = { rooms: 10, adult: 20, child: 5, infant: 2 };
  const b2 = { rooms: 8, adult: 16, child: 4, infant: 0 };
  assert.deepEqual(peopleFor('b1', b1, b2), {
    rooms: 10, adult: 20, child: 5, infant: 2, kid: 7, total: 27,
  });
  assert.deepEqual(peopleFor('b2', b1, b2), {
    rooms: 8, adult: 16, child: 4, infant: 0, kid: 4, total: 20,
  });
  assert.deepEqual(peopleFor('all', b1, b2), peopleSum(b1, b2));
  assert.deepEqual(peopleFor('ALL', b1, b2), peopleSum(b1, b2), 'target 大小寫不拘');
});

test('DEFAULT_PREP 係數符合規格', () => {
  assert.deepEqual(DEFAULT_PREP, {
    riceAdult: 0.2, riceChild: 0.1,
    porridgeAdult: 0.2, porridgeChild: 0.1,
    eggRatio: 1.5, eggStock: 0, eggReserveCount: 0, eggReservePct: 0,
  });
});

test('DEFAULT_SLOTS 五個時段且預設牛奶1 鋁箔包12', () => {
  assert.deepEqual(DEFAULT_SLOTS.map(s => s.label),
    ['08:00', '08:30', '09:00', '09:30', '10:00']);
  assert.deepEqual(DEFAULT_SLOTS.map(s => s.id), ['s0800', 's0830', 's0900', 's0930', 's1000']);
  for (const s of DEFAULT_SLOTS) {
    assert.equal(s.enabled, true);
    assert.equal(s.milk, 1);
    assert.equal(s.foil, 12);
  }
});

test('DEFAULT_PANTRY 內建 20 項且預設不在冰箱', () => {
  assert.equal(DEFAULT_PANTRY.length, 20);
  assert.ok(DEFAULT_PANTRY.every(p => p.inFridge === false));
  assert.ok(DEFAULT_PANTRY.some(p => p.name === '豆芽'));
});

test('prepBase 飯粥蛋用成人0.2 小孩0.1，小孩含嬰幼兒', () => {
  const day = {
    b1: { rooms: 10, adult: 20, child: 5, infant: 2 },
    b2: { rooms: 0, adult: 0, child: 0, infant: 0 },
  };
  const out = prepBase('b1', DEFAULT_PREP, day);
  assert.equal(out.head.kid, 7);
  assert.equal(out.head.total, 27);
  assert.equal(out.rice, 4.7);
  assert.equal(out.porridge, 4.7);
  assert.equal(out.egg, 41);
});

test('prepBase 茶葉蛋套用 eggStock 與 eggReserveCount 與 eggReservePct', () => {
  const day = { b1: { rooms: 1, adult: 10, child: 0, infant: 0 } };
  const cfg = { ...DEFAULT_PREP, eggStock: 5, eggReserveCount: 3, eggReservePct: 10 };
  assert.equal(prepBase('b1', cfg, day).egg, 15);
});

test('prepBase 不會算出負的蛋數', () => {
  const day = { b1: { rooms: 1, adult: 1, child: 0, infant: 0 } };
  const cfg = { ...DEFAULT_PREP, eggStock: 99 };
  assert.equal(prepBase('b1', cfg, day).egg, 0);
});

test('prepBase 合計目標用 all', () => {
  const day = {
    b1: { rooms: 10, adult: 20, child: 5, infant: 2 },
    b2: { rooms: 8, adult: 16, child: 4, infant: 0 },
  };
  const out = prepBase('all', DEFAULT_PREP, day);
  assert.equal(out.head.rooms, 18);
  assert.equal(out.head.total, 47);
  assert.equal(out.rice, 8.3);
  assert.equal(out.egg, 71);
});

test('prepBase 係數為 null 或 NaN 時改用 DEFAULT_PREP 而不是歸零', () => {
  const day = { b1: { rooms: 10, adult: 20, child: 5, infant: 2 } };
  const nullCfg = prepBase('b1', { riceAdult: null }, day);
  assert.equal(nullCfg.rice, 4.7);
  assert.equal(nullCfg.porridge, 4.7);
  assert.equal(nullCfg.egg, 41);
  const nanCfg = prepBase('b1', { eggRatio: NaN }, day);
  assert.equal(nanCfg.egg, 41);
  assert.equal(nanCfg.rice, 4.7);
});

test('prepBase 只給部分係數時其餘沿用 DEFAULT_PREP', () => {
  const day = { b1: { rooms: 1, adult: 10, child: 0, infant: 0 } };
  const out = prepBase('b1', { eggStock: 5 }, day);
  assert.equal(out.rice, 2);
  assert.equal(out.porridge, 2);
  assert.equal(out.egg, 10);
});

test('prepBase 係數為 undefined 或 Infinity 或空字串時視為未設定', () => {
  const day = { b1: { rooms: 1, adult: 10, child: 0, infant: 0 } };
  assert.equal(prepBase('b1', { eggStock: undefined }, day).egg, 15);
  assert.equal(prepBase('b1', { eggReservePct: Infinity }, day).egg, 15);
  assert.equal(prepBase('b1', { eggStock: '' }, day).egg, 15);
});

test('prepLine 顯示 base ＋額外 ＝合計', () => {
  assert.deepEqual(prepLine(6.7, 2), { base: 6.7, extra: 2, total: 8.7 });
  assert.deepEqual(prepLine(6.7, 0), { base: 6.7, extra: 0, total: 6.7 });
  assert.deepEqual(prepLine(41, -5), { base: 41, extra: 0, total: 41 }, '負的額外視為 0');
  assert.deepEqual(prepLine(6.7, 1.5), { base: 6.7, extra: 1.5, total: 8.2 }, '小數額外可用');
});

test('drinkTotals 只計 enabled 時段並可用當日覆寫數量', () => {
  const slots = [
    { id: 's0800', label: '08:00', enabled: true, milk: 1, foil: 12 },
    { id: 's0900', label: '09:00', enabled: true, milk: 1, foil: 12 },
    { id: 's1000', label: '10:00', enabled: false, milk: 1, foil: 12 },
  ];
  const out = drinkTotals(slots, { milkPerSlot: 1, foilPerSlot: 12 }, {
    drinks: { s0900: { milk: 2, foil: 18 } },
  });
  assert.equal(out.rows.length, 2, '停用時段不列入');
  assert.equal(out.milk, 3);
  assert.equal(out.foil, 30);
  assert.deepEqual(out.rows[1], { id: 's0900', label: '09:00', milk: 2, foil: 18, done: false });
  assert.equal(out.pendingMilk, 3);
  assert.equal(out.pendingFoil, 30);
});

test('drinkTotals 已勾完成的時段不列入待補貨', () => {
  const slots = DEFAULT_SLOTS;
  const out = drinkTotals(slots, { milkPerSlot: 1, foilPerSlot: 12 }, {
    drinks: { s0800: { done: true }, s0830: { done: true } },
  });
  assert.equal(out.milk, 5);
  assert.equal(out.pendingMilk, 3);
  assert.equal(out.pendingFoil, 36);
});

test('pantrySplit 勾選=冰箱有，未勾=要買', () => {
  const items = [
    { id: 'a', name: '小白菜', inFridge: true },
    { id: 'b', name: '豆芽', inFridge: false },
    { id: 'c', name: '雞胸肉', inFridge: true },
  ];
  const out = pantrySplit(items);
  assert.equal(out.has.length, 2);
  assert.equal(out.buy.length, 1);
  assert.equal(out.buy[0].name, '豆芽');
});

test('summaryLine 組出勾選摘要文字', () => {
  assert.equal(summaryLine(['滷豬耳', '控肉']), '滷豬耳、控肉');
  assert.equal(summaryLine([]), '（未選）');
});

test('normalizeEmail 去除空白並轉小寫', () => {
  assert.equal(normalizeEmail('  Wind@Gmail.COM '), 'wind@gmail.com');
  assert.equal(normalizeEmail(''), '');
  assert.equal(normalizeEmail(null), '');
  assert.equal(normalizeEmail(undefined), '');
});

test('isValidEmail 只接受有網域的完整信箱', () => {
  assert.equal(isValidEmail('wind@gmail.com'), true);
  assert.equal(isValidEmail('a.b+c@sub.domain.tw'), true);
  assert.equal(isValidEmail('a@b'), false);
  assert.equal(isValidEmail('a b@c.com'), false);
  assert.equal(isValidEmail('@c.com'), false);
  assert.equal(isValidEmail(''), false);
  assert.equal(isValidEmail(null), false);
  assert.equal(isValidEmail('a@' + 'b'.repeat(250) + '.com'), false);
});

test('isValidRole 只認 admin 與 editor', () => {
  assert.deepEqual(ROLES, ['admin', 'editor']);
  assert.equal(isValidRole('admin'), true);
  assert.equal(isValidRole('editor'), true);
  assert.equal(isValidRole('owner'), false);
  assert.equal(isValidRole('staff'), false);
  assert.equal(isValidRole(null), false);
});

test('memberOf 驗證白名單文件後給出正規化結果', () => {
  assert.deepEqual(memberOf(' A@B.com ', { role: 'admin' }), { email: 'a@b.com', role: 'admin' });
  assert.deepEqual(memberOf('c@d.com', { role: 'editor' }), { email: 'c@d.com', role: 'editor' });
  assert.equal(memberOf('e@f.com', { role: 'owner' }), null);
  assert.equal(memberOf('e@f.com', {}), null);
  assert.equal(memberOf('broken', { role: 'admin' }), null);
  assert.equal(memberOf('g@h.com', null), null);
});

test('roleLabel 對應畫面文字', () => {
  assert.equal(roleLabel('admin'), '主帳號');
  assert.equal(roleLabel('editor'), '員工');
  assert.equal(roleLabel('owner'), '未知');
  assert.equal(roleLabel(null), '未知');
});

test('csvEscape 處理逗號、引號、換行與 null', () => {
  assert.equal(csvEscape('小白菜'), '小白菜');
  assert.equal(csvEscape('滷豬耳,控肉'), '"滷豬耳,控肉"');
  assert.equal(csvEscape('說"好吃"'), '"說""好吃"""');
  assert.equal(csvEscape('第一行\n第二行'), '"第一行\n第二行"');
  assert.equal(csvEscape(null), '');
});

test('buildCsv 開頭帶 BOM 且每列欄位數一致', () => {
  const csv = buildCsv([['日期', '項目'], ['2026-10-04', '小白菜']]);
  assert.ok(csv.startsWith('\uFEFF'));
  const lines = csv.replace('\uFEFF', '').split('\r\n');
  assert.equal(lines[0], '日期,項目');
  assert.equal(lines[1], '2026-10-04,小白菜');
});

test('csvEscape 開頭是公式字元時加單引號前綴擋掉注入', () => {
  assert.equal(csvEscape('=1+1'), "'=1+1");
  assert.equal(csvEscape('+SUM(A1)'), "'+SUM(A1)");
  assert.equal(csvEscape('-2+3'), "'-2+3");
  assert.equal(csvEscape('@A1'), "'@A1");
  assert.equal(csvEscape('\t開頭'), "'\t開頭");
  assert.equal(csvEscape('\r開頭'), '"\'\r開頭"');
  assert.equal(csvEscape('小白菜'), '小白菜', '正常值不得被加前綴');
  assert.equal(csvEscape('說"好吃",很讚'), '"說""好吃"",很讚"', '正常值轉義不變');
});

test('buildCsv 會轉義含逗號、引號、換行的欄位', () => {
  const csv = buildCsv([['菜色', '備註'], ['說"好吃",很讚', '第一行\n第二行']]);
  assert.equal(csv, '\uFEFF菜色,備註\r\n"說""好吃"",很讚","第一行\n第二行"');
});

test('accountToEmail 短帳號自動補網域', () => {
  assert.equal(accountToEmail('wind'), `wind@${ACCOUNT_DOMAIN}`);
  assert.equal(accountToEmail('  Wind  '), `wind@${ACCOUNT_DOMAIN}`);
  assert.equal(accountToEmail('staff1'), `staff1@${ACCOUNT_DOMAIN}`);
  assert.equal(accountToEmail('a.b_c-d'), `a.b_c-d@${ACCOUNT_DOMAIN}`);
});

test('accountToEmail 已是完整信箱則直接採用', () => {
  assert.equal(accountToEmail('wind@fzbf.app'), 'wind@fzbf.app');
  assert.equal(accountToEmail('Boss@Gmail.COM'), 'boss@gmail.com');
});

test('isValidPassword 只接受至少 6 碼的字串', () => {
  assert.equal(DEFAULT_MEMBER_PASSWORD, '000000');
  assert.equal(isValidPassword(DEFAULT_MEMBER_PASSWORD), true);
  assert.equal(isValidPassword('12345678'), true);
  assert.equal(isValidPassword('12345'), false);
  assert.equal(isValidPassword(''), false);
  assert.equal(isValidPassword(null), false);
  assert.equal(isValidPassword(undefined), false);
  assert.equal(isValidPassword(123456), false);
});

test('accountToEmail 擋掉非法輸入與路徑穿越', () => {
  assert.equal(accountToEmail(''), null);
  assert.equal(accountToEmail(null), null);
  assert.equal(accountToEmail('a/b'), null);
  assert.equal(accountToEmail('../x'), null);
  assert.equal(accountToEmail('a/b@fzbf.app'), null);
  assert.equal(accountToEmail('有空白 帳號'), null);
  assert.equal(accountToEmail('@'), null);
  assert.equal(accountToEmail('wind@'), null);
});
