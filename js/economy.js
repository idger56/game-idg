// ============================================================
//  economy.js — баланс, начисления, ежедневный бонус
// ============================================================
import { db, auth } from "./firebase.js";
import { CURRENCY, EARN_REWARDS } from "./items.js";
import {
  doc, getDoc, updateDoc, increment, setDoc,
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

// ── Получить баланс пользователя ──────────────────────────
export async function getBalance(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return 0;
  const b = snap.data().balance;
  return typeof b === "number" ? b : CURRENCY.start;
}

// ── Изменить баланс (delta может быть отрицательным) ─────
export async function adjustBalance(uid, delta, reason = "") {
  const ref  = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const current = typeof snap.data().balance === "number"
    ? snap.data().balance
    : CURRENCY.start;

  const newBal = Math.max(0, current + delta);
  await updateDoc(ref, { balance: newBal });

  // Лог транзакций
  await addDoc(collection(db, "transactions"), {
    uid, delta, reason,
    balance: newBal,
    createdAt: Date.now(),
  });

  return newBal;
}

// ── Инициализировать баланс при первом входе ──────────────
export async function ensureBalance(uid) {
  const ref  = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (typeof snap.data().balance !== "number") {
    await updateDoc(ref, { balance: CURRENCY.start });
  }
}

// ── Ежедневный бонус ──────────────────────────────────────
export async function claimDailyBonus(uid) {
  const ref  = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: false, msg: "Пользователь не найден" };

  const last = snap.data().lastDailyBonus || 0;
  const now  = Date.now();
  const DAY  = 86_400_000;

  if (now - last < DAY) {
    const remaining = DAY - (now - last);
    const hrs  = Math.floor(remaining / 3600_000);
    const mins = Math.floor((remaining % 3600_000) / 60_000);
    return { ok: false, msg: `Следующий бонус через ${hrs}ч ${mins}мин` };
  }

  await updateDoc(ref, { lastDailyBonus: now });
  const newBal = await adjustBalance(uid, EARN_REWARDS.daily, "daily_bonus");
  return { ok: true, amount: EARN_REWARDS.daily, balance: newBal };
}

// ── Награда за оценку/комментарий ────────────────────────
export async function rewardAction(uid, type) {
  const amount = EARN_REWARDS[type];
  if (!amount || !uid) return;
  return await adjustBalance(uid, amount, type);
}

// ── Награда за медаль ─────────────────────────────────────
export async function rewardMedal(uid, level) {
  const key    = `medal_${level}`;
  const amount = EARN_REWARDS[key];
  if (!amount || !uid) return;
  return await adjustBalance(uid, amount, key);
}

// ── Пополнение от администратора ─────────────────────────
export async function adminTopUp(targetUid, amount) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Некорректная сумма");
  return await adjustBalance(targetUid, amount, "admin_topup");
}
