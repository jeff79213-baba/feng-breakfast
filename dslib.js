import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithCustomToken, signOut, getIdToken,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

import { DEFAULT_PREP, DEFAULT_SLOTS, DEFAULT_PANTRY } from './core.js';
import { DEFAULT_DISH_LIB } from './menu-lib.js';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD3quPJCOUoUH_Um5UceWXYuUXfRpJEuyo',
  authDomain: 'opencode-sk.firebaseapp.com',
  projectId: 'opencode-sk',
  appId: '1:741268730945:web:503cf0dfab0e9100b042c0',
};

const DAY_PREFIX = 'fz_days';
const CONFIG_DOC = 'fz_config/app';
const PANTRY_DOC = 'fz_pantry/pantry';

let app = null;
let auth = null;
let store = null;
let sessionCb = null;
let currentSession = null;

export function initFirebase() {
  if (app) return;
  app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  store = getFirestore(app);
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      currentSession = null;
      if (sessionCb) sessionCb(null);
      return;
    }
    try {
      const me = await apiFetch('/api/fz/me');
      currentSession = { uid: user.uid, account: me.account, role: me.role };
    } catch (e) {
      await signOut(auth);
      currentSession = null;
    }
    if (sessionCb) sessionCb(currentSession);
  });
}

export function onSession(cb) { sessionCb = cb; }
export function getSession() { return currentSession; }

export async function apiFetch(path, options = {}) {
  const headers = Object.assign({}, options.headers);
  const user = auth && auth.currentUser;
  if (user) headers.Authorization = 'Bearer ' + await getIdToken(user);
  const res = await fetch(path, Object.assign({}, options, { headers }));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || ('HTTP ' + res.status));
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function login(account, password) {
  const res = await apiFetch('/api/fz/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password }),
  });
  await signInWithCustomToken(auth, res.customToken);
  return { uid: res.uid, role: res.role, account: res.account };
}

export async function logout() {
  await signOut(auth);
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
    prep: { ...base.prep, ...(data.prep || {}) },
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
