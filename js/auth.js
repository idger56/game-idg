// ============================================================
//  auth.js — вся логика авторизации и онлайн-статуса
// ============================================================
import { auth, db, ADMIN_EMAIL } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";
import {
  doc, setDoc, updateDoc, getDoc, getDocs,
  collection, query, where
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

// ---------- Статус онлайн ----------
let _lastSeenTimer = null;
let _statusTimer   = null;

export async function setOnline(uid) {
  if (!uid) return;
  try {
    await updateDoc(doc(db, "users", uid), { status: "online", lastSeen: Date.now() });
  } catch (e) { console.warn("setOnline:", e); }
}

export async function setOffline(uid) {
  if (!uid) return;
  try {
    await updateDoc(doc(db, "users", uid), { status: "offline", lastSeen: Date.now() });
  } catch (e) { console.warn("setOffline:", e); }
}

export function startPresence(uid) {
  stopPresence();
  setOnline(uid);
  _lastSeenTimer = setInterval(() => setOnline(uid), 30_000);

  window.addEventListener("beforeunload",   () => setOffline(uid));
  document.addEventListener("visibilitychange", () => {
    document.visibilityState === "hidden" ? setOffline(uid) : setOnline(uid);
  });
}

export function stopPresence() {
  if (_lastSeenTimer) { clearInterval(_lastSeenTimer); _lastSeenTimer = null; }
  if (_statusTimer)   { clearInterval(_statusTimer);   _statusTimer   = null; }
}

// ---------- Регистрация ----------
export async function register(email, password, nickname) {
  // Проверка уникальности ника
  const snap = await getDocs(query(collection(db, "users"), where("nickname", "==", nickname)));
  if (!snap.empty) throw new Error("Этот ник уже занят. Выберите другой.");

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    email: cred.user.email,
    nickname,
    avatar:        "https://cdn-images.dzcdn.net/images/cover/8b685b46bec333da34a4f17c7a3e4fc9/1900x1900-000000-80-0-0.jpg",
    quote:         "",
    favoriteGenre: "",
    status:        "offline",
    lastSeen:      Date.now(),
  });
  await signOut(auth);
  return "Регистрация успешна! Теперь войдите.";
}

// ---------- Вход ----------
export async function login(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

// ---------- Выход ----------
export async function logout(uid) {
  stopPresence();
  if (uid) await setOffline(uid);
  await signOut(auth);
}

// ---------- Обёртка onAuthStateChanged с коллбэками ----------
export function watchAuth({ onLogin, onLogout }) {
  return onAuthStateChanged(auth, async user => {
    if (user) {
      startPresence(user.uid);
      const snap = await getDoc(doc(db, "users", user.uid));
      const userData = snap.exists() ? snap.data() : {};
      onLogin(user, userData);
    } else {
      stopPresence();
      onLogout?.();
    }
  });
}

export { auth, ADMIN_EMAIL };
