import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, getRedirectResult, signInWithPopup, signInWithRedirect,
  signInWithEmailAndPassword, GoogleAuthProvider, signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, collection, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

import {
  DEFAULT_PREP, DEFAULT_SLOTS, DEFAULT_PANTRY,
  normalizeEmail, isValidEmail, isValidRole, memberOf, accountToEmail,
} from './core.js';
import { DEFAULT_DISH_LIB } from './menu-lib.js';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD3quPJCOUoUH_Um5UceWXYuUXfRpJEuyo',
  authDomain: 'opencode-sk.firebaseapp.com',
  projectId: 'opencode-sk',
  appId: '1:741268730945:web:503cf0dfab0e9100b042c0',
};

const MEMBERS = 'fz_users';
const DAY_PREFIX = 'fz_days';
const CONFIG_DOC = 'fz_config/app';
const PANTRY_DOC = 'fz_pantry/pantry';

let app = null;
let auth = null;
let store = null;
let provider = null;
let sessionCb = null;
let currentSession = null;

function myEmail() {
  return (currentSession && currentSession.email) || '';
}

async function readSession(user) {
  if (!user) return null;
  const email = normalizeEmail(user.email);
  if (!isValidEmail(email)) return { uid: user.uid, email: '', role: null };
  const snap = await getDoc(doc(store, MEMBERS, email));
  const member = snap.exists() ? memberOf(email, snap.data()) : null;
  return { uid: user.uid, email, role: member ? member.role : null };
}

export function initFirebase() {
  if (app) return;
  app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  store = getFirestore(app);
  provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  getRedirectResult(auth).catch(() => {});
  onAuthStateChanged(auth, async (user) => {
    try {
      currentSession = await readSession(user);
    } catch (e) {
      currentSession = null;
      await signOut(auth).catch(() => {});
    }
    if (sessionCb) sessionCb(currentSession);
  });
}

export function onSession(cb) { sessionCb = cb; }
export function getSession() { return currentSession; }

export async function signInWithGoogle() {
  initFirebase();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e && e.code) || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw e;
  }
}

export async function logout() {
  await signOut(auth);
}

export async function signInWithAccount(rawAccount, password) {
  initFirebase();
  const email = accountToEmail(rawAccount);
  if (!email) throw new Error('帳號格式不正確');
  if (!password) throw new Error('請輸入密碼');
  await signInWithEmailAndPassword(auth, email, password);
}

export async function listMembers() {
  const snap = await getDocs(collection(store, MEMBERS));
  const rows = [];
  snap.forEach((d) => {
    const m = memberOf(d.id, d.data());
    if (m) rows.push(m);
  });
  rows.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
    return a.email.localeCompare(b.email);
  });
  return rows;
}

export async function addMember(rawEmail, role) {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) throw new Error('請輸入完整的 Email');
  if (!isValidRole(role)) throw new Error('角色不正確');
  await setDoc(doc(store, MEMBERS, email), {
    role,
    addedAt: serverTimestamp(),
    addedBy: myEmail(),
  });
  return email;
}

export async function setMemberRole(rawEmail, role) {
  const email = normalizeEmail(rawEmail);
  if (!isValidRole(role)) throw new Error('角色不正確');
  await updateDoc(doc(store, MEMBERS, email), { role, addedBy: myEmail() });
}

export async function removeMember(rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new Error('Email 不正確');
  if (email === myEmail()) throw new Error('不能刪除自己');
  await deleteDoc(doc(store, MEMBERS, email));
}

const emptyHead = () => ({ rooms: 0, adult: 0, child: 0, infant: 0 });
const emptyTargetDishes = () => ({
  meat: [], veg: [], egg: [], side: [], fry: [], braise: [], fruit: [], dessert: [],
});

export function emptyDay(date) {
  return {
    date,
    head: { b1: emptyHead(), b2: emptyHead() },
    dishes: { b1: emptyTargetDishes(), b2: emptyTargetDishes(), all: emptyTargetDishes() },
    extra: { b1: [], b2: [], all: [] },
    prep: {
      rice: { extra: 0 }, porridge: { extra: 0 }, egg: { extra: 0 },
      custom: [],
      done: { rice: false, porridge: false, egg: false },
    },
    drinks: {},
    updatedAt: null, updatedBy: null,
  };
}

export function emptyConfig() {
  return {
    dishLib: JSON.parse(JSON.stringify(DEFAULT_DISH_LIB)),
    prep: { ...DEFAULT_PREP },
    slots: DEFAULT_SLOTS.map(s => ({ ...s })),
    updatedAt: null, updatedBy: null,
  };
}

export async function loadDay(date) {
  const snap = await getDoc(doc(store, DAY_PREFIX, date));
  const base = emptyDay(date);
  if (!snap.exists()) return base;
  const data = snap.data() || {};
  return {
    ...base, ...data,
    head: { b1: { ...emptyHead(), ...(data.head && data.head.b1) }, b2: { ...emptyHead(), ...(data.head && data.head.b2) } },
    prep: {
      ...base.prep, ...(data.prep || {}),
      done: { ...base.prep.done, ...((data.prep && data.prep.done) || {}) },
    },
    drinks: data.drinks || {},
  };
}

export async function saveDay(date, patch) {
  await setDoc(doc(store, DAY_PREFIX, date), patch, { merge: true });
}

export async function loadConfig() {
  const snap = await getDoc(doc(store, ...CONFIG_DOC.split('/')));
  const base = emptyConfig();
  if (!snap.exists()) return base;
  const data = snap.data() || {};
  return {
    ...base, ...data,
    prep: { ...base.prep, ...(data.prep || {}) },
    slots: Array.isArray(data.slots) && data.slots.length ? data.slots : base.slots,
  };
}

export async function saveConfig(patch) {
  await setDoc(doc(store, ...CONFIG_DOC.split('/')), patch, { merge: true });
}

export async function loadPantry() {
  const snap = await getDoc(doc(store, ...PANTRY_DOC.split('/')));
  const data = snap.exists() ? snap.data() : null;
  if (Array.isArray(data && data.items) && data.items.length) return data.items;
  return DEFAULT_PANTRY.map(p => ({ ...p }));
}

export async function savePantry(items) {
  await setDoc(doc(store, ...PANTRY_DOC.split('/')), { items }, { merge: true });
}

export class Debouncer {
  constructor(fn, delay = 800) {
    this.fn = fn;
    this.delay = delay;
    this.timer = null;
    this.pending = null;
  }
  call(payload) {
    this.pending = payload;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delay);
  }
  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.pending === null) return Promise.resolve();
    const payload = this.pending;
    this.pending = null;
    return Promise.resolve(this.fn(payload));
  }
}
