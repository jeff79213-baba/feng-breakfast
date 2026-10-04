/* =========================================================
   core.js — 純函式（日期 / 級距 / 建議 / 人數 / 備料 / 飲料 / 冰箱 / CSV）
   純邏輯層：不得 import 任何模組、不得碰 DOM、不得碰網路。
   ========================================================= */

export const TZ = 'Asia/Taipei';

const KEY_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function keyOf(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function dateKey(d = new Date()) {
  const parts = KEY_FMT.formatToParts(d);
  const get = t => parts.find(p => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function todayKey() {
  return dateKey(new Date());
}

export function parseKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return { y, m, d };
}

export function addDays(key, n) {
  const { y, m, d } = parseKey(key);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return keyOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function weekOf(anchor) {
  return Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
}

export function monthMatrix(year, month) {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const monthStart = keyOf(year, month, 1);
  const gridStart = addDays(monthStart, -firstWeekday);
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(gridStart, w * 7 + i)));
  }
  const prefix = `${year}-${pad2(month)}`;
  while (weeks.length > 4 && weeks[weeks.length - 1].every(k => !k.startsWith(prefix))) {
    weeks.pop();
  }
  return weeks;
}
