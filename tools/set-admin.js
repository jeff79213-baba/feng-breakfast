import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const here = path.dirname(fileURLToPath(import.meta.url));
const keyDir = path.resolve(here, '..', '..');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['admin', 'editor'];

function findKeyFile() {
  const files = fs.readdirSync(keyDir)
    .filter(f => /^opencode-sk-.*\.json$/i.test(f))
    .sort();
  if (!files.length) {
    throw new Error(`找不到金鑰檔：${path.join(keyDir, 'opencode-sk-*.json')}`);
  }
  return path.join(keyDir, files[0]);
}

function db() {
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync(findKeyFile(), 'utf8'))) });
  return getFirestore();
}

async function list() {
  const snap = await db().collection('fz_users').get();
  if (snap.empty) {
    console.log('名單是空的。先把自己加進去：node tools/set-admin.js 你的信箱@gmail.com admin');
    return;
  }
  snap.forEach(d => console.log(`- ${d.id}  ${(d.data() || {}).role}`));
}

async function set(email, role) {
  await db().doc(`fz_users/${email}`).set({
    role,
    addedAt: FieldValue.serverTimestamp(),
    addedBy: 'set-admin',
  }, { merge: true });
  console.log(`[完成] ${email} → ${role}`);
}

async function remove(email) {
  await db().doc(`fz_users/${email}`).delete();
  console.log(`[完成] 已移除 ${email}`);
}

async function main() {
  const [rawEmail, rawRole, rawFlag] = process.argv.slice(2);
  if (!rawEmail || rawEmail === '--list') return list();

  const email = String(rawEmail).trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error('Email 格式不正確');

  if (rawRole === '--remove' || rawFlag === '--remove') return remove(email);

  const role = rawRole || 'admin';
  if (!ROLES.includes(role)) throw new Error('角色只能是 admin 或 editor');
  return set(email, role);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('[失敗]', err.message);
  process.exit(1);
});
