// ============================================================
//  cases.js — страница кейсов: открытие, рулетка, управление
// ============================================================
import { db, auth, ADMIN_EMAIL } from "./firebase.js";
import { watchAuth } from "./auth.js";
import { renderHeader, toast } from "./ui.js";
import { esc } from "./utils.js";
import { RARITIES, RARITY_ORDER, rollRarity, CURRENCY } from "./items.js";
import { getBalance, adjustBalance } from "./economy.js";
import { addItemToInventory } from "./inventory.js";
import {
  collection, doc, addDoc, getDoc, getDocs, deleteDoc,
  updateDoc, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

renderHeader({ activePage: "cases" });

const $ = id => document.getElementById(id);
let currentUser = null;
let allCases    = [];
let catalogItems = [];

watchAuth({
  onLogin: async (user) => {
    currentUser = user;
    $("cases-auth").classList.add("hidden");
    $("cases-main").classList.remove("hidden");
    if (user.email === ADMIN_EMAIL) {
      $("cases-admin-bar").classList.remove("hidden");
    }
    await loadAll();
    await updateBalanceDisplay();
  },
  onLogout: () => {
    currentUser = null;
    $("cases-auth").classList.remove("hidden");
    $("cases-main").classList.add("hidden");
  }
});

async function updateBalanceDisplay() {
  if (!currentUser) return;
  const bal = await getBalance(currentUser.uid);
  const el = $("balance-display");
  if (el) el.textContent = `${CURRENCY.icon} ${bal} ${CURRENCY.short}`;
}

// ── Загрузка ─────────────────────────────────────────────
async function loadAll() {
  const [casesSnap, itemsSnap] = await Promise.all([
    getDocs(collection(db, "cases")),
    getDocs(collection(db, "catalogItems")),
  ]);
  allCases     = casesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  catalogItems = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderCases();
}

// ── Рендер списка кейсов ──────────────────────────────────
function renderCases() {
  const grid = $("cases-grid");
  if (!allCases.length) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">📦</div><p>Кейсов пока нет</p></div>`;
    return;
  }
  grid.innerHTML = "";
  for (const c of allCases) {
    const items = catalogItems.filter(i => i.caseId === c.id);
    const card  = document.createElement("div");
    card.className = "case-card";
    card.innerHTML = `
      <div class="case-img-wrap">
        <img src="${esc(c.image)}" alt="${esc(c.name)}"
             onerror="this.src='https://placehold.co/240x180/1c2030/4f8ef7?text=📦'">
        <div class="case-rarity-strip">
          ${RARITY_ORDER.map(r => {
            const cnt = items.filter(i => i.rarity === r).length;
            return cnt ? `<span class="rarity-dot" style="background:${RARITIES[r].color}" title="${RARITIES[r].label}: ${cnt} шт"></span>` : "";
          }).join("")}
        </div>
      </div>
      <div class="case-body">
        <h3>${esc(c.name)}</h3>
        <p class="case-desc">${esc(c.description || "")}</p>
        <div class="case-meta">
          <span class="case-items-count">${items.length} предметов</span>
          <span class="case-price">${CURRENCY.icon} ${c.price} ${CURRENCY.short}</span>
        </div>
        <button class="btn btn-primary case-open-btn" data-id="${c.id}">📦 Открыть кейс</button>
        <button class="btn btn-ghost case-preview-btn" data-id="${c.id}">👁 Содержимое</button>
      </div>`;
    card.querySelector(".case-open-btn").addEventListener("click", () => openCase(c));
    card.querySelector(".case-preview-btn").addEventListener("click", () => previewCase(c, items));
    grid.appendChild(card);
  }
}

// ── Превью содержимого кейса ──────────────────────────────
function previewCase(c, items) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";

  const byRarity = {};
  for (const r of RARITY_ORDER) {
    const group = items.filter(i => i.rarity === r);
    if (group.length) byRarity[r] = group;
  }

  overlay.innerHTML = `
    <div class="modal" style="max-width:640px">
      <button class="modal-close">✕</button>
      <div class="modal-body">
        <h2>📦 ${esc(c.name)}</h2>
        <div class="case-preview-grid">
          ${RARITY_ORDER.filter(r => byRarity[r]).map(r => `
            <div class="preview-group">
              <div class="preview-rarity-label" style="color:${RARITIES[r].color}">
                ${RARITIES[r].label}
                <span style="font-size:.75rem;opacity:.7">${RARITIES[r].weight}%</span>
              </div>
              <div class="preview-items">
                ${byRarity[r].map(item => `
                  <div class="preview-item" title="${esc(item.name)}">
                    <img src="${esc(item.image)}" alt="${esc(item.name)}"
                         onerror="this.src='https://placehold.co/64x64/1c2030/4f8ef7?text=?'">
                    <span>${esc(item.name)}</span>
                  </div>
                `).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>`;

  overlay.querySelector(".modal-close").onclick = () => overlay.remove();
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ── Открытие кейса + анимация рулетки ────────────────────
async function openCase(c) {
  if (!currentUser) { toast("Войдите в аккаунт", "error"); return; }

  const bal = await getBalance(currentUser.uid);
  if (bal < c.price) {
    toast(`Недостаточно ${CURRENCY.icon} (нужно ${c.price} PS)`, "error");
    return;
  }

  const items = catalogItems.filter(i => i.caseId === c.id);
  if (!items.length) { toast("Кейс пуст", "error"); return; }

  // Определяем выигрышный предмет
  const won = rollWinItem(items);
  if (!won) { toast("Ошибка определения предмета", "error"); return; }

  // Показать модалку рулетки
  showRouletteModal(c, items, won, async () => {
    // Колбэк после анимации
    await adjustBalance(currentUser.uid, -c.price, `open_case_${c.id}`);
    await addItemToInventory(currentUser.uid, { ...won, caseId: c.id });
    await updateBalanceDisplay();
    toast(`🎉 Выпало: ${won.name}!`, won.rarity === "exclusive" ? "success" : "info");
  });
}

function rollWinItem(items) {
  // Считаем веса по редкости
  const weightMap = {};
  for (const item of items) {
    const w = RARITIES[item.rarity]?.weight || 1;
    weightMap[item.rarity] = (weightMap[item.rarity] || 0) + w;
  }
  const wonRarity = rollRarity(weightMap);
  const pool = items.filter(i => i.rarity === wonRarity);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : items[0];
}

// ── Анимация рулетки ──────────────────────────────────────
function showRouletteModal(c, items, won, onComplete) {
  const overlay = document.createElement("div");
  overlay.className = "overlay roulette-overlay";

  overlay.innerHTML = `
    <div class="modal roulette-modal">
      <h2 style="text-align:center;margin-bottom:24px">📦 Открытие: ${esc(c.name)}</h2>
      <div class="roulette-wrap">
        <div class="roulette-arrow"></div>
        <div class="roulette-track-outer">
          <div class="roulette-track" id="roulette-track"></div>
        </div>
      </div>
      <div class="roulette-result hidden" id="roulette-result">
        <div class="roulette-result-glow" id="roulette-glow"></div>
        <img id="roulette-won-img" src="" alt="">
        <div class="roulette-won-name" id="roulette-won-name"></div>
        <div class="roulette-won-rarity" id="roulette-won-rarity"></div>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:20px">
          <button class="btn btn-success" id="btn-keep">✅ Забрать</button>
          <button class="btn btn-ghost" id="btn-sell-won">💰 Продать</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const track = overlay.querySelector("#roulette-track");

  // Создаём 60 случайных элементов + вставляем победителя на позицию ~50
  const WIN_POS = 50;
  const allSlots = [];
  for (let i = 0; i < 60; i++) {
    const item = i === WIN_POS
      ? won
      : items[Math.floor(Math.random() * items.length)];
    allSlots.push(item);
  }

  const ITEM_W = 120; // ширина слота в px
  const GAP    = 8;
  const SLOT_W = ITEM_W + GAP;

  allSlots.forEach((item, i) => {
    const el = document.createElement("div");
    el.className = "roulette-item";
    el.style.cssText = `border-color: ${RARITIES[item.rarity]?.color || "#fff"}`;
    el.innerHTML = `
      <img src="${esc(item.image)}" alt="${esc(item.name)}"
           onerror="this.src='https://placehold.co/96x96/1c2030/4f8ef7?text=?'">
      <span class="roulette-item-name">${esc(item.name)}</span>`;
    if (i === WIN_POS) el.classList.add("roulette-winner");
    track.appendChild(el);
  });

  // Центрируем на WIN_POS
  const trackOuter   = overlay.querySelector(".roulette-track-outer");
  const centerOffset = trackOuter.clientWidth / 2 - ITEM_W / 2;
  const finalTranslate = -(WIN_POS * SLOT_W - centerOffset);

  // Запускаем анимацию с небольшой задержкой
  requestAnimationFrame(() => {
    track.style.transition = "transform 5s cubic-bezier(0.12, 0.8, 0.25, 1)";
    track.style.transform  = `translateX(${finalTranslate}px)`;
  });

  // После анимации — показать результат
  track.addEventListener("transitionend", () => {
    const resultEl = overlay.querySelector("#roulette-result");
    const color    = RARITIES[won.rarity]?.color || "#fff";

    resultEl.classList.remove("hidden");
    overlay.querySelector("#roulette-won-img").src           = won.image;
    overlay.querySelector("#roulette-won-name").textContent  = won.name;
    overlay.querySelector("#roulette-won-rarity").textContent = RARITIES[won.rarity]?.label || won.rarity;
    overlay.querySelector("#roulette-won-rarity").style.color = color;
    overlay.querySelector("#roulette-glow").style.background  = color;

    // Вызвать колбэк (списать деньги, добавить предмет)
    onComplete();

    overlay.querySelector("#btn-keep").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#btn-sell-won").addEventListener("click", async () => {
      // Ищем свежедобавленный предмет в инвентаре
      const { getUserInventory } = await import("./inventory.js");
      const inv = await getUserInventory(currentUser.uid);
      const found = inv.find(i => i.itemId === won.id && !i.listedPrice);
      if (!found) { toast("Предмет не найден", "error"); return; }
      const { sellItem } = await import("./inventory.js");
      const price = await sellItem(currentUser.uid, found.invId);
      await updateBalanceDisplay();
      toast(`Продано за ${price} ${CURRENCY.short}`, "success");
      overlay.remove();
    });
  }, { once: true });
}

// ════════════════════════════════════════════
//  ПАНЕЛЬ АДМИНИСТРАТОРА
// ════════════════════════════════════════════
$("btn-open-admin-cases")?.addEventListener("click", () => {
  $("admin-cases-panel").classList.toggle("hidden");
});

// Добавить кейс
$("form-add-case")?.addEventListener("submit", async e => {
  e.preventDefault();
  const name  = $("case-name").value.trim();
  const price = parseInt($("case-price").value);
  const image = $("case-image").value.trim();
  const desc  = $("case-desc").value.trim();
  if (!name || !price || !image) { toast("Заполните поля", "error"); return; }

  const ref = await addDoc(collection(db, "cases"), { name, price, image, description: desc, createdAt: Date.now() });
  toast("Кейс создан!", "success");
  e.target.reset();
  await loadAll();

  // Предложить сразу добавить предметы
  $("new-case-id").value = ref.id;
  $("item-case-select").innerHTML = allCases.map(c =>
    `<option value="${c.id}" ${c.id === ref.id ? "selected" : ""}>${esc(c.name)}</option>`
  ).join("");
});

// Добавить предмет в кейс
$("form-add-item")?.addEventListener("submit", async e => {
  e.preventDefault();
  const caseId = $("item-case-select").value;
  const name   = $("item-name").value.trim();
  const rarity = $("item-rarity").value;
  const type   = $("item-type").value;
  const image  = $("item-image").value.trim();
  if (!caseId || !name || !rarity || !type || !image) { toast("Заполните поля", "error"); return; }

  await addDoc(collection(db, "catalogItems"), {
    caseId, name, rarity, type, image,
    createdAt: Date.now(),
  });
  toast("Предмет добавлен!", "success");
  e.target.reset();
  await loadAll();
});

// Пополнить баланс пользователю
$("form-topup")?.addEventListener("submit", async e => {
  e.preventDefault();
  const email  = $("topup-email").value.trim();
  const amount = parseInt($("topup-amount").value);
  if (!email || !amount) { toast("Введите email и сумму", "error"); return; }

  const { getDocs, query, collection, where } = await import(
    "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js"
  );
  const snap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
  if (snap.empty) { toast("Пользователь не найден", "error"); return; }

  const uid = snap.docs[0].data().uid;
  const { adminTopUp } = await import("./economy.js");
  await adminTopUp(uid, amount);
  toast(`✅ Начислено ${amount} ${CURRENCY.short} пользователю ${email}`, "success");
  e.target.reset();
});

// Заполнить select кейсов в форме предметов
async function populateCaseSelect() {
  if (!$("item-case-select")) return;
  $("item-case-select").innerHTML = allCases.map(c =>
    `<option value="${c.id}">${esc(c.name)}</option>`
  ).join("");
}

// Наблюдаем за изменением кейсов
const origRenderCases = renderCases;
