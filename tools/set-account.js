import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { accountToEmail } from '../core.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const keyDir = path.resolve(here, '..', '..');

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

let app = null;
function admin() {
  if (!app) {
    app = initializeApp({ credential: cert(JSON.parse(fs.readFileSync(findKeyFile(), 'utf8'))) });
  }
  return { auth: getAuth(app), db: getFirestore(app) };
}

function usage() {
  console.log('用法：');
  console.log('  node tools/set-account.js <帳號> <密碼> [admin|editor]  開帳號（預設 editor）');
  console.log('  node tools/set-account.js <帳號> --password <新密碼>    重設密碼');
  console.log('  node tools/set-account.js <帳號> --remove               刪除帳號與名單');
  console.log('  node tools/set-account.js --list                        列出目前名單');
}

async function list() {
  const { db } = admin();
  const snap = await db.collection('fz_users').get();
  if (snap.empty) {
    console.log('名單是空的。開第一個主帳號：node tools/set-account.js wind <新密碼> admin');
    return;
  }
  snap.forEach(d => console.log(`- ${d.id}  ${(d.data() || {}).role}`));
}

async function open(rawAccount, password, role) {
  const email = accountToEmail(rawAccount);
  if (!email) throw new Error('帳號格式不正確');
  if (!password || password.length < 6) throw new Error('密碼至少 6 碼');
  if (!ROLES.includes(role)) throw new Error('角色只能是 admin 或 editor');
  const { auth, db } = admin();
  let created = true;
  try {
    await auth.createUser({ email, password, emailVerified: true, disabled: false });
  } catch (e) {
    if (e.code !== 'auth/email-already-exists') throw e;
    created = false;
    await auth.updateUser((await auth.getUserByEmail(email)).uid, { password, emailVerified: true, disabled: false });
  }
  await db.doc(`fz_users/${email}`).set({
    role,
    addedAt: FieldValue.serverTimestamp(),
    addedBy: 'set-account',
  }, { merge: true });
  console.log(`[完成] ${email} → ${role}${created ? '' : '（帳號已存在，已更新密碼與角色）'}`);
}

async function resetPassword(rawAccount, password) {
  const email = accountToEmail(rawAccount);
  if (!email) throw new Error('帳號格式不正確');
  if (!password || password.length < 6) throw new Error('密碼至少 6 碼');
  const { auth } = admin();
  const user = await auth.getUserByEmail(email);
  await auth.updateUser(user.uid, { password });
  console.log(`[完成] ${email} 密碼已重設`);
}

async function remove(rawAccount) {
  const email = accountToEmail(rawAccount);
  if (!email) throw new Error('帳號格式不正確');
  const { auth, db } = admin();
  try {
    await auth.deleteUser((await auth.getUserByEmail(email)).uid);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
  }
  await db.doc(`fz_users/${email}`).delete();
  console.log(`[完成] 已刪除 ${email}`);
  const rest = await db.collection('fz_users').where('role', '==', 'admin').get();
  if (rest.empty) console.log('[注意] 名單內已沒有 admin，請盡快補一位，否則無人能管理人員');
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args[0] === '--help') return usage();
  if (args[0] === '--list') return list();
  const [rawAccount, second, third] = args;
  if (second === '--remove') return remove(rawAccount);
  if (second === '--password') return resetPassword(rawAccount, third);
  return open(rawAccount, second, third || 'editor');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('[失敗]', err.message);
  process.exit(1);
});
