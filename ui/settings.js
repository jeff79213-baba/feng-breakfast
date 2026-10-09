import { CATEGORIES } from '../menu-lib.js';
import { roleLabel, ACCOUNT_DOMAIN, DEFAULT_MEMBER_PASSWORD, isValidPassword, SUGGEST_FIELDS } from '../core.js';
import { loadConfig, saveConfig, listMembers, addMember, createMemberAccount, setMemberRole, removeMember, isPasswordAccount, changeOwnPassword } from '../dslib.js';
import { go, ctx, toast } from '../app.js';
import { el } from './dom.js';

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
    await saveConfig({ prep: cfg.prep, updatedBy: (ctx.session && ctx.session.email) || null });
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

function bracketCard() {
  const c = card('級距建議設定（房間數 → 建議道數）');
  c.appendChild(el('p', 'hint', '依房間數最近的級距套用建議，只會填入尚未選菜的分類。可自行調整各級距的房間數與各分類道數。'));
  const save = async () => {
    await saveConfig({ suggest: cfg.suggest, updatedBy: (ctx.session && ctx.session.email) || null });
    toast('已儲存');
  };

  for (const row of cfg.suggest) {
    const block = el('div', 'bracket-block');
    const head = el('div', 'bracket-head');
    const roomsLabel = el('label', 'bracket-rooms');
    roomsLabel.appendChild(el('span', null, '房間數'));
    const roomsInput = el('input');
    roomsInput.type = 'number';
    roomsInput.inputMode = 'numeric';
    roomsInput.min = '0';
    roomsInput.value = String(row.rooms);
    roomsInput.setAttribute('aria-label', '級距房間數');
    roomsInput.addEventListener('change', async () => {
      row.rooms = Math.max(0, Math.round(Number(roomsInput.value) || 0));
      roomsInput.value = String(row.rooms);
      cfg.suggest.sort((a, b) => a.rooms - b.rooms);
      await save();
      go('settings');
    });
    roomsLabel.appendChild(roomsInput);
    head.appendChild(roomsLabel);

    const del = el('button', 'btn btn-sm btn-danger', '刪除');
    del.type = 'button';
    del.disabled = cfg.suggest.length <= 1;
    del.addEventListener('click', async () => {
      cfg.suggest = cfg.suggest.filter(r => r !== row);
      await save();
      go('settings');
    });
    head.appendChild(del);
    block.appendChild(head);

    const grid = el('div', 'bracket-grid');
    for (const cat of CATEGORIES) {
      const cell = el('label', 'bracket-cell');
      cell.appendChild(el('span', null, cat.label));
      const inp = el('input');
      inp.type = 'number';
      inp.inputMode = 'numeric';
      inp.min = '0';
      inp.value = String(row[cat.key] || 0);
      inp.setAttribute('aria-label', cat.label + '建議道數');
      inp.addEventListener('change', async () => {
        row[cat.key] = Math.max(0, Math.round(Number(inp.value) || 0));
        inp.value = String(row[cat.key]);
        await save();
      });
      cell.appendChild(inp);
      grid.appendChild(cell);
    }
    block.appendChild(grid);
    c.appendChild(block);
  }

  const add = el('div', 'set-row');
  const btn = el('button', 'btn btn-sm', '＋新增級距');
  btn.type = 'button';
  btn.addEventListener('click', async () => {
    const maxRooms = cfg.suggest.reduce((m, r) => Math.max(m, r.rooms), 0);
    const row = { rooms: maxRooms + 5 };
    for (const f of SUGGEST_FIELDS) row[f] = 0;
    cfg.suggest.push(row);
    await save();
    go('settings');
  });
  add.appendChild(btn);
  c.appendChild(add);
  return c;
}

function slotCard() {
  const c = card('牛奶飲料補貨時段');
  const save = async () => {
    await saveConfig({ slots: cfg.slots, updatedBy: (ctx.session && ctx.session.email) || null });
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
  label.placeholder = '時間(HH:MM)';
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
    milk.placeholder = '牛奶';
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
    foil.placeholder = '鋁箔包';
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
  label.placeholder = '時間';
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
    await saveConfig({ dishLib: cfg.dishLib, updatedBy: (ctx.session && ctx.session.email) || null });
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

function memberCard() {
  const c = card('人員管理');
  c.appendChild(el('p', 'hint', '輸入短帳號＋密碼即可建立員工帳密；Google 登入者輸入完整 Gmail。離職刪除那一列即停用權限，登入帳號殘留需在電腦執行清除：node tools/set-account.js 短帳號 --remove。'));
  const list = el('div');
  list.id = 'memberList';

  const paint = async () => {
    list.textContent = '';
    let members = [];
    try {
      members = await listMembers();
    } catch (e) {
      list.appendChild(el('p', 'error', '載入失敗：' + e.message));
      return;
    }
    const me = (ctx.session && ctx.session.email) || '';
    for (const m of members) {
      const row = el('div', 'set-row');
      row.appendChild(el('span', 'label', m.email));
      row.appendChild(el('span', 'badge' + (m.role === 'admin' ? ' badge-owner' : ''), roleLabel(m.role)));
      const mine = m.email === me;
      if (mine) row.appendChild(el('span', 'badge', '你自己'));

      const swap = el('button', 'btn btn-sm', m.role === 'admin' ? '改為員工' : '改為主帳號');
      swap.type = 'button';
      swap.disabled = mine;
      swap.addEventListener('click', async () => {
        try {
          await setMemberRole(m.email, m.role === 'admin' ? 'editor' : 'admin');
          toast('已更新');
          paint();
        } catch (e) { toast(e.message); }
      });
      row.appendChild(swap);

      const del = el('button', 'btn btn-sm btn-danger', '刪除');
      del.type = 'button';
      del.disabled = mine;
      del.addEventListener('click', async () => {
        if (!confirm(`確定刪除 ${m.email}？刪除後這個帳號立刻無法使用。`)) return;
        try {
          await removeMember(m.email);
          toast('已刪除');
          paint();
        } catch (e) { toast(e.message); }
      });
      row.appendChild(del);
      list.appendChild(row);
    }

    const add = el('div', 'set-row');
    const email = el('input');
    email.type = 'text';
    email.id = 'newMemberEmail';
    email.inputMode = 'latin';
    email.autocomplete = 'off';
    email.style.width = '150px';
    email.setAttribute('aria-label', '新增人員帳號');
    const pwWrap = el('span', 'pw-wrap');
    const pw = el('input');
    pw.type = 'password';
    pw.id = 'newMemberPassword';
    pw.value = DEFAULT_MEMBER_PASSWORD;
    pw.autocomplete = 'new-password';
    pw.style.width = '120px';
    pw.setAttribute('aria-label', '新帳號密碼');
    const pwToggle = el('button', 'pw-toggle', '顯示');
    pwToggle.type = 'button';
    pwToggle.setAttribute('aria-label', '顯示密碼');
    pwToggle.addEventListener('click', () => {
      const show = pw.type === 'password';
      pw.type = show ? 'text' : 'password';
      pwToggle.textContent = show ? '隱藏' : '顯示';
      pwToggle.setAttribute('aria-label', show ? '隱藏密碼' : '顯示密碼');
    });
    pwWrap.appendChild(pw);
    pwWrap.appendChild(pwToggle);
    const btn = el('button', 'btn btn-sm btn-primary', '＋加入');
    btn.type = 'button';
    const note = el('p', 'hint', '');
    btn.addEventListener('click', async () => {
      const value = email.value.trim();
      try {
        if (value.includes('@')) {
          const added = await addMember(value, 'editor');
          toast('已加入，可直接用 Google 登入');
          note.textContent = `已加入 ${added}（員工），對方請用「使用 Google 登入」，無需密碼。`;
        } else {
          if (!isValidPassword(pw.value)) return toast('密碼至少 6 碼');
          const added = await createMemberAccount(value, pw.value, 'editor');
          const short = added.slice(0, -(ACCOUNT_DOMAIN.length + 1));
          toast('已建立，可用帳密登入');
          note.textContent = `已建立 ${added}（員工）。請用帳號「${short}」＋你設定的密碼登入；登入後可到「我的帳號」自行更改密碼。`;
          pw.value = DEFAULT_MEMBER_PASSWORD;
        }
        email.value = '';
        paint();
      } catch (e) { toast(e.message); }
    });
    add.appendChild(email);
    add.appendChild(pwWrap);
    add.appendChild(btn);
    list.appendChild(add);
    list.appendChild(note);
    list.appendChild(el('p', 'hint', '短帳號＝帳密登入（系統自動補網域）；完整 Gmail＝Google 登入，無需密碼。'));
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

function myAccountCard() {
  const c = card('我的帳號');
  const row = el('div', 'set-row');
  row.appendChild(el('span', 'label', (ctx.session && ctx.session.email) || ''));
  const role = ctx.session && ctx.session.role;
  row.appendChild(el('span', 'badge' + (role === 'admin' ? ' badge-owner' : ''), roleLabel(role)));
  c.appendChild(row);
  if (isPasswordAccount()) {
    c.appendChild(passwordForm());
  } else {
    c.appendChild(el('p', 'hint', 'Google 登入的帳號請到 Google 帳戶更改密碼。'));
  }
  c.appendChild(el('p', 'hint', '要用別的帳號登入，請先登出。'));
  return c;
}

function passwordForm() {
  const wrap = el('div');
  const mkPw = (placeholder) => {
    const box = el('span', 'pw-wrap');
    const input = el('input');
    input.type = 'password';
    input.placeholder = placeholder;
    input.autocomplete = 'new-password';
    input.style.width = '100%';
    const t = el('button', 'pw-toggle', '顯示');
    t.type = 'button';
    t.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      t.textContent = show ? '隱藏' : '顯示';
    });
    box.appendChild(input);
    box.appendChild(t);
    return { box, input };
  };
  const cur = mkPw('目前密碼');
  const next = mkPw('新密碼（至少 6 碼）');
  const again = mkPw('再輸入一次新密碼');
  const msg = el('p', 'hint', '');
  const btn = el('button', 'btn btn-primary btn-block', '更改密碼');
  btn.type = 'button';
  btn.style.marginTop = '10px';
  btn.addEventListener('click', async () => {
    msg.textContent = '';
    if (next.input.value !== again.input.value) {
      msg.textContent = '兩次輸入的新密碼不一致';
      msg.className = 'error';
      return;
    }
    btn.disabled = true;
    btn.textContent = '更改中…';
    try {
      await changeOwnPassword(cur.input.value, next.input.value);
      cur.input.value = '';
      next.input.value = '';
      again.input.value = '';
      msg.textContent = '密碼已更改，下次請用新密碼登入';
      msg.className = 'hint';
      toast('密碼已更改');
    } catch (e) {
      const code = (e && e.code) || '';
      msg.textContent = (code === 'auth/invalid-credential' || code === 'auth/wrong-password')
        ? '目前密碼錯誤'
        : (e && e.message) || '更改失敗，請再試一次';
      msg.className = 'error';
    } finally {
      btn.disabled = false;
      btn.textContent = '更改密碼';
    }
  });
  wrap.appendChild(cur.box);
  wrap.appendChild(next.box);
  wrap.appendChild(again.box);
  wrap.appendChild(btn);
  wrap.appendChild(msg);
  return wrap;
}

export async function renderSettings() {
  cfg = await loadConfig();
  const body = $('settingsBody');
  body.textContent = '';
  const isAdmin = ctx.session && ctx.session.role === 'admin';

  body.appendChild(dishLibCard());
  body.appendChild(myAccountCard());
  if (isAdmin) {
    body.appendChild(slotCard());
    body.appendChild(prepCard());
    body.appendChild(bracketCard());
    body.appendChild(memberCard());
  } else {
    const note = el('p', 'hint', '備料係數、級距建議、牛奶飲料補貨時段與人員管理僅主帳號可調整。');
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
