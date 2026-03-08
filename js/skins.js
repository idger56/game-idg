// ============================================================
//  skins.js — применение скинов (рамки, фоны, карточки)
//             + сидирование каталога по умолчанию
// ============================================================
import { db } from "./firebase.js";
import { DEFAULT_ITEMS, SKIN_CSS } from "./items.js";
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, query, where
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

// ── Вставить CSS анимаций на страницу ─────────────────────
export function injectSkinCSS() {
  if (document.getElementById("skin-css")) return;
  const style = document.createElement("style");
  style.id = "skin-css";
  style.textContent = SKIN_CSS;
  document.head.appendChild(style);
}

// ── Получить активные скины пользователя ──────────────────
export async function getUserActiveSkins(uid) {
  const snap = await getDocs(query(
    collection(db, "inventory"),
    where("uid", "==", uid),
    where("equipped", "==", true)
  ));
  const result = { avatar_frame: null, profile_bg: null, card_skin: null };
  for (const d of snap.docs) {
    const item = d.data();
    if (item.type in result) result[item.type] = { invId: d.id, ...item };
  }
  return result;
}

// ── Надеть/снять скин ────────────────────────────────────
export async function equipItem(uid, invId, equip = true) {
  const ref  = doc(db, "inventory", invId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().uid !== uid) throw new Error("Предмет не найден");
  const { type } = snap.data();

  if (equip) {
    // Снять текущий оснащённый предмет того же типа
    const currentSnap = await getDocs(query(
      collection(db, "inventory"),
      where("uid",       "==", uid),
      where("type",      "==", type),
      where("equipped",  "==", true)
    ));
    for (const d of currentSnap.docs) {
      if (d.id !== invId) await updateDoc(doc(db,"inventory",d.id), { equipped: false });
    }
  }

  await updateDoc(ref, { equipped: equip });
}

// ── Применить рамку аватара к <img> ──────────────────────
export function applyAvatarFrame(imgEl, frameItem) {
  if (!imgEl) return;
  if (!frameItem) {
    imgEl.style.cssText = "";
    return;
  }
  imgEl.style.cssText = frameItem.cssEffect || "";
}

// ── Применить фон профиля к контейнеру ───────────────────
export function applyProfileBg(containerEl, bgItem) {
  if (!containerEl) return;
  if (!bgItem) {
    containerEl.style.cssText = "";
    return;
  }
  containerEl.style.cssText = bgItem.cssEffect || "";
}

// ── Применить скин к карточке игры ───────────────────────
export function applyCardSkin(cardEl, skinItem) {
  if (!cardEl) return;
  if (!skinItem) {
    cardEl.style.border = "";
    cardEl.style.boxShadow = "";
    cardEl.style.animation = "";
    return;
  }
  // Парсим cssEffect и применяем только нужные свойства
  const dummy = document.createElement("div");
  dummy.style.cssText = skinItem.cssEffect || "";
  if (dummy.style.border)     cardEl.style.border     = dummy.style.border;
  if (dummy.style.boxShadow)  cardEl.style.boxShadow  = dummy.style.boxShadow;
  if (dummy.style.animation)  cardEl.style.animation  = dummy.style.animation;
}

// ════════════════════════════════════════════════════════════
//  СИДИРОВАНИЕ — заполнение каталога предметов по умолчанию
//  Вызывается из Admin-панели кнопкой "Загрузить предметы"
// ════════════════════════════════════════════════════════════
export async function seedDefaultItems() {
  let added = 0, skipped = 0;
  for (const item of DEFAULT_ITEMS) {
    const ref  = doc(db, "catalogItems", item.id);
    const snap = await getDoc(ref);
    if (snap.exists()) { skipped++; continue; }
    await setDoc(ref, {
      name:        item.name,
      type:        item.type,
      rarity:      item.rarity,
      cssEffect:   item.cssEffect,
      previewColor:item.previewColor || "",
      isAnimated:  item.isAnimated || false,
      caseId:      "",            // не привязан к кейсу — общий каталог
      createdAt:   Date.now(),
    });
    added++;
  }
  return { added, skipped };
}

// ── Редактировать предмет каталога (для Admin-панели) ─────
export async function updateCatalogItem(itemId, fields) {
  const allowed = ["name","type","rarity","cssEffect","previewColor","isAnimated","caseId","description"];
  const update  = Object.fromEntries(
    Object.entries(fields).filter(([k]) => allowed.includes(k))
  );
  await updateDoc(doc(db, "catalogItems", itemId), update);
}

// ── Получить все предметы каталога ────────────────────────
export async function getAllCatalogItems() {
  const snap = await getDocs(collection(db, "catalogItems"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
