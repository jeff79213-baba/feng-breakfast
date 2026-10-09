import { test } from 'vitest';
import assert from 'node:assert/strict';
import { CATEGORIES, DEFAULT_DISH_LIB, COLOR_BY_KEY } from '../menu-lib.js';

test('CATEGORIES 固定八個分類且順序正確', () => {
  assert.deepEqual(CATEGORIES.map(c => c.key),
    ['meat', 'veg', 'egg', 'side', 'fry', 'braise', 'fruit', 'dessert']);
  assert.deepEqual(CATEGORIES.map(c => c.label),
    ['肉', '菜', '蛋', '小菜', '炸物', '滷菜', '水果', '甜點']);
});

test('每個分類都有顏色且顏色不重複', () => {
  const colors = CATEGORIES.map(c => c.color);
  assert.equal(new Set(colors).size, colors.length);
  for (const c of CATEGORIES) {
    assert.match(c.color, /^#[0-9a-f]{6}$/i);
    assert.equal(COLOR_BY_KEY[c.key], c.color);
  }
});

test('分類標籤文字不含 emoji', () => {
  for (const c of CATEGORIES) {
    assert.doesNotMatch(c.label, /\p{Extended_Pictographic}/u);
  }
});

test('DEFAULT_DISH_LIB 各分類內容與數量固定為 6/11/6/7/7/5/10/8', () => {
  assert.deepEqual(Object.keys(DEFAULT_DISH_LIB),
    ['meat', 'veg', 'egg', 'side', 'fry', 'braise', 'fruit', 'dessert']);
  assert.equal(DEFAULT_DISH_LIB.meat.length, 6);
  assert.equal(DEFAULT_DISH_LIB.veg.length, 11);
  assert.equal(DEFAULT_DISH_LIB.egg.length, 6);
  assert.equal(DEFAULT_DISH_LIB.side.length, 7);
  assert.equal(DEFAULT_DISH_LIB.fry.length, 7);
  assert.equal(DEFAULT_DISH_LIB.braise.length, 5);
  assert.equal(DEFAULT_DISH_LIB.fruit.length, 10);
  assert.equal(DEFAULT_DISH_LIB.dessert.length, 8);
  assert.equal(DEFAULT_DISH_LIB.meat[0], '三杯G');
  assert.equal(DEFAULT_DISH_LIB.meat[5], '蜂蜜胡椒豬柳');
  assert.equal(DEFAULT_DISH_LIB.veg[0], '清炒空心菜');
  assert.equal(DEFAULT_DISH_LIB.veg[10], '豌豆炒肉絲');
  assert.equal(DEFAULT_DISH_LIB.egg[4], '菜脯蛋');
  assert.equal(DEFAULT_DISH_LIB.egg[5], '玉米炒蛋');
  assert.equal(DEFAULT_DISH_LIB.dessert[7], '饅頭');
});

test('DEFAULT_DISH_LIB 無重複或空白項', () => {
  for (const c of CATEGORIES) {
    const list = DEFAULT_DISH_LIB[c.key];
    assert.ok(Array.isArray(list) && list.length > 0, `${c.key} 不可為空`);
    assert.ok(list.every(x => typeof x === 'string' && x.trim()), `${c.key} 不可有空白項`);
    assert.equal(new Set(list).size, list.length, `${c.key} 不可有重複`);
  }
});
