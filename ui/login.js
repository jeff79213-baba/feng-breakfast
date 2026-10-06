import { initFirebase, onSession, login, logout, apiFetch } from '../dslib.js';
import { go, ctx } from '../app.js';

const $ = id => document.getElementById(id);

function showError(message) {
  const el = $('loginError');
  el.textContent = message || '';
  el.hidden = !message;
}

async function submit() {
  const account = $('loginAccount').value.trim();
  const password = $('loginPassword').value;
  const btn = $('loginBtn');
  showError('');
  if (!account) return showError('請輸入帳號');
  if (password.length < 6) return showError('密碼至少 6 碼');

  btn.disabled = true;
  btn.textContent = '登入中…';
  try {
    await login(account, password);
    $('loginPassword').value = '';
  } catch (e) {
    showError(e.message || '登入失敗');
  } finally {
    btn.disabled = false;
    btn.textContent = '登入';
  }
}

export function mountLogin() {
  $('loginBtn').addEventListener('click', submit);
  $('loginPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
  });

  document.addEventListener('fz:logout', async () => {
    await logout();
  });

  initFirebase();
  onSession(session => {
    ctx.session = session;
    if (session) {
      go('calendar');
    } else {
      showError('');
      go('login');
    }
  });
}

export async function changePassword(currentPassword, newPassword) {
  return apiFetch('/api/fz/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
