import { test } from 'vitest';
import assert from 'node:assert/strict';
import { calCells, stripCells, dataDots } from '../cal.js';

test('calCells 回傳本月區間並標出今天', () => {
  const out = calCells(2026, 10, { today: '2026-10-04', active: null, hasData: new Set() });
  assert.equal(out.label, '2026 年 10 月');
  assert.ok(out.weeks.length >= 5);
  const flat = out.weeks.flat();
  assert.ok(flat.includes('2026-10-04'));
  assert.ok(flat.includes('2026-10-01'));
  assert.ok(!flat.includes('2026-11-01'));
});

test('calCells 標示本月與選中日', () => {
  const out = calCells(2026, 10, { today: '2026-10-04', active: '2026-10-08', hasData: new Set(['2026-10-08']) });
  assert.equal(out.flags['2026-10-08'].isActive, true);
  assert.equal(out.flags['2026-10-08'].isToday, false);
  assert.equal(out.flags['2026-10-08'].hasData, true);
  assert.equal(out.flags['2026-10-04'].isToday, true);
  assert.equal(out.flags['2026-10-04'].isActive, false);
  assert.equal(out.flags['2026-10-01'].inMonth, true);
  assert.equal(out.flags['2026-10-01'].hasData, false);
  assert.equal(out.flags['2026-09-27'].inMonth, false);
});

test('stripCells 固定顯示當週週日至週六', () => {
  const out = stripCells('2026-10-06', { active: '2026-10-06', today: '2026-10-04' });
  assert.equal(out.length, 7);
  assert.equal(out[0].key, '2026-10-04');
  assert.equal(out[6].key, '2026-10-10');
  assert.equal(out[2].key, '2026-10-06');
  assert.equal(out[2].isActive, true);
  assert.equal(out[0].isActive, false);
  assert.equal(out[0].isToday, true);
  assert.deepEqual(out.map(x => x.wd), ['日', '一', '二', '三', '四', '五', '六']);
});

test('stripCells 同一週內點選不會換週', () => {
  const a = stripCells('2026-10-06', { active: '2026-10-06' }).map(x => x.key);
  const b = stripCells('2026-10-09', { active: '2026-10-09' }).map(x => x.key);
  assert.deepEqual(a, b);
});

test('dataDots 只回 weeks 中有資料的日期', () => {
  const weeks = [['2026-10-01', '2026-10-02'], ['2026-10-03', '2026-10-04']];
  assert.deepEqual(dataDots(weeks, new Set(['2026-10-02', '2026-10-04', '2026-12-25'])), ['2026-10-02', '2026-10-04']);
  assert.deepEqual(dataDots(weeks, new Set()), []);
});
