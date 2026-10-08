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

export function weekStartOf(key) {
  const { y, m, d } = parseKey(key);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(key, -weekday);
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

export const DEFAULT_PREP = {
  riceAdult: 0.2, riceChild: 0.1,
  porridgeAdult: 0.2, porridgeChild: 0.1,
  eggRatio: 1.5, eggStock: 0, eggReserveCount: 0, eggReservePct: 0,
};

export const DEFAULT_SLOTS = [
  { id: 's0800', label: '08:00', enabled: true, milk: 1, foil: 12 },
  { id: 's0830', label: '08:30', enabled: true, milk: 1, foil: 12 },
  { id: 's0900', label: '09:00', enabled: true, milk: 1, foil: 12 },
  { id: 's0930', label: '09:30', enabled: true, milk: 1, foil: 12 },
  { id: 's1000', label: '10:00', enabled: true, milk: 1, foil: 12 },
];

export const DEFAULT_PANTRY = [
  '小白菜', '地瓜葉', '空心菜', '高麗菜', 'A菜',
  '絲瓜', '苦瓜', '番茄', '馬鈴薯', '洋蔥',
  '雞胸肉', '雞腿排', '豬五花', '豬絞肉', '牛肉片',
  '虱目魚', '鮭魚', '蝦仁', '豆芽', '高麗菜苗',
].map((name, i) => ({ id: `p${String(i + 1).padStart(2, '0')}`, name, inFridge: false }));

const round1 = n => Math.round(n * 10) / 10;
const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const usable = v => v !== null && v !== undefined && v !== ''
  && !(typeof v === 'number' && !Number.isFinite(v));

const prepCfg = cfg => {
  const src = (cfg && typeof cfg === 'object') ? cfg : {};
  const given = {};
  for (const k of Object.keys(src)) {
    if (usable(src[k])) given[k] = src[k];
  }
  return { ...DEFAULT_PREP, ...given };
};

export function prepBase(target, cfg, day) {
  const c = prepCfg(cfg);
  const d = day || {};
  const head = peopleFor(target, d.b1, d.b2);
  const rice = round1(head.adult * c.riceAdult + head.kid * c.riceChild);
  const porridge = round1(head.adult * c.porridgeAdult + head.kid * c.porridgeChild);
  const rawEgg = head.total * c.eggRatio;
  const egg = Math.max(0, Math.round(
    rawEgg - c.eggStock + c.eggReserveCount + (rawEgg * c.eggReservePct) / 100,
  ));
  return { head, rice, porridge, egg };
}

export function prepLine(base, extra) {
  const b = num(base, 0);
  const e = Math.max(0, num(extra, 0));
  return { base: b, extra: e, total: round1(b + e) };
}

export function drinkTotals(slots, cfg, state) {
  const c = cfg || {};
  const milkPerSlot = num(c.milkPerSlot, 1);
  const foilPerSlot = num(c.foilPerSlot, 12);
  const drinks = (state && state.drinks) || {};
  const rows = (Array.isArray(slots) ? slots : [])
    .filter(s => s && s.enabled !== false && String(s.label || '').trim())
    .map(s => {
      const o = drinks[s.id] || {};
      return {
        id: s.id,
        label: String(s.label).trim(),
        milk: num(o.milk, num(s.milk, milkPerSlot)),
        foil: num(o.foil, num(s.foil, foilPerSlot)),
        done: !!o.done,
      };
    });
  const sum = key => rows.reduce((a, r) => a + r[key], 0);
  const sumPending = key => rows.filter(r => !r.done).reduce((a, r) => a + r[key], 0);
  return {
    rows,
    milk: sum('milk'),
    foil: sum('foil'),
    pendingMilk: sumPending('milk'),
    pendingFoil: sumPending('foil'),
  };
}

export function pantrySplit(items) {
  const has = [];
  const buy = [];
  for (const it of (Array.isArray(items) ? items : [])) {
    (it && it.inFridge ? has : buy).push(it);
  }
  return { has, buy };
}

export function summaryLine(items) {
  const list = (Array.isArray(items) ? items : [])
    .map(x => String(x == null ? '' : x).trim())
    .filter(Boolean);
  return list.length ? list.join('、') : '（未選）';
}

export function csvEscape(value) {
  if (value == null) return '';
  const raw = String(value);
  const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(rows) {
  const body = (Array.isArray(rows) ? rows : [])
    .map(r => (Array.isArray(r) ? r : []).map(csvEscape).join(','))
    .join('\r\n');
  return `\uFEFF${body}`;
}

export const ROLES = ['admin', 'editor'];

export function normalizeEmail(raw) {
  return String(raw == null ? '' : raw).trim().toLowerCase();
}

export function isValidEmail(value) {
  const v = String(value == null ? '' : value);
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function isValidRole(role) {
  return ROLES.includes(role);
}

export function roleLabel(role) {
  if (role === 'admin') return '主帳號';
  if (role === 'editor') return '員工';
  return '未知';
}

export function memberOf(email, data) {
  const e = normalizeEmail(email);
  const role = data && data.role;
  if (!isValidEmail(e) || !isValidRole(role)) return null;
  return { email: e, role };
}

export const ACCOUNT_DOMAIN = 'fzbf.app';

const SHORT_ACCOUNT_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export function accountToEmail(raw) {
  const v = normalizeEmail(raw);
  if (!v) return null;
  if (v.includes('@')) {
    if (v.includes('/')) return null;
    return isValidEmail(v) ? v : null;
  }
  if (!SHORT_ACCOUNT_RE.test(v)) return null;
  const email = `${v}@${ACCOUNT_DOMAIN}`;
  return isValidEmail(email) ? email : null;
}
