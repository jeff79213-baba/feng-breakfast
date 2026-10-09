import { peopleFor, prepBase, prepLine, parseKey } from './core.js';
import { CATEGORIES } from './menu-lib.js';

const WD = ['日', '一', '二', '三', '四', '五', '六'];

export const LINE_TARGETS = [
  { key: 'b1', label: '一館' },
  { key: 'b2', label: '二館' },
  { key: 'all', label: '一館+二館（合計）' },
];

export function buildLineMessage({ date, day, cfg }, targets) {
  const want = Array.isArray(targets) && targets.length
    ? targets
    : LINE_TARGETS.map(t => t.key);
  const prep = (cfg && cfg.prep) || {};
  const { y, m, d } = parseKey(date);
  const weekday = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const out = [`【風自然早餐】${m}/${d}（${weekday}）`];

  for (const t of LINE_TARGETS) {
    if (!want.includes(t.key)) continue;
    out.push('');
    out.push(`▍${t.label}`);

    const head = peopleFor(t.key, day.head.b1, day.head.b2);
    out.push(
      `👥 房間 ${head.rooms}・大人 ${head.adult}、小孩 ${head.child}、`
      + `嬰幼兒 ${head.infant}（共 ${head.total} 人）`,
    );

    const dishes = (day.dishes && day.dishes[t.key]) || {};
    let any = false;
    for (const cat of CATEGORIES) {
      const chosen = Array.isArray(dishes[cat.key]) ? dishes[cat.key] : [];
      if (!chosen.length) continue;
      any = true;
      out.push(`${cat.label}：${chosen.join('、')}`);
    }
    const extra = (day.extra && day.extra[t.key]) || [];
    if (extra.length) {
      any = true;
      out.push(`多備菜色：${extra.join('、')}`);
    }
    if (!any) out.push('（尚未選菜）');

    const base = prepBase(t.key, prep, day.head);
    const rice = prepLine(base.rice, day.prep.rice.extra).total;
    const porridge = prepLine(base.porridge, day.prep.porridge.extra).total;
    const egg = prepLine(base.egg, day.prep.egg.extra).total;
    out.push(`🍚 飯 ${rice} 米杯・粥 ${porridge} 米杯・茶葉蛋 ${egg} 顆`);
  }

  return out.join('\n');
}
