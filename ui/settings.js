import { CATEGORIES } from '../menu-lib.js';
import { loadConfig, saveConfig, apiFetch } from '../dslib.js';
import { go, ctx, toast } from '../app.js';
import { el } from './dom.js';
import { changePassword } from './login.js';

const $ = id => document.getElementById(id);

let cfg = null;

function card(title) {
  const c = el('section', 'card');
  if (title) c.appendChild(el('h2', 'card-title', title));
  return c;
}

function numberRow(label, value, step, onSave) {
  const row = el('div', 'set-row');
  row.appendChild(el('span', 'label', label));
  const input = el('input');
  input.type = 'number';
  input.inputMode = 'decimal';
  input.step = step;
  input.value = String(value);
  input.setAttribute('aria-label', label);
  input.addEventListener('change', () => onSave(Number(input.value) || 0));
  row.appendChild(input);
  return row;
}

function prepCard() {
  const c = card('備料係數');
  const p = cfg.prep;
  const save = async patch => {
    Object.assign(cfg.prep, patch);
    await saveConfig({ prep: cfg.prep, updatedBy: ctx.session && ctx.session.account });
    toast('已儲存');
  };
  c.appendChild(numberRow('飯／大人', p.riceAdult, '0.01', v => save({ riceAdult: v })));
  c.appendChild(numberRow('飯／小孩（含嬰幼兒）', p.riceChild, '0.01', v => save({ riceChild: v })));
  c.appendChild(numberRow('粥／大人', p.porridgeAdult, '0.01', v => save({ porridgeAdult: v })));
  c.appendChild(numberRow('粥／小孩（含嬰幼兒）', p.porridgeChild, '0.01', v => save({ porridgeChild: v })));
  c.appendChild(numberRow('蛋／人（倍率）', p.eggRatio, '0.1', v => save({ eggRatio: v })));
  c.appendChild(numberRow('蛋／庫存扣除', p.eggStock, '1', v => save({ eggStock: v })));
  c.appendChild(numberRow('蛋／預留顆數', p.eggReserveCount, '1', v => save({ eggReserveCount: v })));
  c.appendChild(numberRow('蛋／預留百分比', p.eggReservePct, '1', v => save({ eggReservePct: v })));
  return c;
}

function slotCard() {
  const c = card('用餐時段');
  const save = async () => {
    await saveConfig({ slots: cfg.slots, updatedBy: ctx.session && ctx.session.account });
  };

  for (const slot of cfg.slots) {
    const row = el('div', 'set-row');
    const on = el('input');
    on.type = 'checkbox';
    on.checked = slot.enabled !== false;
    on.setAttribute('aria-label', slot.label + ' 啟用');
    on.addEventListener('change', async () => {
      slot.enabled = on.checked;
      await save();
      toast('已儲存');
    });
    row.appendChild(on);

    const label = el('input');
    label.type = 'text';
    label.value = slot.label;
    label.style.width = '80px';
    label.setAttribute('aria-label', '時段名稱');
    label.addEventListener('change', async () => {
      const v = label.value.trim();
      if (!/^\d{2}:\d{2}$/.test(v)) {
        toast('時段格式需為 HH:MM');
        label.value = slot.label;
        return;
      }
      slot.label = v;
      await save();
      toast('已儲存');
    });
    row.appendChild(label);

    const milk = el('input');
    milk.type = 'number';
    milk.value = String(slot.milk ?? 1);
    milk.setAttribute('aria-label', slot.label + ' 預設牛奶');
    milk.addEventListener('change', async () => {
      slot.milk = Math.max(0, Number(milk.value) || 0);
      await save();
      toast('已儲存');
    });
    row.appendChild(milk);

    const foil = el('input');
    foil.type = 'number';
    foil.value = String(slot.foil ?? 12);
    foil.setAttribute('aria-label', slot.label + ' 預設鋁箔包');
    foil.addEventListener('change', async () => {
      slot.foil = Math.max(0, Number(foil.value) || 0);
      await save();
      toast('已儲存');
    });
    row.appendChild(foil);

    const del = el('button', 'btn btn-sm btn-danger', '刪');
    del.type = 'button';
    del.addEventListener('click', async () => {
      cfg.slots = cfg.slots.filter(s => s.id !== slot.id);
      await save();
      go('settings');
    });
    row.appendChild(del);
    c.appendChild(row);
  }

  const add = el('div', 'set-row');
  const label = el('input');
  label.type = 'text';
  label.placeholder = 'HH:MM';
  label.setAttribute('aria-label', '新增時段');
  const btn = el('button', 'btn btn-sm', '＋新增時段');
  btn.type = 'button';
  btn.addEventListener('click', async () => {
    const v = label.value.trim();
    if (!/^\d{2}:\d{2}$/.test(v)) return toast('時段格式需為 HH:MM');
    if (cfg.slots.some(s => s.label === v)) return toast('此時段已存在');
    cfg.slots.push({
      id: 's' + v.replace(':', ''), label: v, enabled: true, milk: 1, foil: 12,
    });
    await save();
    go('settings');
  });
  add.appendChild(label);
  add.appendChild(btn);
  c.appendChild(add);
  return c;
}

function dishLibCard() {
  const c = card('菜色庫管理（八個分類）');
  const save = async () => {
    await saveConfig({ dishLib: cfg.dishLib, updatedBy: ctx.session && ctx.session.account });
  };
  const sel = el('select');
  sel.setAttribute('aria-label', '選擇分類');
  for (const cat of CATEGORIES) {
    const o = el('option', null, `${cat.label}（${(cfg.dishLib[cat.key] || []).length}）`);
    o.value = cat.key;
    sel.appendChild(o);
  }
  const list = el('div');
  list.id = 'dishLibList';

  const paint = () => {
    CATEGORIES.forEach((cat, i) => {
      sel.options[i].textContent = `${cat.label}（${(cfg.dishLib[cat.key] || []).length}）`;
    });
    list.textContent = '';
    const key = sel.value;
    (cfg.dishLib[key] || []).forEach((name, i) => {
      const row = el('div', 'set-row');
      const input = el('input');
      input.type = 'text';
      input.value = name;
      input.style.width = '160px';
      input.setAttribute('aria-label', '菜色名稱');
      input.addEventListener('change', async () => {
        const v = input.value.trim();
        if (!v) { input.value = name; return toast('菜色名稱不可為空'); }
        cfg.dishLib[key][i] = v;
        await save();
        toast('已儲存');
      });
      row.appendChild(input);

      const up = el('button', 'btn btn-sm', '↑');
      up.type = 'button';
      up.disabled = i === 0;
      up.addEventListener('click', async () => {
        const arr = cfg.dishLib[key];
        [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
        await save();
        paint();
      });
      row.appendChild(up);

      const del = el('button', 'btn btn-sm btn-danger', '刪');
      del.type = 'button';
      del.addEventListener('click', async () => {
        cfg.dishLib[key] = cfg.dishLib[key].filter((_, j) => j !== i);
        await save();
        paint();
      });
      row.appendChild(del);
      list.appendChild(row);
    });

    const add = el('div', 'set-row');
    const input = el('input');
    input.type = 'text';
    input.placeholder = '新增菜色';
    input.setAttribute('aria-label', '新增菜色');
    const btn = el('button', 'btn btn-sm', '＋新增');
    btn.type = 'button';
    btn.addEventListener('click', async () => {
      const v = input.value.trim();
      if (!v) return toast('請輸入菜色名稱');
      cfg.dishLib[key] = cfg.dishLib[key] || [];
      cfg.dishLib[key].push(v);
      await save();
      paint();
    });
    add.appendChild(input);
    add.appendChild(btn);
    list.appendChild(add);
  };

  sel.addEventListener('change', paint);
  c.appendChild(sel);
  c.appendChild(list);
  paint();
  return c;
}

function accountCard() {
  const c = card('帳號管理');
  const list = el('div');
  list.id = 'accountList';

  const paint = async () => {
    list.textContent = '';
    const { accounts } = await apiFetch('/api/fz/accounts');
    for (const a of accounts) {
      const row = el('div', 'set-row');
      row.appendChild(el('span', 'label', a.account));
      row.appendChild(el('span', 'badge' + (a.role === 'owner' ? ' badge-owner' : ''), a.role === 'owner' ? '主帳號' : '員工'));
      if (a.disabled) row.appendChild(el('span', 'badge badge-off', '已停用'));
      if (a.mustChangePassword) row.appendChild(el('span', 'badge', '需改密碼'));

      const reset = el('button', 'btn btn-sm', '改密碼');
      reset.type = 'button';
      reset.addEventListener('click', async () => {
        const pw = prompt(`請輸入 ${a.account} 的新密碼（至少 6 碼）`);
        if (!pw) return;
        try {
          await apiFetch('/api/fz/accounts/' + a.uid, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw }),
          });
          toast('已更新密碼');
          paint();
        } catch (e) { toast(e.message); }
      });
      row.appendChild(reset);

      const toggle = el('button', 'btn btn-sm', a.disabled ? '啟用' : '停用');
      toggle.type = 'button';
      toggle.addEventListener('click', async () => {
        try {
          await apiFetch('/api/fz/accounts/' + a.uid, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ disabled: !a.disabled }),
          });
          toast('已更新');
          paint();
        } catch (e) { toast(e.message); }
      });
      row.appendChild(toggle);

      const del = el('button', 'btn btn-sm btn-danger', '刪除');
      del.type = 'button';
      del.addEventListener('click', async () => {
        if (!confirm(`確定刪除帳號 ${a.account}？此操作無法復原。`)) return;
        try {
          await apiFetch('/api/fz/accounts/' + a.uid, { method: 'DELETE' });
          toast('已刪除');
          paint();
        } catch (e) { toast(e.message); }
      });
      row.appendChild(del);
      list.appendChild(row);
    }

    const add = el('div', 'set-row');
    const account = el('input');
    account.type = 'text';
    account.placeholder = '新帳號';
    account.setAttribute('aria-label', '新帳號');
    const password = el('input');
    password.type = 'password';
    password.id = 'newStaffPassword';
    password.placeholder = '密碼至少 6 碼';
    password.style.paddingRight = '40px';
    password.setAttribute('aria-label', '新帳號密碼');
    const pwWrap = el('div', 'pw-wrap');
    pwWrap.style.cssText = 'position:relative;display:flex;align-items:center';
    pwWrap.appendChild(password);
    const pwToggle = el('button', 'pw-toggle');
    pwToggle.type = 'button';
    pwToggle.setAttribute('aria-label', '顯示或隱藏密碼');
    pwToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    pwToggle.setAttribute('onclick', "togglePw('newStaffPassword',this)");
    pwWrap.appendChild(pwToggle);
    const btn = el('button', 'btn btn-sm btn-primary', '＋建立員工');
    btn.type = 'button';
    btn.addEventListener('click', async () => {
      try {
        await apiFetch('/api/fz/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: account.value.trim(), password: password.value }),
        });
        toast('已建立');
        paint();
      } catch (e) { toast(e.message); }
    });
    add.appendChild(account);
    add.appendChild(pwWrap);
    add.appendChild(btn);
    list.appendChild(add);
  };

  const wrap = el('div');
  const loading = el('p', 'hint', '載入中…');
  wrap.appendChild(loading);
  paint().then(() => loading.remove()).catch(e => {
    loading.textContent = '載入失敗：' + e.message;
  });
  wrap.appendChild(list);
  c.appendChild(wrap);
  return c;
}

function passwordCard() {
  const c = card('變更我的密碼');
  c.appendChild(el('p', 'hint', '密碼至少 6 碼。'));
  for (const [key, label] of [['pwCurrent', '舊密碼'], ['pwNew', '新密碼'], ['pwConfirm', '確認新密碼']]) {
    const row = el('div', 'set-row');
    row.appendChild(el('span', 'label', label));
    const wrap2 = el('span', 'pw-wrap');
    const input = el('input');
    input.type = 'password';
    input.id = key;
    input.style.width = '150px';
    input.style.paddingRight = '40px';
    input.setAttribute('aria-label', label);
    const btn = el('button', 'pw-toggle');
    btn.type = 'button';
    btn.setAttribute('aria-label', '顯示或隱藏密碼');
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    btn.setAttribute('onclick', `togglePw('${key}',this)`);
    wrap2.appendChild(input);
    wrap2.appendChild(btn);
    row.appendChild(wrap2);
    c.appendChild(row);
  }
  const btn = el('button', 'btn btn-primary', '變更密碼');
  btn.type = 'button';
  btn.addEventListener('click', async () => {
    const currentPassword = $('pwCurrent').value;
    const newPassword = $('pwNew').value;
    if (newPassword !== $('pwConfirm').value) return toast('兩次新密碼不一致');
    try {
      await changePassword(currentPassword, newPassword);
      $('pwCurrent').value = $('pwNew').value = $('pwConfirm').value = '';
      toast('密碼已變更，請重新登入');
      document.dispatchEvent(new CustomEvent('fz:logout'));
    } catch (e) { toast(e.message); }
  });
  c.appendChild(btn);
  return c;
}

export async function renderSettings() {
  cfg = await loadConfig();
  const body = $('settingsBody');
  body.textContent = '';
  const isOwner = ctx.session && ctx.session.role === 'owner';

  body.appendChild(dishLibCard());
  body.appendChild(passwordCard());
  if (isOwner) {
    body.appendChild(slotCard());
    body.appendChild(prepCard());
    body.appendChild(accountCard());
  } else {
    const note = el('p', 'hint', '備料係數、用餐時段與帳號管理僅主帳號可調整。');
    body.appendChild(note);
  }

  const out = el('button', 'btn btn-danger btn-block', '登出');
  out.type = 'button';
  out.style.marginTop = '16px';
  out.addEventListener('click', () => document.dispatchEvent(new CustomEvent('fz:logout')));
  body.appendChild(out);
}

export function mountSettings() {
  document.addEventListener('fz:view', async e => {
    if (e.detail.view !== 'settings') return;
    ctx.backView = ctx.anchor ? 'day' : 'calendar';
    await renderSettings();
  });
}
