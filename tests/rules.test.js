import { test, beforeAll, afterAll } from 'vitest';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, deleteDoc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

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

const asUser = (uid) => env.authenticatedContext(uid).firestore();
const asAnon = () => env.unauthenticatedContext().firestore();

const seedAccount = async (uid, data) => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'fz_accounts', uid), {
      account: uid, role: 'staff', disabled: false, ...data,
    });
  });
};

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

test('未註冊的登入者（無 fz_accounts 文件）不能讀每日資料', async () => {
  const db = asUser('ghost');
  await assertFails(getDoc(doc(db, 'fz_days', '2026-10-04')));
});

test('停用帳號不能讀每日資料', async () => {
  await seedAccount('off', { disabled: true });
  const db = asUser('off');
  await assertFails(getDoc(doc(db, 'fz_days', '2026-10-04')));
});

test('fz_accounts 缺少 disabled 欄位時一律拒絕', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'fz_accounts', 'nod'), {
      account: 'nod', role: 'owner',
    });
  });
  const db = asUser('nod');
  await assertFails(getDoc(doc(db, 'fz_accounts', 'nod')));
  await assertFails(getDoc(doc(db, 'fz_days', '2026-10-04')));
  await assertFails(getDoc(doc(db, 'fz_pantry', '2026-10-04')));
  await assertFails(updateDoc(doc(db, 'fz_config', 'app'), { prep: { riceAdult: 0.5 } }));
});

test('active 員工可讀寫自己的館別資料', async () => {
  await seedAccount('staff1', { role: 'staff' });
  const db = asUser('staff1');
  await assertSucceeds(setDoc(doc(db, 'fz_days', '2026-10-04'), {
    b1: { rooms: 10, adult: 20, child: 5, infant: 2, dishes: {}, extra: {} },
  }));
  await assertSucceeds(getDoc(doc(db, 'fz_days', '2026-10-04')));
});

test('匿名不能讀寫 fz_pantry', async () => {
  const db = asAnon();
  await assertFails(getDoc(doc(db, 'fz_pantry', '2026-10-04')));
  await assertFails(setDoc(doc(db, 'fz_pantry', '2026-10-04'), { items: [] }));
});

test('active 員工可讀寫 fz_pantry', async () => {
  await seedAccount('staff1', { role: 'staff' });
  const db = asUser('staff1');
  await assertSucceeds(setDoc(doc(db, 'fz_pantry', '2026-10-04'), {
    items: [{ name: '雞蛋', qty: 60 }],
  }));
  await assertSucceeds(getDoc(doc(db, 'fz_pantry', '2026-10-04')));
});

test('停用帳號不能讀寫 fz_pantry', async () => {
  await seedAccount('off2', { disabled: true });
  const db = asUser('off2');
  await assertFails(getDoc(doc(db, 'fz_pantry', '2026-10-04')));
  await assertFails(setDoc(doc(db, 'fz_pantry', '2026-10-04'), { items: [] }));
});

test('員工不能寫入 fz_accounts', async () => {
  await seedAccount('staff1', { role: 'staff' });
  const db = asUser('staff1');
  await assertFails(setDoc(doc(db, 'fz_accounts', 'hacker'), { role: 'owner' }));
});

test('員工不能讀別人的 fz_accounts，但可讀自己的', async () => {
  await seedAccount('staff1', { role: 'staff' });
  await seedAccount('staff2', { role: 'staff' });
  const db = asUser('staff1');
  await assertSucceeds(getDoc(doc(db, 'fz_accounts', 'staff1')));
  await assertFails(getDoc(doc(db, 'fz_accounts', 'staff2')));
});

test('匿名不能讀寫 fz_login_attempts', async () => {
  const db = asAnon();
  await assertFails(getDoc(doc(db, 'fz_login_attempts', '2026-10-04')));
  await assertFails(setDoc(doc(db, 'fz_login_attempts', '2026-10-04'), { count: 3 }));
});

test('owner 也不能讀寫 fz_login_attempts', async () => {
  await seedAccount('boss', { role: 'owner' });
  const db = asUser('boss');
  await assertFails(getDoc(doc(db, 'fz_login_attempts', '2026-10-04')));
  await assertFails(setDoc(doc(db, 'fz_login_attempts', '2026-10-04'), { count: 3 }));
});

test('員工不可改備料係數，但可加菜色庫', async () => {
  await seedAccount('staff1', { role: 'staff' });
  const db = asUser('staff1');
  await assertSucceeds(updateDoc(doc(db, 'fz_config', 'app'), {
    dishLib: { meat: ['滷豬耳', '控肉'] }, updatedBy: 'staff1',
  }));
  await assertFails(updateDoc(doc(db, 'fz_config', 'app'), { prep: { riceAdult: 0.9 } }));
});

test('員工不可建立 fz_config/app', async () => {
  await removeConfigApp();
  await seedAccount('staff1', { role: 'staff' });
  const db = asUser('staff1');
  await assertFails(setDoc(doc(db, 'fz_config', 'app'), {
    dishLib: { meat: ['滷豬耳'] }, prep: { riceAdult: 0.3 }, updatedAt: null,
  }));
  await seedConfigApp();
});

test('owner 可改備料係數', async () => {
  await seedAccount('boss', { role: 'owner' });
  const db = asUser('boss');
  await assertSucceeds(updateDoc(doc(db, 'fz_config', 'app'), {
    prep: { riceAdult: 0.25 }, updatedBy: 'boss',
  }));
});

test('owner 可讀所有 fz_accounts', async () => {
  await seedAccount('boss', { role: 'owner' });
  await seedAccount('staff2', { role: 'staff' });
  const db = asUser('boss');
  await assertSucceeds(getDoc(doc(db, 'fz_accounts', 'staff2')));
});

test('未定義路徑一律被拒絕', async () => {
  await seedAccount('boss', { role: 'owner' });
  const db = asUser('boss');
  await assertFails(getDoc(doc(db, 'fz_unknown', 'x')));
  await assertFails(setDoc(doc(db, 'fz_unknown', 'x'), { a: 1 }));
  const anon = asAnon();
  await assertFails(getDoc(doc(anon, 'fz_unknown', 'x')));
  await assertFails(setDoc(doc(anon, 'fz_unknown', 'x'), { a: 1 }));
});
