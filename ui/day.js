import { stripCells } from '../cal.js';
import {
  todayKey, weekOf, weekStartOf, addDays, suggestDishes, suggestFruitDessert, peopleSum, peopleFor, summaryLine,
} from '../core.js';
import { CATEGORIES } from '../menu-lib.js';
import { loadDay, saveDay, loadConfig, Debouncer } from '../dslib.js';
import { go, ctx, toast } from '../app.js';
import { el, copyText } from './dom.js';
import { buildLineMessage, LINE_TARGETS } from '../line.js';

const $ = id => document.getElementById(id);

const HEAD_FIELDS = [
  { key: 'rooms', label: '房間數' },
  { key: 'adult', label: '大人' },
  { key: 'child', label: '小孩' },
  { key: 'infant', label: '嬰幼兒' },
];

export const TARGET_LABEL = { b1: '一館', b2: '二館', all: '一館+二館' };

export const state = { date: null, day: null, cfg: null, stripStart: null };

export function getDay() { return state; }

const copyScope = { b1: true, b2: true, all: true };

const headSaver = new Debouncer(async payload => {
  await saveDay(payload.date, { head: payload.head });
}, 800);

function renderStrip() {
  const strip = $('dayStrip');
  const left = strip.scrollLeft;
  strip.textContent = '';
  const today = todayKey();
  for (const cell of stripCells(state.stripStart, { active: state.date, today })) {
    const chip = el('button', 'day-chip' + (cell.isActive ? ' is-active' : ''));
    chip.type = 'button';
    chip.dataset.date = cell.key;
    chip.appendChild(el('small', null, cell.wd));
    chip.appendChild(document.createTextNode(cell.md));
    strip.appendChild(chip);
  }
  strip.scrollLeft = left;
}

function renderHead() {
  const card = el('section', 'card');
  card.appendChild(el('h2', 'card-title', '入住資料'));

  const grid = el('div', 'head-grid');
  for (const side of ['b1', 'b2']) {
    const box = el('div');
    box.appendChild(el('span', null, TARGET_LABEL[side]));
    for (const f of HEAD_FIELDS) {
      const label = el('label');
      label.appendChild(el('span', null, f.label));
      const init = state.day.head[side][f.key] || 0;
      const input = el('input');
      input.type = 'number';
      input.inputMode = 'numeric';
      input.min = '0';
      input.placeholder = '0';
      input.value = init ? String(init) : '';
      input.dataset.side = side;
      input.dataset.field = f.key;
      input.addEventListener('focus', () => {
        if (input.value) input.select();
      });
      input.addEventListener('blur', () => {
        const n = Math.max(0, Math.floor(Number(input.value) || 0));
        input.value = n ? String(n) : '';
      });
      label.appendChild(input);
      box.appendChild(label);
    }
    grid.appendChild(box);
  }

  const totalBox = el('div');
  totalBox.appendChild(el('span', null, '合計'));
  for (const f of HEAD_FIELDS) {
    const label = el('label');
    label.appendChild(el('span', null, f.label));
    const input = el('input');
    input.type = 'text';
    input.readOnly = true;
    input.tabIndex = -1;
    input.dataset.total = f.key;
    label.appendChild(input);
    totalBox.appendChild(label);
  }
  grid.appendChild(totalBox);

  card.appendChild(grid);
  const totalLine = el('div', 'head-total');
  totalLine.id = 'headTotalLine';
  card.appendChild(totalLine);
  return card;
}

function refreshHead() {
  const sum = peopleSum(state.day.head.b1, state.day.head.b2);
  for (const f of HEAD_FIELDS) {
    const input = document.querySelector(`[data-total="${f.key}"]`);
    if (input) input.value = String(sum[f.key] || 0);
  }
  const line = $('headTotalLine');
  if (line) line.textContent = `合計房間 ${sum.rooms}｜總人數 ${sum.total}（小孩含嬰幼兒 ${sum.kid} 人）`;
}

function renderTargetBar() {
  const row = el('div', 'target-row');
  row.id = 'targetRow';
  for (const t of ['b1', 'b2', 'all']) {
    const btn = el('button', 'target-btn' + (ctx.target === t ? ' is-active' : ''), TARGET_LABEL[t]);
    btn.type = 'button';
    btn.dataset.target = t;
    row.appendChild(btn);
  }
  return row;
}

function refreshSuggest() {
  const meta = $('suggestMeta');
  const sug = $('suggestLine');
  if (!sug) return;
  const rooms = peopleFor(ctx.target, state.day.head.b1, state.day.head.b2).rooms;
  const d = suggestDishes(rooms);
  const fd = suggestFruitDessert(rooms);
  if (meta) meta.textContent = `${TARGET_LABEL[ctx.target]} ${rooms} 間 → 建議`;
  sug.textContent =
    `菜色 肉${d.meat} 菜${d.veg} 蛋${d.egg} 小菜${d.side} 炸物${d.fry} 滷菜${d.braise}`
    + `｜水果${fd.fruit} 甜點${fd.dessert}（僅供參考）`;

  for (const cat of CATEGORIES) {
    const node = $('dayBody').querySelector(`[data-open-dish="${cat.key}"] .dish-count`);
    if (node) {
      const n = (state.day.dishes[ctx.target][cat.key] || []).length;
      node.textContent = n ? `${n} 項　編輯 ›` : '選擇 ›';
    }
  }
}

function dishCardFor(cat) {
  const card = el('section', 'card');
  const title = el('h2', 'card-title', `${cat.label}（${(state.day.dishes[ctx.target][cat.key] || []).length}）`);
  title.dataset.openDish = cat.key;
  card.appendChild(title);

  const chosen = state.day.dishes[ctx.target][cat.key] || [];
  const line = el('div', 'dish-line');
  line.dataset.openDish = cat.key;
  line.appendChild(el('span', 'dish-cat', cat.label)).style.background = cat.color;
  line.appendChild(el('span', 'dish-text', summaryLine(chosen)));
  line.appendChild(el('span', 'dish-count', chosen.length ? '編輯 ›' : '選擇 ›'));
  card.appendChild(line);
  return card;
}

function renderDishCard() {
  const wrap = el('div');
  for (const cat of CATEGORIES) wrap.appendChild(dishCardFor(cat));
  return wrap;
}

function renderExtraCard() {
  const card = el('section', 'card');
  const chosen = state.day.extra[ctx.target] || [];
  card.appendChild(el('h2', 'card-title', `多備菜色（${chosen.length}）`));
  const line = el('div', 'dish-line');
  line.dataset.openExtra = '1';
  line.appendChild(el('span', 'dish-cat', '多備'));
  line.appendChild(el('span', 'dish-text', summaryLine(chosen)));
  line.appendChild(el('span', 'dish-count', '編輯 ›'));
  card.appendChild(line);
  return card;
}

export async function renderDay(date) {
  state.date = date;
  if (!state.stripStart || !weekOf(state.stripStart).includes(date)) {
    state.stripStart = weekStartOf(date);
  }
  state.cfg = await loadConfig();
  state.day = await loadDay(date);
  ctx.anchor = date;
  ctx.backView = 'day';

  $('dayTitle').textContent = date;
  renderStrip();

  const body = $('dayBody');
  body.textContent = '';
  body.appendChild(renderHead());
  body.appendChild(renderTargetBar());

  const sugCard = el('section', 'card');
  const meta = el('p', 'suggest-meta');
  meta.id = 'suggestMeta';
  const sug = el('p', 'suggest');
  sug.id = 'suggestLine';
  sugCard.append(meta, sug);
  const actions = el('div', 'btn-row');
  const applyBtn = el('button', 'btn btn-sm btn-primary', '套用建議');
  applyBtn.type = 'button';
  applyBtn.addEventListener('click', applySuggestion);
  const copyBtn = el('button', 'btn btn-sm btn-ghost', '複製到 LINE');
  copyBtn.type = 'button';
  copyBtn.addEventListener('click', copyLine);
  actions.append(applyBtn, copyBtn);
  sugCard.appendChild(actions);

  const scope = el('div', 'copy-scope');
  scope.appendChild(el('span', 'copy-scope-label', '複製範圍'));
  for (const t of LINE_TARGETS) {
    const item = el('label', 'copy-scope-item');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = copyScope[t.key];
    cb.addEventListener('change', () => { copyScope[t.key] = cb.checked; });
    item.appendChild(cb);
    item.appendChild(document.createTextNode(t.label));
    scope.appendChild(item);
  }
  sugCard.appendChild(scope);

  body.appendChild(sugCard);

  body.appendChild(renderDishCard());
  body.appendChild(renderExtraCard());

  refreshHead();
  refreshSuggest();

  document.dispatchEvent(new CustomEvent('fz:day-rendered', { detail: { date } }));
}

async function copyLine() {
  const targets = LINE_TARGETS.map(t => t.key).filter(k => copyScope[k]);
  if (!targets.length) {
    toast('請至少勾選一個館別');
    return;
  }
  const text = buildLineMessage({ date: state.date, day: state.day, cfg: state.cfg }, targets);
  const ok = await copyText(text);
  toast(ok ? '已複製，可貼到 LINE' : '複製失敗，請長按選取');
}

async function applySuggestion() {
  const rooms = peopleFor(ctx.target, state.day.head.b1, state.day.head.b2).rooms;
  const counts = { ...suggestDishes(rooms), ...suggestFruitDessert(rooms) };
  const lib = (state.cfg && state.cfg.dishLib) || {};
  const cur = state.day.dishes[ctx.target];
  let filled = 0;
  for (const cat of CATEGORIES) {
    if ((cur[cat.key] || []).length) continue;
    const names = (lib[cat.key] || []).slice(0, Math.max(0, counts[cat.key] || 0));
    if (!names.length) continue;
    cur[cat.key] = names;
    filled++;
  }
  if (!filled) {
    toast(rooms ? '每類都有菜了，無需套用' : '先輸入人數才有建議可套用');
    return;
  }
  await saveDay(state.date, { dishes: { [ctx.target]: cur } });
  toast(`已按建議帶入 ${filled} 類`);
  go('day', { date: state.date });
}

export function mountDay() {
  $('stripPrev').addEventListener('click', () => {
    state.stripStart = addDays(state.stripStart || weekStartOf(state.date || todayKey()), -7);
    renderStrip();
  });
  $('stripNext').addEventListener('click', () => {
    state.stripStart = addDays(state.stripStart || weekStartOf(state.date || todayKey()), 7);
    renderStrip();
  });
  $('dayStrip').addEventListener('click', e => {
    const chip = e.target.closest('.day-chip');
    if (!chip) return;
    renderDay(chip.dataset.date);
  });

  $('dayBody').addEventListener('input', e => {
    const input = e.target.closest('[data-side][data-field]');
    if (!input) return;
    const side = input.dataset.side;
    const field = input.dataset.field;
    state.day.head[side][field] = Math.max(0, Number(input.value) || 0);
    refreshHead();
    refreshSuggest();
    headSaver.call({ date: state.date, head: state.day.head });
  });

  $('dayBody').addEventListener('click', e => {
    const dish = e.target.closest('[data-open-dish]');
    if (dish) return go('check', { kind: 'dish', catKey: dish.dataset.openDish });
    const extra = e.target.closest('[data-open-extra]');
    if (extra) return go('check', { kind: 'extra' });
  });

  $('dayBody').addEventListener('click', e => {
    const btn = e.target.closest('[data-target]');
    if (!btn) return;
    ctx.target = btn.dataset.target;
    for (const b of $('targetRow').children) {
      b.classList.toggle('is-active', b.dataset.target === ctx.target);
    }
    refreshSuggest();
  });

  document.addEventListener('fz:view', async e => {
    if (e.detail.view !== 'day') return;
    const date = (e.detail.params && e.detail.params.date) || ctx.anchor || todayKey();
    await renderDay(date);
  });

  window.addEventListener('pagehide', () => { headSaver.flush(); });
}
