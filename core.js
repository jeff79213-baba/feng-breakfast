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

/* ---------- 級距與建議 ---------- */

export const BRACKETS = [5, 10, 15, 20, 25, 30];

const DISH_TABLE = {
  5:  { meat: 1, veg: 1, egg: 1, side: 3, fry: 1, braise: 0 },
  10: { meat: 1, veg: 2, egg: 1, side: 3, fry: 1, braise: 1 },
  15: { meat: 1, veg: 3, egg: 1, side: 3, fry: 2, braise: 1 },
  20: { meat: 1, veg: 4, egg: 1, side: 3, fry: 3, braise: 1 },
  25: { meat: 1, veg: 4, egg: 1, side: 3, fry: 3, braise: 2 },
  30: { meat: 1, veg: 4, egg: 1, side: 3, fry: 3, braise: 2 },
};

const FRUIT_TABLE = {
  5:  { fruit: 2, dessert: 1 },
  10: { fruit: 2, dessert: 1 },
  15: { fruit: 3, dessert: 1 },
  20: { fruit: 4, dessert: 2 },
  25: { fruit: 5, dessert: 2 },
  30: { fruit: 6, dessert: 3 },
};

export function bracketOf(rooms) {
  const r = Number(rooms) || 0;
  const stepped = Math.round(r / 5) * 5;
  return Math.min(30, Math.max(5, stepped));
}

export function suggestDishes(rooms) {
  return { ...DISH_TABLE[bracketOf(rooms)] };
}

export function suggestFruitDessert(rooms) {
  return { ...FRUIT_TABLE[bracketOf(rooms)] };
}

/* ---------- 人數 ---------- */

export function emptyHead() {
  return { rooms: 0, adult: 0, child: 0, infant: 0, kid: 0, total: 0 };
}

function headOf(src) {
  const s = src || {};
  const rooms = Number(s.rooms) || 0;
  const adult = Number(s.adult) || 0;
  const child = Number(s.child) || 0;
  const infant = Number(s.infant) || 0;
  return { rooms, adult, child, infant, kid: child + infant, total: adult + child + infant };
}

export function peopleSum(b1, b2) {
  const a = headOf(b1);
  const b = headOf(b2);
  return {
    rooms: a.rooms + b.rooms,
    adult: a.adult + b.adult,
    child: a.child + b.child,
    infant: a.infant + b.infant,
    kid: a.kid + b.kid,
    total: a.total + b.total,
  };
}

export function peopleFor(target, b1, b2) {
  const t = String(target || 'all').toLowerCase();
  if (t === 'b1') return headOf(b1);
  if (t === 'b2') return headOf(b2);
  return peopleSum(b1, b2);
}
