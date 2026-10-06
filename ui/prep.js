import { prepBase, prepLine } from '../core.js';
import { saveDay } from '../dslib.js';
import { state } from './day.js';
import { el } from './dom.js';
import { go, ctx, toast } from '../app.js';

const $ = id => document.getElementById(id);

const ROWS = [
  { key: 'rice', label: '飯', color: '#1971c2' },
  { key: 'porridge', label: '粥', color: '#1971c2' },
  { key: 'egg', label: '茶葉蛋', color: '#1971c2' },
];

function prepOf() {
  return state.day.prep;
}

function headOf() {
  return state.day.head;
}

function targetName() {
  return ctx.target === 'b1' ? '一館' : ctx.target === 'b2' ? '二館' : '合計';
}

async function persist() {
  await saveDay(state.day.date, { prep: prepOf() });
}

function renderRow(item) {
  const row = el('div', 'prep-row');
  const tag = el('span', 'dish-cat', item.label);
  tag.style.background = item.color;
  row.appendChild(tag);

  const base = prepBase(ctx.target, state.cfg.prep, headOf())[item.key];

  const done = el('input');
  done.type = 'checkbox';
  done.checked = !!state.day.prep.done[item.key];
  done.setAttribute('aria-label', item.label + '已完成');
  done.addEventListener('change', async () => {
    state.day.prep.done[item.key] = done.checked;
    await persist();
  });
  row.appendChild(done);

  const eq = el('span', 'prep-eq');
  const extra = el('input');
  extra.type = 'number';
  extra.inputMode = 'numeric';
  extra.min = '0';
  extra.step = '0.5';
  extra.value = String(state.day.prep[item.key].extra || 0);
  extra.setAttribute('aria-label', item.label + '額外增加');
  extra.addEventListener('change', async () => {
    state.day.prep[item.key].extra = Math.max(0, Number(extra.value) || 0);
    await persist();
    refreshPrepTotals();
  });
  eq.appendChild(document.createTextNode(`${base} ＋`));
  eq.appendChild(extra);
  eq.appendChild(document.createTextNode('＝'));
  const total = el('b', null, String(prepLine(base, state.day.prep[item.key].extra).total));
  total.dataset.totalFor = item.key;
  eq.appendChild(total);
  row.appendChild(eq);
  return row;
}

function refreshPrepTotals() {
  const base = prepBase(ctx.target, state.cfg.prep, headOf());
  for (const item of ROWS) {
    const node = document.querySelector(`[data-total-for="${item.key}"]`);
    if (node) node.textContent = String(prepLine(base[item.key], prepOf()[item.key].extra).total);
  }
}

function renderCustomRow(item) {
  const row = el('div', 'prep-row');
  const tag = el('span', 'dish-cat', '自訂');
  tag.style.background = '#5a6b7a';
  row.appendChild(tag);

  const done = el('input');
  done.type = 'checkbox';
  done.checked = !!item.done;
  done.setAttribute('aria-label', item.name + '已完成');
  done.addEventListener('change', async () => {
    item.done = done.checked;
    await persist();
  });
  row.appendChild(done);

  const name = el('input', 'name');
  name.type = 'text';
  name.value = item.name;
  name.setAttribute('aria-label', '自訂備料名稱');
  name.addEventListener('change', async () => {
    item.name = name.value.trim() || item.name;
    await persist();
  });
  row.appendChild(name);

  const qty = el('input', 'qty');
  qty.type = 'number';
  qty.inputMode = 'numeric';
  qty.min = '0';
  qty.value = String(item.qty || 0);
  qty.setAttribute('aria-label', item.name + '數量');
  qty.addEventListener('change', async () => {
    item.qty = Math.max(0, Number(qty.value) || 0);
    await persist();
  });
  row.appendChild(qty);

  const del = el('button', 'btn btn-sm btn-danger', '刪');
  del.type = 'button';
  del.addEventListener('click', async () => {
    prepOf().custom = prepOf().custom.filter(x => x.id !== item.id);
    await persist();
    go('day', { date: state.date });
  });
  row.appendChild(del);
  return row;
}

export function renderPrepCard() {
  const card = el('section', 'card');
  card.id = 'prepCard';
  const h = el('h2', 'card-title', `備料區（依${targetName()}計算）`);
  h.id = 'prepTitle';
  card.appendChild(h);
  for (const item of ROWS) card.appendChild(renderRow(item));

  for (const item of prepOf().custom) card.appendChild(renderCustomRow(item));

  const add = el('div', 'prep-row');
  const name = el('input', 'name');
  name.type = 'text';
  name.placeholder = '自訂備料名稱';
  name.setAttribute('aria-label', '新自訂備料名稱');
  const qty = el('input', 'qty');
  qty.type = 'number';
  qty.inputMode = 'numeric';
  qty.min = '0';
  qty.value = '0';
  qty.setAttribute('aria-label', '新自訂備料數量');
  const btn = el('button', 'btn btn-sm', '＋新增備料');
  btn.type = 'button';
  btn.addEventListener('click', async () => {
    const n = name.value.trim();
    if (!n) return toast('請輸入備料名稱');
    prepOf().custom.push({
      id: 'c' + Date.now(), name: n, qty: Math.max(0, Number(qty.value) || 0), done: false,
    });
    await persist();
    go('day', { date: state.date });
  });
  add.appendChild(name);
  add.appendChild(qty);
  add.appendChild(btn);
  card.appendChild(add);
  return card;
}

export function mountPrep() {
  document.addEventListener('fz:day-rendered', () => {
    const body = $('dayBody');
    if (!body || $('prepCard')) return;
    const anchor = $('suggestLine');
    const card = renderPrepCard();
    if (anchor && anchor.parentNode) {
      anchor.parentNode.after(card);
    } else {
      body.appendChild(card);
    }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#targetRow [data-target]')) return;
    refreshPrepTotals();
    const title = $('prepTitle');
    if (title) title.textContent = `備料區（依${targetName()}計算）`;
  });
}
