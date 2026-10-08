import { initFirebase, onSession, signInWithGoogle, logout } from '../dslib.js';
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

export function mountAuth() {
  const btn = $('googleBtn');

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
