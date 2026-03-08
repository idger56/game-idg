// ============================================================
//  market.js — рынок: выставление, покупка, обмены
// ============================================================
import { db, auth } from "./firebase.js";
import { adjustBalance, getBalance } from "./economy.js";
import { addItemToInventory } from "./inventory.js";
import {
  collection, doc, addDoc, getDoc, getDocs, deleteDoc,
  updateDoc, query, where, writeBatch, orderBy
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

// ── Выставить предмет на продажу ─────────────────────────
export async function listItem(uid, invId, price) {
  if (!Number.isFinite(price) || price < 1) throw new Error("Некорректная цена");

  const invRef  = doc(db, "inventory", invId);
  const invSnap = await getDoc(invRef);
  if (!invSnap.exists() || invSnap.data().uid !== uid) throw new Error("Предмет не найден");
  if (invSnap.data().onShowcase)  throw new Error("Снимите с витрины перед продажей");
  if (invSnap.data().listedPrice) throw new Error("Предмет уже на рынке");

  const d = invSnap.data();
  const listing = await addDoc(collection(db, "market"), {
    sellerUid:    uid,
    invId,
    itemId:       d.itemId       || "",
    name:         d.name         || "",
    type:         d.type         || "",
    rarity:       d.rarity       || "common",
    cssEffect:    d.cssEffect    || "",
    previewColor: d.previewColor || "",
    isAnimated:   d.isAnimated   || false,
    price,
    createdAt:    Date.now(),
    status:       "active",
  });

  await updateDoc(invRef, { listedPrice: price, listingId: listing.id });
  return listing.id;
}

// ── Снять с продажи ───────────────────────────────────────
export async function unlistItem(uid, listingId) {
  const ref  = doc(db, "market", listingId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().sellerUid !== uid) throw new Error("Лот не найден");

  const invRef = doc(db, "inventory", snap.data().invId);
  await updateDoc(invRef, { listedPrice: null, listingId: null });
  await deleteDoc(ref);
}

// ── Купить предмет ────────────────────────────────────────
export async function buyItem(buyerUid, listingId) {
  const ref  = doc(db, "market", listingId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().status !== "active") throw new Error("Лот недоступен");

  const { sellerUid, invId, price, name, type, rarity, cssEffect, previewColor, isAnimated, itemId } = snap.data();
  if (sellerUid === buyerUid) throw new Error("Нельзя купить свой предмет");

  const balance = await getBalance(buyerUid);
  if (balance < price) throw new Error(`Недостаточно 💎 (нужно ${price} PS)`);

  await adjustBalance(buyerUid, -price, `buy_market_${listingId}`);
  const sellerReceives = Math.floor(price * 0.95);
  await adjustBalance(sellerUid, sellerReceives, `sell_market_${listingId}`);

  // Переносим предмет покупателю
  await deleteDoc(doc(db, "inventory", invId));
  const newInvId = await addItemToInventory(buyerUid, {
    id: itemId, name, type, rarity,
    cssEffect:    cssEffect    || "",
    previewColor: previewColor || "",
    isAnimated:   isAnimated   || false,
  });

  await updateDoc(ref, { status: "sold", buyerUid, soldAt: Date.now() });
  return { item: { name, rarity, cssEffect, type }, newInvId };
}

// ── Получить активные лоты ────────────────────────────────
export async function getActiveListings() {
  const snap = await getDocs(query(
    collection(db, "market"),
    where("status", "==", "active"),
    orderBy("createdAt", "desc")
  ));
  return snap.docs.map(d => ({ listingId: d.id, ...d.data() }));
}

// ════════════════════════════════════════════
//  ОБМЕНЫ
// ════════════════════════════════════════════

export async function sendTradeOffer(fromUid, toUid, offeredInvId, wantedInvId) {
  const offSnap  = await getDoc(doc(db, "inventory", offeredInvId));
  if (!offSnap.exists() || offSnap.data().uid !== fromUid) throw new Error("Ваш предмет не найден");

  const wantSnap = await getDoc(doc(db, "inventory", wantedInvId));
  if (!wantSnap.exists() || wantSnap.data().uid !== toUid) throw new Error("Запрашиваемый предмет не найден");

  const off  = offSnap.data();
  const want = wantSnap.data();

  const ref = await addDoc(collection(db, "trades"), {
    fromUid, toUid,
    offeredInvId,
    offeredItem: {
      name:         off.name         || "",
      rarity:       off.rarity       || "common",
      cssEffect:    off.cssEffect    || "",
      previewColor: off.previewColor || "",
      type:         off.type         || "",
    },
    wantedInvId,
    wantedItem: {
      name:         want.name         || "",
      rarity:       want.rarity       || "common",
      cssEffect:    want.cssEffect    || "",
      previewColor: want.previewColor || "",
      type:         want.type         || "",
    },
    status:    "pending",
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function acceptTrade(toUid, tradeId) {
  const ref  = doc(db, "trades", tradeId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().toUid !== toUid) throw new Error("Обмен не найден");
  if (snap.data().status !== "pending") throw new Error("Обмен уже обработан");

  const { fromUid, offeredInvId, wantedInvId } = snap.data();
  await updateDoc(doc(db, "inventory", offeredInvId), { uid: toUid,   onShowcase: false, listedPrice: null, equipped: false });
  await updateDoc(doc(db, "inventory", wantedInvId),  { uid: fromUid, onShowcase: false, listedPrice: null, equipped: false });
  await updateDoc(ref, { status: "accepted", resolvedAt: Date.now() });
}

export async function declineTrade(uid, tradeId) {
  const ref  = doc(db, "trades", tradeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Обмен не найден");
  if (snap.data().toUid !== uid && snap.data().fromUid !== uid) throw new Error("Нет доступа");
  await updateDoc(ref, { status: "declined", resolvedAt: Date.now() });
}

export async function getTradesForUser(uid) {
  const [inSnap, outSnap] = await Promise.all([
    getDocs(query(collection(db, "trades"), where("toUid",   "==", uid), where("status", "==", "pending"))),
    getDocs(query(collection(db, "trades"), where("fromUid", "==", uid), where("status", "==", "pending"))),
  ]);
  const incoming = inSnap.docs.map(d => ({ tradeId: d.id, ...d.data(), dir: "incoming" }));
  const outgoing = outSnap.docs.map(d => ({ tradeId: d.id, ...d.data(), dir: "outgoing" }));
  return [...incoming, ...outgoing];
}
