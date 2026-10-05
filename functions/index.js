'use strict';

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2/options');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

setGlobalOptions({ region: 'asia-east1', maxInstances: 10 });
initializeApp();

const auth = getAuth();
const db = getFirestore();

const WEB_API_KEY = 'AIzaSyD3quPJCOUoUH_Um5UceWXYuUXfRpJEuyo';

const EMAIL_DOMAIN = 'fzbf.app';
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const MIN_PASSWORD = 6;
const MAX_PASSWORD = 72;
const MAX_ACCOUNT = 32;
const MAX_EMAIL = 64;

const SHORT_ACCOUNT_RE = /^[a-z0-9][a-z0-9._-]{0,31}$/;
const FULL_EMAIL_RE = /^[a-z0-9][a-z0-9._+-]*@[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/;

const ALLOWED_ORIGINS = ['https://fzbf-sk.web.app', 'http://localhost:5000'];

const api = express();
api.set('trust proxy', 1);
api.use(cors({
  origin(origin, cb) {
    if (!origin || ALLOWED_ORIGINS.indexOf(origin) >= 0) return cb(null, true);
    return cb(null, false);
  },
}));
api.use(express.json({ limit: '16kb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '嘗試次數過多，請稍後再試' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '操作過於頻繁，請稍後再試' },
});

function normalizeAccount(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return '';
  return String(raw).trim().toLowerCase();
}

function toEmail(account) {
  return `${account}@${EMAIL_DOMAIN}`;
}

function resolveEmail(raw) {
  const account = normalizeAccount(raw);
  if (!account) return null;
  if (account.indexOf('@') >= 0) {
    return account.length <= MAX_EMAIL && FULL_EMAIL_RE.test(account) ? account : null;
  }
  return account.length <= MAX_ACCOUNT && SHORT_ACCOUNT_RE.test(account) ? toEmail(account) : null;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

async function verifyPassword(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = (data && data.error && data.error.message) || 'UNKNOWN';
    const err = new Error(code);
    err.code = code;
    throw err;
  }
  return data;
}

async function readAccountDoc(uid) {
  const snap = await db.doc(`fz_accounts/${uid}`).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function recordFailure(attemptRef, account) {
  await attemptRef.set({
    count: FieldValue.increment(1),
    account,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  const after = await attemptRef.get();
  const raw = after.exists ? after.data().count : undefined;
  const count = Number.isInteger(raw) ? raw : MAX_FAILS;
  if (count < MAX_FAILS) return false;
  await attemptRef.set({
    count: 0,
    lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return true;
}

async function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: '請先登入' });
  try {
    req.uid = (await auth.verifyIdToken(token, true)).uid;
    next();
  } catch (e) {
    return res.status(401).json({ error: '登入已失效，請重新登入' });
  }
}

async function requireOwner(req, res, next) {
  const acct = await readAccountDoc(req.uid);
  if (!acct || acct.disabled === true || acct.role !== 'owner') {
    return res.status(403).json({ error: '僅主帳號可執行此操作' });
  }
  req.accountDoc = acct;
  next();
}

function weakMessage(pw) {
  const s = String(pw == null ? '' : pw);
  if (s.length < MIN_PASSWORD) return `密碼至少 ${MIN_PASSWORD} 碼`;
  if (s.length > MAX_PASSWORD) return `密碼不可超過 ${MAX_PASSWORD} 碼`;
  return null;
}

function logServerError(err, req) {
  const type = err && err.type ? String(err.type) : '';
  const head = `${req.method} ${req.path} :: ${(err && err.name) || 'Error'}`;
  const detail = type.indexOf('entity.') === 0 ? type : String((err && err.stack) || err);
  console.error(`[fzapi] ${head} :: ${detail}`);
}

api.post('/fz/login', loginLimiter, async (req, res) => {
  const body = req.body || {};
  const password = String(body.password || '');
  if (!password) return res.status(400).json({ error: '請輸入帳號與密碼' });

  const account = normalizeAccount(body.account);
  const email = resolveEmail(body.account);
  if (!email) return res.status(400).json({ error: '帳號格式不正確，請重新輸入' });

  const attemptRef = db.doc(`fz_login_attempts/${email}`);
  const snap = await attemptRef.get();
  const attempts = snap.exists ? snap.data() : {};

  if (attempts.lockedUntil) {
    const left = toMillis(attempts.lockedUntil) - Date.now();
    if (left > 0) {
      const mins = Math.max(1, Math.ceil(left / 60000));
      return res.status(423).json({ error: `密碼錯誤次數過多，請 ${mins} 分鐘後再試`, lockedMinutes: mins });
    }
    await attemptRef.set({ count: 0, lockedUntil: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  let uid;
  try {
    const out = await verifyPassword(email, password);
    uid = out.localId;
  } catch (e) {
    const locked = await recordFailure(attemptRef, account);
    if (e.code === 'USER_DISABLED') return res.status(403).json({ error: '此帳號已停用' });
    if (locked) {
      return res.status(423).json({ error: `密碼錯誤次數過多，已鎖住，剩餘 ${LOCK_MINUTES} 分鐘`, lockedMinutes: LOCK_MINUTES });
    }
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }

  const acct = await readAccountDoc(uid);
  if (!acct) return res.status(403).json({ error: '此帳號尚未開通' });
  if (acct.disabled === true) return res.status(403).json({ error: '此帳號已停用' });

  await attemptRef.delete().catch(() => {});

  const customToken = await auth.createCustomToken(uid, {
    role: acct.role, account: acct.account || account,
  });
  return res.json({
    customToken,
    uid,
    role: acct.role,
    account: acct.account || account,
  });
});

api.get('/fz/me', apiLimiter, requireAuth, async (req, res) => {
  const acct = await readAccountDoc(req.uid);
  if (!acct) return res.status(403).json({ error: '查無帳號' });
  if (acct.disabled === true) return res.status(403).json({ error: '此帳號已停用' });
  return res.json({ uid: req.uid, account: acct.account, role: acct.role });
});

api.post('/fz/change-password', apiLimiter, requireAuth, async (req, res) => {
  const body = req.body || {};
  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');
  if (!currentPassword || !newPassword) return res.status(400).json({ error: '請填寫完整' });

  const weak = weakMessage(newPassword);
  if (weak) return res.status(400).json({ error: weak });
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: '新密碼不可與舊密碼相同' });
  }

  const acct = await readAccountDoc(req.uid);
  if (!acct) return res.status(403).json({ error: '查無帳號' });
  if (acct.disabled === true) return res.status(403).json({ error: '此帳號已停用' });

  const email = resolveEmail(acct.account);
  if (!email) return res.status(403).json({ error: '帳號資料不完整，請聯絡主帳號' });

  try {
    await verifyPassword(email, currentPassword);
  } catch (e) {
    return res.status(401).json({ error: '舊密碼錯誤' });
  }

  await auth.updateUser(req.uid, { password: newPassword });
  await db.doc(`fz_accounts/${req.uid}`).update({
    mustChangePassword: false, updatedAt: FieldValue.serverTimestamp(),
  });
  try {
    await auth.revokeRefreshTokens(req.uid);
  } catch (e) {
    logServerError(e, req);
  }
  return res.json({ ok: true });
});

api.use((req, res) => res.status(404).json({ error: '找不到對應的端點' }));

api.use((err, req, res, next) => {
  logServerError(err, req);
  if (res.headersSent) return next(err);
  const type = err && err.type ? String(err.type) : '';
  if (type === 'entity.parse.failed') return res.status(400).json({ error: '資料格式不正確' });
  if (type === 'entity.too.large') return res.status(413).json({ error: '資料過大' });
  return res.status(500).json({ error: '伺服器發生錯誤' });
});

module.exports = { api };
module.exports.loginLimiter = loginLimiter;
module.exports.apiLimiter = apiLimiter;
module.exports.requireAuth = requireAuth;
module.exports.requireOwner = requireOwner;
module.exports.normalizeAccount = normalizeAccount;
module.exports.toEmail = toEmail;
module.exports.weakMessage = weakMessage;
module.exports.readAccountDoc = readAccountDoc;
module.exports.resolveEmail = resolveEmail;
module.exports.toMillis = toMillis;