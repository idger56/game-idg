// ============================================================
//  auth.js — авторизация и онлайн-статус (работает на всех страницах)
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

// ---------- Присутствие ----------
let _presenceTimer = null;
let _presenceUid   = null;

/** Обновить lastSeen и статус = online */
async function _ping(uid) {
  if (!uid) return;
  try {
    await updateDoc(doc(db, "users", uid), {
      status:   "online",
      lastSeen: Date.now(),
    });
  } catch (e) {
    // Игнорируем — пользователь мог выйти
  }
}

/** Поставить статус offline */
async function _goOffline(uid) {
  if (!uid) return;
  try {
    await updateDoc(doc(db, "users", uid), {
      status:   "offline",
      lastSeen: Date.now(),
    });
  } catch (e) { /* ignore */ }
}

/** Запустить периодические пинги (каждые 30 сек).
 *  Вызывается автоматически в onAuthStateChanged — не нужно вызывать вручную. */
function _startPresence(uid) {
  _stopPresence();
  _presenceUid = uid;

  // Сразу пингуем
  _ping(uid);

  // Пинг каждые 30 секунд
  _presenceTimer = setInterval(() => _ping(uid), 30_000);

  // Вкладка/окно закрылись
  window.addEventListener("beforeunload", _handleUnload);

  // Вкладка скрыта/показана
  document.addEventListener("visibilitychange", _handleVisibility);
}

function _stopPresence() {
  if (_presenceTimer) {
    clearInterval(_presenceTimer);
    _presenceTimer = null;
  }
  window.removeEventListener("beforeunload", _handleUnload);
  document.removeEventListener("visibilitychange", _handleVisibility);
}

function _handleUnload() {
  // Используем sendBeacon чтобы запрос успел уйти при закрытии
  // Но Firestore не поддерживает sendBeacon — делаем синхронный вызов
  if (_presenceUid) _goOffline(_presenceUid);
}

function _handleVisibility() {
  if (!_presenceUid) return;
  if (document.visibilityState === "hidden") {
    _goOffline(_presenceUid);
  } else {
    _ping(_presenceUid);
  }
}

// ---------- Экспортируемые функции ----------

export async function setOnline(uid)  { await _ping(uid); }
export async function setOffline(uid) { await _goOffline(uid); }

export function startPresence(uid) { _startPresence(uid); }
export function stopPresence()     { _stopPresence(); }

// ---------- Регистрация ----------
export async function register(email, password, nickname) {
  if (!email || !password || !nickname) throw new Error("Заполните все поля");

  // Проверка уникальности ника
  const snap = await getDocs(query(collection(db, "users"), where("nickname", "==", nickname)));
  if (!snap.empty) throw new Error("Этот ник уже занят. Выберите другой.");

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", cred.user.uid), {
    uid:           cred.user.uid,
    email:         cred.user.email,
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
  if (!email || !password) throw new Error("Введите email и пароль");
  await signInWithEmailAndPassword(auth, email, password);
}

// ---------- Выход ----------
export async function logout(uid) {
  _stopPresence();
  if (uid) await _goOffline(uid);
  await signOut(auth);
}

// ---------- Главный подписчик ----------
/**
 * Вызывать на каждой странице.
 * Автоматически:
 *  - запускает/останавливает пинги присутствия
 *  - вызывает onLogin(user, userData) / onLogout()
 */
export function watchAuth({ onLogin, onLogout } = {}) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Запускаем присутствие сразу — работает на ЛЮБОЙ странице
      _startPresence(user.uid);

      // Инициализируем баланс если не был создан
      try {
        const { ensureBalance } = await import("./economy.js");
        await ensureBalance(user.uid);
      } catch(_) {}

      // Получаем данные профиля
      const snap = await getDoc(doc(db, "users", user.uid));
      const userData = snap.exists() ? snap.data() : {};

      onLogin?.(user, userData);
    } else {
      _stopPresence();
      onLogout?.();
    }
  });
}

export { auth, ADMIN_EMAIL };
