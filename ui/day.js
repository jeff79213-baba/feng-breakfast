import { stripCells } from '../cal.js';
import {
  todayKey, suggestDishes, suggestFruitDessert, peopleSum, peopleFor, summaryLine,
} from '../core.js';
import { CATEGORIES } from '../menu-lib.js';
import { loadDay, saveDay, loadConfig, Debouncer } from '../dslib.js';
import { go, ctx } from '../app.js';
import { el } from './dom.js';

const $ = id => document.getElementById(id);

const HEAD_FIELDS = [
  { key: 'rooms', label: '房間數' },
  { key: 'adult', label: '大人' },
  { key: 'child', label: '小孩' },
  { key: 'infant', label: '嬰幼兒' },
];

export const TARGET_LABEL = { b1: '一館', b2: '二館', all: '一館+二館' };

export const state = { date: null, day: null, cfg: null };

export function getDay() { return state; }

const headSaver = new Debouncer(async payload => {
  await saveDay(payload.date, { head: payload.head });
}, 800);

function renderStrip() {
  const strip = $('dayStrip');
  strip.textContent = '';
  const today = todayKey();
  for (const cell of stripCells(state.date, { active: state.date, today })) {
    const chip = el('button', 'day-chip' + (cell.isActive ? ' is-active' : ''));
    chip.type = 'button';
    chip.dataset.date = cell.key;
    chip.appendChild(el('small', null, cell.wd));
    chip.appendChild(document.createTextNode(cell.md));
    strip.appendChild(chip);
  }
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
      const input = el('input');
      input.type = 'number';
      input.inputMode = 'numeric';
      input.min = '0';
      input.value = String(state.day.head[side][f.key] || 0);
      input.dataset.side = side;
      input.dataset.field = f.key;
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
  body.appendChild(sugCard);

  body.appendChild(renderDishCard());
  body.appendChild(renderExtraCard());

  refreshHead();
  refreshSuggest();

  document.dispatchEvent(new CustomEvent('fz:day-rendered', { detail: { date } }));
}

export function mountDay() {
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
