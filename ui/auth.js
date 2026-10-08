import { initFirebase, onSession, signInWithGoogle, signInWithAccount, logout } from '../dslib.js';
import { go, ctx } from '../app.js';

const $ = id => document.getElementById(id);

function showError(message) {
  const el = $('authError');
  el.textContent = message || '';
  el.hidden = !message;
}

function applySession(session) {
  ctx.session = session;
  if (!session) {
    showError('');
    go('auth');
    return;
  }
  if (!session.role) {
    $('deniedEmail').textContent = session.email || '（讀不到你的 Email）';
    go('denied');
    return;
  }
  showError('');
  go('calendar');
}

function friendlyAuthError(e) {
  const code = (e && e.code) || '';
  if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
    return '帳號或密碼錯誤';
  }
  if (code === 'auth/too-many-requests') return '嘗試次數過多，請稍後再試';
  if (code === 'auth/network-request-failed') return '網路連線失敗，請檢查連線後再試';
  return (e && e.message) || '登入失敗，請再試一次';
}

export function mountAuth() {
  const btn = $('googleBtn');
  const accountBtn = $('accountBtn');
  const accountInput = $('accountInput');
  const passwordInput = $('passwordInput');
  const pwToggle = $('pwToggle');

  pwToggle.addEventListener('click', () => {
    const show = passwordInput.type === 'password';
    passwordInput.type = show ? 'text' : 'password';
    pwToggle.textContent = show ? '隱藏' : '顯示';
    pwToggle.setAttribute('aria-label', show ? '隱藏密碼' : '顯示密碼');
  });

  async function submitAccount() {
    showError('');
    accountBtn.disabled = true;
    accountBtn.textContent = '登入中…';
    try {
      await signInWithAccount(accountInput.value, passwordInput.value);
      passwordInput.value = '';
    } catch (e) {
      showError(friendlyAuthError(e));
    } finally {
      accountBtn.disabled = false;
      accountBtn.textContent = '登入';
    }
  }

  accountBtn.addEventListener('click', submitAccount);
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitAccount();
  });

  btn.addEventListener('click', async () => {
    showError('');
    btn.disabled = true;
    btn.textContent = '登入中…';
    try {
      await signInWithGoogle();
    } catch (e) {
      showError((e && e.message) || '登入失敗，請再試一次');
    } finally {
      btn.disabled = false;
      btn.textContent = '使用 Google 登入';
    }
  });

  $('deniedOutBtn').addEventListener('click', () => logout());
  $('deniedRetryBtn').addEventListener('click', () => window.location.reload());
  document.addEventListener('fz:logout', () => logout());

  initFirebase();
  onSession(applySession);
}
