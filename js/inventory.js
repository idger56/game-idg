// ============================================================
//  inventory.js — инвентарь: добавление, продажа, витрина
// ============================================================
import { db, auth } from "./firebase.js";
import { RARITY_SELL_PRICE, CONTRACT_COUNT, nextRarity, rollRarity, RARITY_ORDER } from "./items.js";
import { adjustBalance } from "./economy.js";
import {
  collection, doc, addDoc, getDoc, getDocs, deleteDoc,
  updateDoc, query, where, writeBatch
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

// ── Добавить предмет в инвентарь пользователя ─────────────
export async function addItemToInventory(uid, item) {
  // item: { id, name, type, rarity, image, caseId? }
  const ref = await addDoc(collection(db, "inventory"), {
    uid,
    itemId:    item.id,
    name:      item.name,
    type:      item.type,
    rarity:    item.rarity,
    image:     item.image,
    caseId:    item.caseId || "",
    obtainedAt: Date.now(),
    onShowcase: false,
    listedPrice: null,   // если выставлен на рынок
  });
  return ref.id;
}

// ── Получить инвентарь пользователя ──────────────────────
export async function getUserInventory(uid) {
  const snap = await getDocs(query(collection(db, "inventory"), where("uid", "==", uid)));
  return snap.docs.map(d => ({ invId: d.id, ...d.data() }));
}

// ── Продать предмет ───────────────────────────────────────
export async function sellItem(uid, invId) {
  const ref  = doc(db, "inventory", invId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().uid !== uid) throw new Error("Предмет не найден");
  const { rarity, onShowcase, listedPrice } = snap.data();
  if (onShowcase) throw new Error("Снимите предмет с витрины перед продажей");
  if (listedPrice) throw new Error("Снимите предмет с рынка перед продажей");

  const price = RARITY_SELL_PRICE[rarity] || 5;
  await deleteDoc(ref);
  await adjustBalance(uid, price, `sell_item_${invId}`);
  return price;
}

// ── Витрина профиля: максимум 5 слотов ────────────────────
export async function setShowcase(uid, invId, show) {
  const ref  = doc(db, "inventory", invId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().uid !== uid) throw new Error("Предмет не найден");

  if (show) {
    // Проверяем лимит
    const showcaseSnap = await getDocs(query(
      collection(db, "inventory"),
      where("uid", "==", uid),
      where("onShowcase", "==", true)
    ));
    if (showcaseSnap.size >= 5) throw new Error("Витрина заполнена (максимум 5 предметов)");
  }

  await updateDoc(ref, { onShowcase: show });
}

// ── Получить витрину ──────────────────────────────────────
export async function getShowcase(uid) {
  const snap = await getDocs(query(
    collection(db, "inventory"),
    where("uid", "==", uid),
    where("onShowcase", "==", true)
  ));
  return snap.docs.map(d => ({ invId: d.id, ...d.data() }));
}

// ── Контракт: 5 предметов одной редкости → 1 выше ─────────
export async function makeContract(uid, invIds) {
  if (invIds.length !== CONTRACT_COUNT) throw new Error(`Нужно ровно ${CONTRACT_COUNT} предметов`);

  // Загружаем предметы
  const items = await Promise.all(invIds.map(id => getDoc(doc(db, "inventory", id))));
  const datas = items.map(s => {
    if (!s.exists() || s.data().uid !== uid) throw new Error("Предмет не найден");
    return s.data();
  });

  // Все одной редкости?
  const rarities = [...new Set(datas.map(d => d.rarity))];
  if (rarities.length !== 1) throw new Error("Все предметы должны быть одной редкости");

  const currentRarity = rarities[0];
  const upgraded = nextRarity(currentRarity);
  if (!upgraded) throw new Error("Нельзя улучшить Эксклюзив — это максимум");

  // Получить все предметы нужной редкости из каталога
  const catalogSnap = await getDocs(query(
    collection(db, "catalogItems"),
    where("rarity", "==", upgraded)
  ));
  if (catalogSnap.empty) throw new Error("Нет предметов нужной редкости в каталоге");
  const pool = catalogSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const reward = pool[Math.floor(Math.random() * pool.length)];

  // Транзакция: удалить 5, добавить 1
  const batch = writeBatch(db);
  for (const invId of invIds) {
    batch.delete(doc(db, "inventory", invId));
  }
  await batch.commit();

  const newInvId = await addItemToInventory(uid, reward);
  return { item: reward, invId: newInvId };
}
