import { calCells } from '../cal.js';
import { todayKey, parseKey, monthMatrix } from '../core.js';
import { loadDay } from '../dslib.js';
import { go, ctx } from '../app.js';

const $ = id => document.getElementById(id);

let year = 0;
let month = 0;
let dataDates = new Set();

async function refreshDataDates() {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const keys = monthMatrix(year, month).flat().filter(k => k.startsWith(prefix));
  const days = await Promise.all(keys.map(k => loadDay(k).catch(() => null)));
  const next = new Set();
  days.forEach((doc, i) => {
    const h = (doc && doc.head) || {};
    const any = ['b1', 'b2'].some(b => h[b] && (h[b].rooms || h[b].adult || h[b].child));
    if (any) next.add(keys[i]);
  });
  dataDates = next;
}

export async function renderCalendar() {
  const today = todayKey();
  if (!year) {
    const t = parseKey(today);
    year = t.y;
    month = t.m;
  }
  await refreshDataDates();
  const data = calCells(year, month, { today, active: ctx.anchor, hasData: dataDates });
  $('calLabel').textContent = data.label;

  const grid = $('calGrid');
  grid.textContent = '';
  for (const row of data.weeks) {
    for (const key of row) {
      const f = data.flags[key];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-cell'
        + (f.inMonth ? '' : ' is-out')
        + (f.isToday ? ' is-today' : '')
        + (f.isActive ? ' is-active' : '');
      btn.textContent = String(parseKey(key).d);
      btn.dataset.date = key;
      if (f.hasData) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        btn.appendChild(dot);
      }
      grid.appendChild(btn);
    }
  }
}

export function mountCalendar() {
  const today = todayKey();
  const t = parseKey(today);

  $('calPrev').addEventListener('click', async () => {
    month -= 1;
    if (month < 1) { month = 12; year -= 1; }
    await renderCalendar();
  });
  $('calNext').addEventListener('click', async () => {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
    await renderCalendar();
  });
  $('calToday').addEventListener('click', async () => {
    ctx.anchor = todayKey();
    year = t.y;
    month = t.m;
    await renderCalendar();
  });

  $('calGrid').addEventListener('click', e => {
    const cell = e.target.closest('.cal-cell');
    if (!cell) return;
    ctx.anchor = cell.dataset.date;
    ctx.backView = 'calendar';
    go('day', { date: cell.dataset.date });
  });

  document.addEventListener('fz:view', e => {
    if (e.detail.view === 'calendar') renderCalendar();
  });
}
