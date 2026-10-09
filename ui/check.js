import { CATEGORIES, COLOR_BY_KEY } from '../menu-lib.js';
import { pantrySplit } from '../core.js';
import { saveDay, loadPantry, savePantry } from '../dslib.js';
import { getDay, TARGET_LABEL } from './day.js';
import { el } from './dom.js';
import { go, ctx, toast } from '../app.js';

const $ = id => document.getElementById(id);

const KIND_TITLE = {
  dish: '選擇菜色',
  extra: '多備菜色（不影響當天出品）',
  pantry: '冰箱庫存菜',
  custom: '自訂備料',
};

let mode = null;
let pantry = null;

function row({ label, checked, color, qty, onToggle, onQty }) {
  const line = el('label', 'check-row');
  const box = el('input');
  box.type = 'checkbox';
  box.checked = !!checked;
  box.addEventListener('change', () => onToggle(box.checked));
  line.appendChild(box);
  if (color) {
    const tag = el('span', 'dish-cat', label);
    tag.style.background = color;
    line.appendChild(tag);
  } else {
    line.appendChild(el('span', 'name', label));
  }
  if (qty) {
    const input = el('input', 'qty');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = '0';
    input.value = String(qty);
    input.addEventListener('change', () => onQty(Number(input.value) || 0));
    line.appendChild(input);
  }
  return line;
}

async function renderDish() {
  const { day, cfg } = getDay();
  const cat = CATEGORIES.find(c => c.key === mode.catKey);
  const color = COLOR_BY_KEY[mode.catKey];
  const chosen = new Set(day.dishes[ctx.target][mode.catKey] || []);
  const extraChosen = new Set(day.extra[ctx.target] || []);
  const isAll = ctx.target === 'all';
  const master = (day.dishes.all && day.dishes.all[mode.catKey]) || [];
  const libList = (cfg.dishLib[mode.catKey] || []).slice();
  const list = isAll ? libList.slice() : [...new Set([...master, ...chosen])];
  list.sort((a, b) => Number(chosen.has(b)) - Number(chosen.has(a)) || a.localeCompare(b, 'zh-Hant'));
  const extraList = libList.slice();
  extraList.sort((a, b) => Number(extraChosen.has(b)) - Number(extraChosen.has(a)) || a.localeCompare(b, 'zh-Hant'));

  const box = el('div', 'check-body');

  const title = el('p', 'suggest');
  title.id = 'checkCount';
  title.textContent = `${TARGET_LABEL[ctx.target]}｜已選 ${chosen.size} 道`;
  box.appendChild(title);

  const main = el('section', 'check-group');
  main.appendChild(el('h2', 'check-group-title', isAll ? `當天出品｜${cat.label}` : `當天出品｜${cat.label}（由 1+2 館刪減）`));
  if (!list.length) {
    main.appendChild(el('p', 'suggest', '「一館+二館」這一類還沒選菜，請先到那裡決定菜色。'));
  }
  for (const name of list) {
    main.appendChild(row({
      label: name,
      color,
      checked: chosen.has(name),
      onToggle: async checked => {
        const cur = new Set(day.dishes[ctx.target][mode.catKey] || []);
        if (checked) cur.add(name); else cur.delete(name);
        day.dishes[ctx.target][mode.catKey] = [...cur];
        await saveDay(day.date, { dishes: { [ctx.target]: day.dishes[ctx.target] } });
        title.textContent = `${TARGET_LABEL[ctx.target]}｜已選 ${cur.size} 道`;
      },
    }));
  }
  box.appendChild(main);

  const extra = el('section', 'check-group');
  extra.appendChild(el('h2', 'check-group-title', '多備（加菜）｜與當天出品互不衝突'));
  for (const name of extraList) {
    extra.appendChild(row({
      label: name,
      color: '#8a8a8a',
      checked: extraChosen.has(name),
      onToggle: async checked => {
        const cur = new Set(day.extra[ctx.target] || []);
        if (checked) cur.add(name); else cur.delete(name);
        day.extra[ctx.target] = [...cur];
        await saveDay(day.date, { extra: { [ctx.target]: day.extra[ctx.target] } });
      },
    }));
  }
  box.appendChild(extra);

  const tools = el('div', 'check-row');
  const all = el('button', 'btn btn-sm', '全選');
  all.type = 'button';
  all.addEventListener('click', async () => {
    day.dishes[ctx.target][mode.catKey] = list.slice();
    await saveDay(day.date, { dishes: { [ctx.target]: day.dishes[ctx.target] } });
    go('check', { kind: 'dish', catKey: mode.catKey });
  });
  const none = el('button', 'btn btn-sm', '清除');
  none.type = 'button';
  none.addEventListener('click', async () => {
    day.dishes[ctx.target][mode.catKey] = [];
    day.extra[ctx.target] = day.extra[ctx.target].filter(n => !list.includes(n));
    await saveDay(day.date, {
      dishes: { [ctx.target]: day.dishes[ctx.target] },
      extra: { [ctx.target]: day.extra[ctx.target] },
    });
    go('check', { kind: 'dish', catKey: mode.catKey });
  });
  tools.appendChild(all);
  tools.appendChild(none);
  box.appendChild(tools);

  return box;
}

async function renderExtra() {
  const { day, cfg } = getDay();
  const all = [...new Set(CATEGORIES.flatMap(c => cfg.dishLib[c.key] || []))];
  const chosen = new Set(day.extra[ctx.target] || []);

  const box = el('div', 'check-body');
  const group = el('section', 'check-group');
  group.appendChild(el('h2', 'check-group-title', `多備菜色（已選 ${chosen.size}）｜與當天出品互不衝突`));
  for (const cat of CATEGORIES) {
    const names = (cfg.dishLib[cat.key] || []).filter(n => chosen.has(n));
    if (!names.length) continue;
    const sub = el('div', 'check-group');
    sub.appendChild(el('h3', 'check-group-title', cat.label));
    for (const name of names) {
      sub.appendChild(row({
        label: name,
        color: cat.color,
        checked: true,
        onToggle: async checked => {
          const cur = new Set(day.extra[ctx.target] || []);
          if (checked) cur.add(name); else cur.delete(name);
          day.extra[ctx.target] = [...cur];
          await saveDay(day.date, { extra: { [ctx.target]: day.extra[ctx.target] } });
          if (!checked) go('check', { kind: 'extra' });
        },
      }));
    }
    group.appendChild(sub);
  }

  const add = el('div', 'check-group');
  add.appendChild(el('h3', 'check-group-title', '加入多備'));
  for (const cat of CATEGORIES) {
    const sel = el('select', 'set-row');
    sel.dataset.cat = cat.key;
    const opt0 = el('option', null, `＋${cat.label}`);
    opt0.value = '';
    sel.appendChild(opt0);
    for (const n of cfg.dishLib[cat.key] || []) {
      if (chosen.has(n)) continue;
      const o = el('option', null, n);
      o.value = n;
      sel.appendChild(o);
    }
    sel.addEventListener('change', async () => {
      if (!sel.value) return;
      const cur = new Set(day.extra[ctx.target] || []);
      cur.add(sel.value);
      day.extra[ctx.target] = [...cur];
      await saveDay(day.date, { extra: { [ctx.target]: day.extra[ctx.target] } });
      toast(`已加入多備：${sel.value}`);
      go('check', { kind: 'extra' });
    });
    add.appendChild(sel);
  }
  group.appendChild(add);
  box.appendChild(group);
  return box;
}

async function renderPantry() {
  if (!pantry) pantry = await loadPantry();
  const box = el('div', 'check-body');
  const group = el('section', 'check-group');
  const stats = el('p', 'suggest');
  const refreshStats = () => {
    const s = pantrySplit(pantry);
    stats.textContent = `✅ 冰箱有 ${s.has.length} 項　🛒 要買 ${s.buy.length} 項`;
  };
  refreshStats();
  group.appendChild(stats);

  for (const item of pantry) {
    group.appendChild(row({
      label: item.name,
      checked: item.inFridge,
      onToggle: async checked => {
        item.inFridge = checked;
        await savePantry(pantry);
        refreshStats();
      },
    }));
  }

  const add = el('div', 'check-row');
  const input = el('input', 'name');
  input.type = 'text';
  input.placeholder = '新增品項名稱';
  const btn = el('button', 'btn btn-sm', '新增');
  btn.type = 'button';
  btn.addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name) return toast('請輸入品項名稱');
    pantry.push({ id: 'p' + Date.now(), name, inFridge: false });
    await savePantry(pantry);
    go('check', { kind: 'pantry' });
  });
  add.appendChild(input);
  add.appendChild(btn);
  group.appendChild(add);
  box.appendChild(group);
  return box;
}

export async function openCheck(params) {
  mode = params;
  const title = KIND_TITLE[params.kind] + (params.catKey
    ? '｜' + (CATEGORIES.find(c => c.key === params.catKey) || {}).label
    : '');
  $('checkTitle').textContent = title;
  const holder = $('checkBody');
  holder.textContent = '';
  const render = params.kind === 'dish' ? renderDish
    : params.kind === 'extra' ? renderExtra
    : params.kind === 'pantry' ? renderPantry
    : null;
  if (render) holder.appendChild(await render());
}

export function mountCheck() {
  $('checkDone').addEventListener('click', () => go(ctx.backView));
  document.addEventListener('fz:view', async e => {
    if (e.detail.view !== 'check') return;
    ctx.backView = 'day';
    await openCheck(e.detail.params || { kind: 'dish', catKey: 'meat' });
  });
}
