import { monthMatrix, weekOf, weekStartOf, parseKey } from './core.js';

const WD = ['日', '一', '二', '三', '四', '五', '六'];

export function calCells(year, month, opts = {}) {
  const today = opts.today || null;
  const active = opts.active || null;
  const hasData = opts.hasData || new Set();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const matrix = monthMatrix(year, month);
  return {
    label: `${year} 年 ${month} 月`,
    today,
    active,
    weeks: matrix.map(row => row.slice()),
    prefix,
    flags: Object.fromEntries(
      matrix.flat().map(k => [k, {
        inMonth: k.startsWith(prefix),
        isToday: k === today,
        isActive: k === active,
        hasData: hasData.has(k),
      }]),
    ),
  };
}

export function stripCells(anchor, opts = {}) {
  const today = opts.today || null;
  const active = opts.active || anchor;
  return weekOf(weekStartOf(anchor)).map(key => {
    const { y, m, d } = parseKey(key);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return {
      key,
      md: `${m}/${d}`,
      wd: WD[weekday],
      isToday: key === today,
      isActive: key === active,
    };
  });
}

export function dataDots(weeks, dataDates) {
  const set = dataDates instanceof Set ? dataDates : new Set(dataDates || []);
  return (Array.isArray(weeks) ? weeks : []).flat().filter(k => set.has(k));
}
