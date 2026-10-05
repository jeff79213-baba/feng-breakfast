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

const api = express();
api.use(cors({ origin: true }));
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
});

function normalizeAccount(raw) {
  return String(raw || '').trim().toLowerCase();
}

function toEmail(account) {
  return `${account}@${EMAIL_DOMAIN}`;
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
    const code = data?.error?.message || 'UNKNOWN';
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

api.post('/fz/login', loginLimiter, async (req, res) => {
  const account = normalizeAccount(req.body && req.body.account);
  const password = String((req.body && req.body.password) || '');
  if (!account || !password) return res.status(400).json({ error: '請輸入帳號與密碼' });

  const email = account.includes('@') ? account : toEmail(account);
  const attemptRef = db.doc(`fz_login_attempts/${email}`);
  const snap = await attemptRef.get();
  const attempts = snap.exists ? snap.data() : {};

  if (attempts.lockedUntil && attempts.lockedUntil.toMillis() > Date.now()) {
    const mins = Math.ceil((attempts.lockedUntil.toMillis() - Date.now()) / 60000);
    return res.status(423).json({ error: `密碼錯誤次數過多，請 ${mins} 分鐘後再試`, lockedMinutes: mins });
  }

  let uid;
  try {
    const out = await verifyPassword(email, password);
    uid = out.localId;
  } catch (e) {
    const count = (attempts.count || 0) + 1;
    const patch = { count, account, updatedAt: FieldValue.serverTimestamp() };
    const locked = count > MAX_FAILS;
    if (locked) {
      patch.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60000);
      patch.count = 0;
    }
    await attemptRef.set(patch, { merge: true });
    const code = e.code || '';
    if (code === 'USER_DISABLED') return res.status(403).json({ error: '此帳號已停用' });
    if (locked) {
      return res.status(423).json({ error: `密碼錯誤次數過多，已鎖住，剩餘 ${LOCK_MINUTES} 分鐘`, lockedMinutes: LOCK_MINUTES });
    }
    return res.status(401).json({ error: '帳號或密碼錯誤', remaining: MAX_FAILS + 1 - count });
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
  const currentPassword = String((req.body && req.body.currentPassword) || '');
  const newPassword = String((req.body && req.body.newPassword) || '');
  if (!currentPassword || !newPassword) return res.status(400).json({ error: '請填寫完整' });

  const weak = weakMessage(newPassword);
  if (weak) return res.status(400).json({ error: weak });
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: '新密碼不可與舊密碼相同' });
  }

  const acct = await readAccountDoc(req.uid);
  if (!acct) return res.status(403).json({ error: '查無帳號' });

  try {
    await verifyPassword(toEmail(acct.account), currentPassword);
  } catch (e) {
    return res.status(401).json({ error: '舊密碼錯誤' });
  }

  await auth.updateUser(req.uid, { password: newPassword });
  await db.doc(`fz_accounts/${req.uid}`).update({
    mustChangePassword: false, updatedAt: FieldValue.serverTimestamp(),
  });
  return res.json({ ok: true });
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
