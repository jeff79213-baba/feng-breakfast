import { test, beforeAll, afterAll } from 'vitest';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, deleteDoc, getDoc, getDocs, collection, setDoc, updateDoc } from 'firebase/firestore';

let env;

const PROJECT = 'demo-fzbf';

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
  await seedConfigApp();
});

afterAll(async () => { if (env) await env.cleanup(); });

const asUser = (email, extra = {}) => env.authenticatedContext(
  email.replace(/[^a-z0-9]/gi, '_'),
  { email, email_verified: true, ...extra },
).firestore();

const asAnon = () => env.unauthenticatedContext().firestore();

const seedMember = (email, role) => env.withSecurityRulesDisabled(async ctx => {
  await setDoc(doc(ctx.firestore(), 'fz_users', email), {
    role, addedAt: null, addedBy: 'seed',
  });
});

const seedConfigApp = () => env.withSecurityRulesDisabled(async ctx => {
  await setDoc(doc(ctx.firestore(), 'fz_config', 'app'), {
    dishLib: { meat: ['滷豬耳'] }, prep: { riceAdult: 0.2 }, updatedAt: null,
  });
});

const removeConfigApp = () => env.withSecurityRulesDisabled(async ctx => {
  await deleteDoc(doc(ctx.firestore(), 'fz_config', 'app'));
});

test('匿名完全不能讀寫每日資料', async () => {
  const db = asAnon();
  await assertFails(getDoc(doc(db, 'fz_days', '2026-10-04')));
  await assertFails(setDoc(doc(db, 'fz_days', '2026-10-04'), { b1: {} }));
});

test('未驗證 email 的登入者不能讀每日資料', async () => {
  await seedMember('unverified@fz.app', 'editor');
  const db = env.authenticatedContext('unverified', {
    email: 'unverified@fz.app', email_verified: false,
  }).firestore();
  await assertFails(getDoc(doc(db, 'fz_days', '2026-10-04')));
});

test('不在名單內的登入者不能讀寫每日資料', async () => {
  const db = asUser('ghost@gmail.com');
  await assertFails(getDoc(doc(db, 'fz_days', '2026-10-04')));
  await assertFails(setDoc(doc(db, 'fz_days', '2026-10-04'), { b1: {} }));
});

test('員工可讀寫每日資料與冰箱', async () => {
  await seedMember('staff@gmail.com', 'editor');
  const db = asUser('staff@gmail.com');
  await assertSucceeds(setDoc(doc(db, 'fz_days', '2026-10-04'), {
    b1: { rooms: 10, adult: 20, child: 5, infant: 2, dishes: {}, extra: {} },
  }));
  await assertSucceeds(getDoc(doc(db, 'fz_days', '2026-10-04')));
  await assertSucceeds(setDoc(doc(db, 'fz_pantry', 'pantry'), {
    items: [{ name: '雞蛋', qty: 60 }],
  }));
});

test('名單文件角色不合法時一律拒絕', async () => {
  await seedMember('weird@gmail.com', 'owner');
  const db = asUser('weird@gmail.com');
  await assertFails(getDoc(doc(db, 'fz_days', '2026-10-04')));
  await assertFails(getDoc(doc(db, 'fz_pantry', 'pantry')));
  await assertFails(updateDoc(doc(db, 'fz_config', 'app'), { prep: { riceAdult: 0.5 } }));
});

test('大小寫不同的 email 也算同一人', async () => {
  await seedMember('mixed@gmail.com', 'editor');
  const db = asUser('Mixed@Gmail.com');
  await assertSucceeds(getDoc(doc(db, 'fz_days', '2026-10-04')));
});

test('員工可讀寫自己的名單文件，不能讀別人的', async () => {
  await seedMember('staff@gmail.com', 'editor');
  await seedMember('other@gmail.com', 'editor');
  const db = asUser('staff@gmail.com');
  await assertSucceeds(getDoc(doc(db, 'fz_users', 'staff@gmail.com')));
  await assertFails(getDoc(doc(db, 'fz_users', 'other@gmail.com')));
});

test('員工不能新增或刪除名單文件', async () => {
  await seedMember('staff@gmail.com', 'editor');
  const db = asUser('staff@gmail.com');
  await assertFails(setDoc(doc(db, 'fz_users', 'newbie@gmail.com'), {
    role: 'editor', addedAt: null, addedBy: 'staff@gmail.com',
  }));
  await assertFails(deleteDoc(doc(db, 'fz_users', 'staff@gmail.com')));
});

test('員工不能建立 fz_config/app，也不能改備料係數', async () => {
  await removeConfigApp();
  await seedMember('staff@gmail.com', 'editor');
  const db = asUser('staff@gmail.com');
  await assertFails(setDoc(doc(db, 'fz_config', 'app'), {
    dishLib: { meat: ['滷豬耳'] }, prep: { riceAdult: 0.3 }, updatedAt: null,
  }));
  await seedConfigApp();
  await assertFails(updateDoc(doc(db, 'fz_config', 'app'), { prep: { riceAdult: 0.9 } }));
});

test('員工可新增菜色庫', async () => {
  await seedMember('staff@gmail.com', 'editor');
  const db = asUser('staff@gmail.com');
  await assertSucceeds(updateDoc(doc(db, 'fz_config', 'app'), {
    dishLib: { meat: ['滷豬耳', '控肉'] }, updatedBy: 'staff@gmail.com',
  }));
});

test('主帳號可列出全部名單並新增、改角色、刪除', async () => {
  await seedMember('boss@gmail.com', 'admin');
  await seedMember('staff@gmail.com', 'editor');
  const db = asUser('boss@gmail.com');
  await assertSucceeds(getDoc(doc(db, 'fz_users', 'staff@gmail.com')));
  await assertSucceeds(getDocs(collection(db, 'fz_users')));
  await assertSucceeds(setDoc(doc(db, 'fz_users', 'newbie@gmail.com'), {
    role: 'editor', addedAt: null, addedBy: 'boss@gmail.com',
  }));
  await assertSucceeds(updateDoc(doc(db, 'fz_users', 'newbie@gmail.com'), {
    role: 'admin', addedBy: 'boss@gmail.com',
  }));
  await assertSucceeds(deleteDoc(doc(db, 'fz_users', 'newbie@gmail.com')));
});

test('主帳號不能刪除或降級自己', async () => {
  await seedMember('boss@gmail.com', 'admin');
  const db = asUser('boss@gmail.com');
  await assertFails(deleteDoc(doc(db, 'fz_users', 'boss@gmail.com')));
  await assertFails(updateDoc(doc(db, 'fz_users', 'boss@gmail.com'), {
    role: 'editor', addedBy: 'boss@gmail.com',
  }));
});

test('名單文件夾帶不允許的欄位時拒絕', async () => {
  await seedMember('boss@gmail.com', 'admin');
  const db = asUser('boss@gmail.com');
  await assertFails(setDoc(doc(db, 'fz_users', 'evil@gmail.com'), {
    role: 'admin', addedAt: null, addedBy: 'boss@gmail.com', note: 'sneaky',
  }));
  await assertFails(setDoc(doc(db, 'fz_users', 'evil@gmail.com'), {
    role: 'superuser', addedAt: null, addedBy: 'boss@gmail.com',
  }));
});

test('主帳號可改備料係數', async () => {
  await seedMember('boss@gmail.com', 'admin');
  const db = asUser('boss@gmail.com');
  await assertSucceeds(updateDoc(doc(db, 'fz_config', 'app'), {
    prep: { riceAdult: 0.25 }, updatedBy: 'boss@gmail.com',
  }));
});

test('匿名不能讀寫名單', async () => {
  const db = asAnon();
  await assertFails(getDoc(doc(db, 'fz_users', 'boss@gmail.com')));
  await assertFails(setDoc(doc(db, 'fz_users', 'boss@gmail.com'), {
    role: 'admin', addedAt: null, addedBy: 'x',
  }));
});

test('未定義路徑一律被拒絕', async () => {
  await seedMember('boss@gmail.com', 'admin');
  const db = asUser('boss@gmail.com');
  await assertFails(getDoc(doc(db, 'fz_unknown', 'x')));
  await assertFails(setDoc(doc(db, 'fz_unknown', 'x'), { a: 1 }));
  await assertFails(getDoc(doc(db, 'fz_accounts', 'someone')));
  const anon = asAnon();
  await assertFails(getDoc(doc(anon, 'fz_unknown', 'x')));
  await assertFails(setDoc(doc(anon, 'fz_unknown', 'x'), { a: 1 }));
});
