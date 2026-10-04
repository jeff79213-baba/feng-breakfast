import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  pad2, keyOf, dateKey, parseKey, addDays, weekOf, monthMatrix, todayKey,
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
