import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  pad2, keyOf, dateKey, parseKey, addDays, weekOf, monthMatrix, todayKey,
  BRACKETS, bracketOf, suggestDishes, suggestFruitDessert,
  peopleSum, peopleFor, emptyHead,
} from '../core.js';

test('pad2 補零到兩位', () => {
  assert.equal(pad2(3), '03');
  assert.equal(pad2(12), '12');
});

test('keyOf 組出日期鍵', () => {
  assert.equal(keyOf(2026, 10, 4), '2026-10-04');
});

test('dateKey 以 Asia/Taipei 判定日期（UTC 深夜也要算台北的今天）', () => {
  // 2026-10-04T16:30Z = 2026-10-05 00:30 台北
  assert.equal(dateKey(new Date('2026-10-04T16:30:00Z')), '2026-10-05');
  // 2026-10-03T15:30Z = 2026-10-03 23:30 台北
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

test('monthMatrix 以週日為每週起點，並補齊前後月', () => {
  const weeks = monthMatrix(2026, 10);
  assert.ok(weeks.length >= 5 && weeks.length <= 6);
  for (const row of weeks) assert.equal(row.length, 7);
  // 2026-10-01 是星期四，前面補 4 天（週日~週三）
  assert.equal(weeks[0][0], '2026-09-27');
  assert.equal(weeks[0][4], '2026-10-01');
  // 最後一列必須含 10/31
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
