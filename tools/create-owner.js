import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const keyDir = path.resolve(root, '..');

const ACCOUNT_RE = /^[a-z0-9][a-z0-9._+-]{0,31}$/;
const EMAIL_DOMAIN = 'fzbf.app';
const MIN_PASSWORD = 6;
const MAX_PASSWORD = 72;

function findKeyFile() {
  const files = fs.readdirSync(keyDir)
    .filter((f) => /^opencode-sk-.*\.json$/i.test(f))
    .sort();
  if (!files.length) {
    throw new Error(`找不到金鑰檔：${path.join(keyDir, 'opencode-sk-*.json')}`);
  }
  return path.join(keyDir, files[0]);
}

async function main() {
  const password = process.argv[2] || '000000';
  const account = String(process.argv[3] || 'wind').trim().toLowerCase();

  if (!ACCOUNT_RE.test(account)) {
    throw new Error('帳號格式不正確：1–32 位英數字，可用 . _ + -，需以英數字開頭');
  }
  if (password.length < MIN_PASSWORD) throw new Error(`密碼至少 ${MIN_PASSWORD} 碼`);
  if (password.length > MAX_PASSWORD) throw new Error(`密碼不可超過 ${MAX_PASSWORD} 碼`);

  const email = `${account}@${EMAIL_DOMAIN}`;

  initializeApp({ credential: cert(JSON.parse(fs.readFileSync(findKeyFile(), 'utf8'))) });

  const auth = getAuth();
  const db = getFirestore();

  let uid;
  let isNew = true;
  try {
    const created = await auth.createUser({ email, password, emailVerified: false, disabled: false });
    uid = created.uid;
    console.log(`[建立] ${email} uid=${uid}`);
  } catch (e) {
    if (e.code !== 'auth/email-already-exists') throw e;
    const found = await auth.getUserByEmail(email);
    uid = found.uid;
    isNew = false;
    await auth.updateUser(uid, { password, disabled: false });
    await auth.revokeRefreshTokens(uid).catch((err) => {
      console.error(`[警告] 無法撤銷既有登入憑證：${err.message}`);
    });
    console.log(`[更新] ${email} 已存在，密碼已重設，uid=${uid}`);
  }

  const data = {
    account,
    role: 'owner',
    disabled: false,
    mustChangePassword: false,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (isNew) data.createdAt = FieldValue.serverTimestamp();

  await db.doc(`fz_accounts/${uid}`).set(data, { merge: true });

  console.log(`[完成] ${email} / ${password} role=owner`);
  if (password === '000000') {
    console.log('[提醒] 目前為預設密碼，請登入後立即更改');
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('[失敗]', err.message);
  process.exit(1);
});
