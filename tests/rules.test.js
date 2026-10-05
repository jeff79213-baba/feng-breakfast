import { test, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let env;

const PROJECT = 'demo-fzbf';

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => { await env.cleanup(); });

const asUser = async (uid, claims) => env.authenticatedContext(uid, claims || {}).firestore();
const asAnon = () => env.unauthenticatedContext().firestore();

const seedAccount = async (uid, data) => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'fz_accounts', uid), {
      account: uid, role: 'staff', disabled: false, ...data,
    });
  });
};

test('匿名完全不能讀寫每日資料', async () => {
  const db = asAnon();
  await assertFails(getDoc(doc(db, 'fz_days', '2026-10-04')));
  await assertFails(setDoc(doc(db, 'fz_days', '2026-10-04'), { b1: {} }));
});

test('未註冊的登入者（無 fz_accounts 文件）不能讀每日資料', async () => {
  const db = await asUser('ghost');
  await assertFails(getDoc(doc(db, 'fz_days', '2026-10-04')));
});

test('停用帳號不能讀每日資料', async () => {
  await seedAccount('off', { disabled: true });
  const db = await asUser('off');
  await assertFails(getDoc(doc(db, 'fz_days', '2026-10-04')));
});

test('active 員工可讀寫自己的館別資料', async () => {
  await seedAccount('staff1', { role: 'staff' });
  const db = await asUser('staff1');
  await assertSucceeds(setDoc(doc(db, 'fz_days', '2026-10-04'), {
    b1: { rooms: 10, adult: 20, child: 5, infant: 2, dishes: {}, extra: {} },
  }));
  await assertSucceeds(getDoc(doc(db, 'fz_days', '2026-10-04')));
});

test('員工不能寫入 fz_accounts', async () => {
  await seedAccount('staff1', { role: 'staff' });
  const db = await asUser('staff1');
  await assertFails(setDoc(doc(db, 'fz_accounts', 'hacker'), { role: 'owner' }));
});

test('員工不能讀別人的 fz_accounts，但可讀自己的', async () => {
  await seedAccount('staff1', { role: 'staff' });
  await seedAccount('staff2', { role: 'staff' });
  const db = await asUser('staff1');
  await assertSucceeds(getDoc(doc(db, 'fz_accounts', 'staff1')));
  await assertFails(getDoc(doc(db, 'fz_accounts', 'staff2')));
});

test('員工不可改備料係數，但可加菜色庫', async () => {
  await seedAccount('staff1', { role: 'staff' });
  const db = await asUser('staff1');
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'fz_config', 'app'), {
      dishLib: { meat: ['滷豬耳'] }, prep: { riceAdult: 0.2 }, updatedAt: null,
    });
  });
  await assertSucceeds(updateDoc(doc(db, 'fz_config', 'app'), {
    dishLib: { meat: ['滷豬耳', '控肉'] }, updatedBy: 'staff1',
  }));
  await assertFails(updateDoc(doc(db, 'fz_config', 'app'), { prep: { riceAdult: 0.9 } }));
});

test('owner 可改備料係數', async () => {
  await seedAccount('boss', { role: 'owner' });
  const db = await asUser('boss');
  await assertSucceeds(updateDoc(doc(db, 'fz_config', 'app'), {
    prep: { riceAdult: 0.25 }, updatedBy: 'boss',
  }));
});

test('owner 可讀所有 fz_accounts', async () => {
  await seedAccount('boss', { role: 'owner' });
  await seedAccount('staff2', { role: 'staff' });
  const db = await asUser('boss');
  await assertSucceeds(getDoc(doc(db, 'fz_accounts', 'staff2')));
});