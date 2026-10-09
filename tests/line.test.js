import { test } from 'vitest';
import assert from 'node:assert/strict';
import { buildLineMessage } from '../line.js';

const head = (rooms, adult, child, infant) => ({ rooms, adult, child, infant });

const targets = () => ({
  meat: [], veg: [], egg: [], side: [], fry: [], braise: [], fruit: [], dessert: [],
});

function makeDay() {
  return {
    date: '2026-10-09',
    head: { b1: head(5, 6, 2, 1), b2: head(3, 4, 1, 0) },
    dishes: {
      b1: { ...targets(), meat: ['三杯G', '咖哩G'], veg: ['清炒空心菜'], fruit: ['香蕉'] },
      b2: { ...targets(), meat: ['咖哩肉（豬）'] },
      all: { ...targets(), meat: ['三杯G', '咖哩肉（豬）'], dessert: ['蛋糕'] },
    },
    extra: { b1: ['香腸（烤）'], b2: [], all: [] },
    prep: {
      rice: { extra: 0 }, porridge: { extra: 0 }, egg: { extra: 0 },
      custom: [], done: {},
    },
  };
}

const cfg = { prep: { riceAdult: 0.2, riceChild: 0.1, porridgeAdult: 0.2, porridgeChild: 0.1, eggRatio: 1.5, eggStock: 0, eggReserveCount: 0, eggReservePct: 0 } };

test('預設三段：一館、二館、一館+二館（合計）', () => {
  const msg = buildLineMessage({ date: '2026-10-09', day: makeDay(), cfg });
  assert.match(msg, /^【風自然早餐】10\/9（五）/);
  assert.match(msg, /▍一館\n/);
  assert.match(msg, /▍二館\n/);
  assert.match(msg, /▍一館\+二館（合計）\n/);
});

test('人數含房間與大人/小孩/嬰幼兒及總數', () => {
  const msg = buildLineMessage({ date: '2026-10-09', day: makeDay(), cfg });
  assert.match(msg, /👥 房間 5・大人 6、小孩 2、嬰幼兒 1（共 9 人）/);
  assert.match(msg, /👥 房間 8・大人 10、小孩 3、嬰幼兒 1（共 14 人）/);
});

test('只列有選的分類，含水果與多備菜色', () => {
  const msg = buildLineMessage({ date: '2026-10-09', day: makeDay(), cfg });
  assert.match(msg, /肉：三杯G、咖哩G/);
  assert.match(msg, /水果：香蕉/);
  assert.match(msg, /多備菜色：香腸（烤）/);
  assert.ok(!msg.includes('炸物：'), '未選分類不應出現');
});

test('每段最後有飯/粥/茶葉蛋數量', () => {
  const msg = buildLineMessage({ date: '2026-10-09', day: makeDay(), cfg });
  assert.match(msg, /🍚 飯 1\.5 米杯・粥 1\.5 米杯・茶葉蛋 14 顆/);
  assert.match(msg, /🍚 飯 0\.9 米杯・粥 0\.9 米杯・茶葉蛋 8 顆/);
});

test('可只勾選部分館別', () => {
  const msg = buildLineMessage({ date: '2026-10-09', day: makeDay(), cfg }, ['b2']);
  assert.match(msg, /▍二館\n/);
  assert.ok(!msg.includes('▍一館'));
  assert.ok(!msg.includes('▍一館+二館'));
});

test('未選菜的館別顯示尚未選菜', () => {
  const day = makeDay();
  const msg = buildLineMessage({ date: '2026-10-09', day, cfg }, ['b2']);
  day.dishes.b2 = targets();
  const msg2 = buildLineMessage({ date: '2026-10-09', day, cfg }, ['b2']);
  assert.match(msg2, /（尚未選菜）/);
  assert.ok(msg.length > 0);
});
