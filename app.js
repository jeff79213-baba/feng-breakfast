import { todayKey } from './core.js';

export const ctx = {
  session: null,
  view: 'login',
  params: {},
  anchor: todayKey(),
  target: 'b1',
  backView: 'calendar',
};

const VIEWS = ['login', 'calendar', 'day', 'check', 'settings'];

export function go(view, params = {}) {
  if (!VIEWS.includes(view)) throw new Error('unknown view: ' + view);
  ctx.view = view;
  ctx.params = params;
  for (const v of VIEWS) {
    const el = document.getElementById('view-' + v);
    if (el) el.hidden = v !== view;
  }
  window.scrollTo(0, 0);
  document.dispatchEvent(new CustomEvent('fz:view', { detail: { view, params } }));
}

export function toast(message) {
  let el = document.getElementById('fz-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fz-toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.hidden = true; }, 2200);
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-go]');
  if (!btn) return;
  const dest = btn.dataset.go;
  if (dest === 'back-day') return go(ctx.backView);
  if (dest === 'back-from-settings') return go(ctx.backView);
  if (dest === 'logout') return document.dispatchEvent(new CustomEvent('fz:logout'));
  go(dest);
});

window.FZApp = { ctx, go, toast };

go('login');
