// firebase-config.js
// Firebase 模組化 SDK (v10)，專案 my-to-do-list-9a809

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  getFirestore,
  collection, doc,
  setDoc, getDoc, getDocs,
  addDoc, updateDoc, deleteDoc,
  query, where, orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// ─── Firebase 設定 ───────────────────────────────────────────
// 預設值已填入 projectId / authDomain；apiKey 與 appId
// 請在「Firebase 設定」彈窗中填入後儲存，系統會存至 localStorage。
const DEFAULT_CONFIG = {
  apiKey:            "",                                       // 必填
  authDomain:        "my-to-do-list-9a809.firebaseapp.com",
  projectId:         "my-to-do-list-9a809",
  storageBucket:     "my-to-do-list-9a809.firebasestorage.app",
  messagingSenderId: "",                                       // 可選
  appId:             ""                                        // 可選
};

// ─── 本地設定讀寫 ─────────────────────────────────────────────
const CONFIG_KEY = "my_todo_fb_config";

export function getStoredConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.apiKey?.trim()) return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (_) {}
  return DEFAULT_CONFIG;
}

export function saveConfig(overrides) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...getStoredConfig(), ...overrides }));
  window.location.reload();
}

export function clearConfig() {
  localStorage.removeItem(CONFIG_KEY);
  window.location.reload();
}

// ─── 初始化 ───────────────────────────────────────────────────
const cfg = getStoredConfig();
const isReady = !!(cfg.apiKey && cfg.apiKey.length > 10);

let app = null, auth = null, db = null;

if (isReady) {
  try {
    app  = initializeApp(cfg);
    auth = getAuth(app);
    db   = getFirestore(app);
  } catch (e) {
    console.error("Firebase 初始化失敗：", e);
  }
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export {
  app, auth, db, googleProvider, isReady,
  // Auth helpers
  signInWithPopup, signOut, onAuthStateChanged,
  // Firestore helpers
  collection, doc,
  setDoc, getDoc, getDocs,
  addDoc, updateDoc, deleteDoc,
  query, where, orderBy,
  onSnapshot, serverTimestamp,
  arrayUnion, arrayRemove
};
