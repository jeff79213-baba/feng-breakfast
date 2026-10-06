import {
  weekOf, parseKey, peopleFor, prepBase, prepLine, drinkTotals,
  buildCsv, addDays, summaryLine,
} from '../core.js';
import { CATEGORIES } from '../menu-lib.js';
import { loadDay, loadConfig } from '../dslib.js';
import { ctx, toast } from '../app.js';

const HEAD = ['日期', '目標'];
for (const k of ['房間數', '大人', '小孩', '嬰幼兒']) HEAD.push(k);
HEAD.push(...CATEGORIES.map(c => c.label), '多備菜色');
HEAD.push(
  '飯基準', '飯額外', '飯合計',
  '粥基準', '粥額外', '粥合計',
  '茶葉蛋基準', '茶葉蛋額外', '茶葉蛋合計',
  '自訂備料', '牛奶合計', '鋁箔包合計',
);

function rowFor(date, target, doc, cfg) {
  const head = peopleFor(target, doc.head.b1, doc.head.b2);
  const base = prepBase(target, cfg.prep, doc.head);
  const rice = prepLine(base.rice, doc.prep.rice.extra);
  const porridge = prepLine(base.porridge, doc.prep.porridge.extra);
  const egg = prepLine(base.egg, doc.prep.egg.extra);
  const drinks = drinkTotals(cfg.slots, {}, doc);

  const row = [date, target, head.rooms, head.adult, head.child, head.infant];
  for (const cat of CATEGORIES) {
    row.push(summaryLine(doc.dishes[target][cat.key] || []));
  }
  row.push(summaryLine(doc.extra[target] || []));
  row.push(rice.base, rice.extra, rice.total);
  row.push(porridge.base, porridge.extra, porridge.total);
  row.push(egg.base, egg.extra, egg.total);
  row.push((doc.prep.custom || [])
    .filter(x => !x.done)
    .map(x => `${x.name}×${x.qty}`)
    .join('、') || '（無）');
  row.push(drinks.milk, drinks.foil);
  return row;
}

export async function exportWeekCsv(anchor) {
  const cfg = await loadConfig();
  const dates = weekOf(anchor);
  const docs = [];
  for (const date of dates) docs.push(await loadDay(date));

  const rows = [HEAD];
  dates.forEach((date, i) => {
    for (const target of ['b1', 'b2', 'all']) {
      rows.push(rowFor(date, target, docs[i], cfg));
    }
  });

  const csv = buildCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const { y, m, d } = parseKey(anchor);
  const last = parseKey(addDays(anchor, 6));
  const name = `風自然早餐_${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`
    + `-${last.y}${String(last.m).padStart(2, '0')}${String(last.d).padStart(2, '0')}.csv`;
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

export function mountExport() {
  document.addEventListener('click', async e => {
    if (!e.target.closest('#exportBtn')) return;
    try {
      toast('匯出中…');
      const name = await exportWeekCsv(ctx.anchor);
      toast('已匯出 ' + name);
    } catch (e) {
      toast('匯出失敗：' + e.message);
    }
  });
}
