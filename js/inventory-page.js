// ============================================================
//  inventory-page.js — страница инвентаря, контракты, витрина
// ============================================================
import { db, auth, ADMIN_EMAIL } from "./firebase.js";
import { watchAuth } from "./auth.js";
import { renderHeader, toast } from "./ui.js";
import { esc } from "./utils.js";
import { RARITIES, RARITY_ORDER, RARITY_SELL_PRICE, CONTRACT_COUNT, nextRarity, ITEM_TYPES, CURRENCY } from "./items.js";
import { getBalance } from "./economy.js";
import { getUserInventory, sellItem, setShowcase, makeContract } from "./inventory.js";
import { equipItem, injectSkinCSS } from "./skins.js";
import { listItem, unlistItem } from "./market.js";
import {
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

injectSkinCSS();
renderHeader({ activePage: "inventory" });

const $ = id => document.getElementById(id);
let currentUser      = null;
let inventory        = [];
let selectedContract = [];

watchAuth({
  onLogin: async (user) => {
    currentUser = user;
    $("inv-auth").classList.add("hidden");
    $("inv-main").classList.remove("hidden");
    await loadInventory();
    await updateBalanceDisplay();
  },
  onLogout: () => {
    currentUser = null;
    $("inv-auth").classList.remove("hidden");
    $("inv-main").classList.add("hidden");
  }
});

async function updateBalanceDisplay() {
  if (!currentUser) return;
  const bal = await getBalance(currentUser.uid);
  const el = $("balance-display-inv");
  if (el) el.textContent = `${CURRENCY.icon} ${bal} ${CURRENCY.short}`;
}

async function loadInventory() {
  inventory = await getUserInventory(currentUser.uid);
  applyFilter();
}

$("inv-filter-rarity")?.addEventListener("change", applyFilter);
$("inv-filter-type")?.addEventListener("change",   applyFilter);
$("inv-search")?.addEventListener("input",         applyFilter);

function applyFilter() {
  const rarity = $("inv-filter-rarity")?.value || "";
  const type   = $("inv-filter-type")?.value   || "";
  const search = ($("inv-search")?.value || "").toLowerCase();
  const filtered = inventory.filter(item =>
    (!rarity || item.rarity === rarity) &&
    (!type   || item.type   === type)   &&
    (!search || item.name.toLowerCase().includes(search))
  );
  renderInventory(filtered);
}

function renderInventory(items) {
  const grid = $("inv-grid");
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">🎒</div><p>Инвентарь пуст</p></div>`;
    return;
  }
  grid.innerHTML = "";

  for (const item of items) {
    const r         = RARITIES[item.rarity] || RARITIES.common;
    const isShow    = item.onShowcase;
    const isListed  = !!item.listedPrice;
    const isEquipped= !!item.equipped;
    const sellPrice = RARITY_SELL_PRICE[item.rarity] || 5;

    // Мини-превью скина
    const previewStyle = item.cssEffect
      ? `style="${item.cssEffect.replace(/border-radius:[^;]+;/g,'').replace(/animation:[^;]+;/g,'')}"` 
      : `style="background:${r.color}22;border-color:${r.color}"`;

    const card = document.createElement("div");
    card.className = "inv-card" + (isShow ? " on-showcase" : "") + (isListed ? " on-market" : "") + (isEquipped ? " equipped" : "");
    card.dataset.invId = item.invId;
    card.innerHTML = `
      <div class="inv-card-img" style="border-color:${r.color};box-shadow:0 0 12px ${r.glow}">
        <div class="inv-skin-preview" ${previewStyle}>
          ${item.type === 'avatar_frame' ? `<div class="preview-frame-circle" style="${item.cssEffect||''}"><span>A</span></div>` : ''}
          ${item.type === 'profile_bg'   ? `<div class="preview-bg-strip"    style="${item.cssEffect||''}"></div>` : ''}
          ${item.type === 'card_skin'    ? `<div class="preview-card-border" style="${item.cssEffect||''}">🃏</div>` : ''}
        </div>
        ${isShow    ? '<div class="inv-badge showcase-badge">Витрина</div>' : ''}
        ${isListed  ? `<div class="inv-badge market-badge">Рынок ${item.listedPrice}💎</div>` : ''}
        ${isEquipped? '<div class="inv-badge equip-badge">Надето</div>' : ''}
      </div>
      <div class="inv-card-body">
        <h4>${esc(item.name)}</h4>
        <span class="rarity-label" style="color:${r.color}">${r.label}</span>
        <span class="type-label">${ITEM_TYPES[item.type]?.icon||""} ${ITEM_TYPES[item.type]?.label||item.type}</span>
      </div>
      <div class="inv-card-actions">
        ${!isListed && !isShow ? `<button class="btn btn-primary btn-xs js-equip">${isEquipped?"👕 Снять":"👕 Надеть"}</button>` : ""}
        ${!isListed && !isShow && !isEquipped ? `<button class="btn btn-ghost btn-xs js-showcase">🖼 Витрина</button>` : ""}
        ${isShow  ? `<button class="btn btn-ghost btn-xs js-unshowcase">📤 Снять</button>` : ""}
        ${!isListed && !isShow && !isEquipped ? `<button class="btn btn-ghost btn-xs js-market">🏪 Рынок</button>` : ""}
        ${isListed  ? `<button class="btn btn-ghost btn-xs js-unlist">❌ Снять</button>` : ""}
        ${!isListed && !isShow && !isEquipped ? `<button class="btn btn-ghost btn-xs js-sell" title="Продать за ${sellPrice} PS">💰 ${sellPrice} PS</button>` : ""}
        <button class="btn btn-ghost btn-xs js-contract-add ${selectedContract.includes(item.invId) ? "selected" : ""}">
          ${selectedContract.includes(item.invId) ? "✅" : "🔧"} Контракт
        </button>
      </div>`;

    // Надеть/снять
    card.querySelector(".js-equip")?.addEventListener("click", async () => {
      try {
        await equipItem(currentUser.uid, item.invId, !isEquipped);
        toast(isEquipped ? "Скин снят" : "Скин надет! Виден на профиле.", "success");
        await loadInventory();
      } catch(e) { toast(e.message, "error"); }
    });
    // Витрина
    card.querySelector(".js-showcase")?.addEventListener("click", async () => {
      try {
        await setShowcase(currentUser.uid, item.invId, true);
        toast("Добавлено на витрину!", "success");
        await loadInventory();
      } catch(e) { toast(e.message, "error"); }
    });
    card.querySelector(".js-unshowcase")?.addEventListener("click", async () => {
      try {
        await setShowcase(currentUser.uid, item.invId, false);
        toast("Снято с витрины", "success");
        await loadInventory();
      } catch(e) { toast(e.message, "error"); }
    });
    // Продать
    card.querySelector(".js-sell")?.addEventListener("click", async () => {
      if (!confirm(`Продать «${item.name}» за ${sellPrice} PS?`)) return;
      try {
        const got = await sellItem(currentUser.uid, item.invId);
        toast(`Продано за ${got} PS`, "success");
        await loadInventory();
        await updateBalanceDisplay();
      } catch(e) { toast(e.message, "error"); }
    });
    // На рынок
    card.querySelector(".js-market")?.addEventListener("click", () => openListModal(item));
    card.querySelector(".js-unlist")?.addEventListener("click", async () => {
      try {
        await unlistItem(currentUser.uid, item.listingId);
        toast("Снято с рынка", "success");
        await loadInventory();
      } catch(e) { toast(e.message, "error"); }
    });
    // Контракт
    card.querySelector(".js-contract-add").addEventListener("click", () => {
      toggleContractItem(item.invId, item.rarity, card);
    });

    grid.appendChild(card);
  }
}

function openListModal(item) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  const suggestedPrice = RARITY_SELL_PRICE[item.rarity] * 3;
  const r = RARITIES[item.rarity] || RARITIES.common;
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px">
      <button class="modal-close">✕</button>
      <div class="modal-body">
        <h2>🏪 Выставить на рынок</h2>
        <div style="display:flex;align-items:center;gap:16px;margin:20px 0">
          <div class="inv-skin-preview" style="width:64px;height:64px;border-radius:8px;border:2px solid ${r.color};overflow:hidden">
            ${item.type==='avatar_frame' ? `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;${item.cssEffect||''}">A</div>` : ''}
            ${item.type==='profile_bg'   ? `<div style="width:100%;height:100%;${item.cssEffect||''}"></div>` : ''}
            ${item.type==='card_skin'    ? `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2rem;${item.cssEffect||''}">🃏</div>` : ''}
          </div>
          <div>
            <h3>${esc(item.name)}</h3>
            <span style="color:${r.color}">${r.label}</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Цена (${CURRENCY.short})</label>
          <input type="number" id="list-price" min="1" value="${suggestedPrice}" />
          <small style="color:var(--text-muted)">Комиссия 5% при продаже</small>
        </div>
        <button class="btn btn-primary" id="btn-confirm-list" style="width:100%">Выставить</button>
      </div>
    </div>`;

  overlay.querySelector(".modal-close").onclick = () => overlay.remove();
  overlay.addEventListener("click", e => { if(e.target === overlay) overlay.remove(); });
  overlay.querySelector("#btn-confirm-list").addEventListener("click", async () => {
    const price = parseInt(overlay.querySelector("#list-price").value);
    try {
      await listItem(currentUser.uid, item.invId, price);
      toast("Выставлено на рынок!", "success");
      overlay.remove();
      await loadInventory();
    } catch(e) { toast(e.message, "error"); }
  });
  document.body.appendChild(overlay);
}

// ── Контракт ─────────────────────────────────────────────
function toggleContractItem(invId, rarity, card) {
  const idx = selectedContract.indexOf(invId);
  if (idx !== -1) {
    selectedContract.splice(idx, 1);
    card.querySelector(".js-contract-add").textContent = "🔧 Контракт";
    card.querySelector(".js-contract-add").classList.remove("selected");
  } else {
    const existing = inventory.find(i => selectedContract.includes(i.invId));
    if (existing && existing.rarity !== rarity) {
      toast("Все предметы должны быть одной редкости!", "error"); return;
    }
    if (selectedContract.length >= CONTRACT_COUNT) {
      toast(`Максимум ${CONTRACT_COUNT} предметов`, "error"); return;
    }
    selectedContract.push(invId);
    card.querySelector(".js-contract-add").textContent = "✅ Контракт";
    card.querySelector(".js-contract-add").classList.add("selected");
  }
  updateContractPanel();
}

function updateContractPanel() {
  const panel   = $("contract-panel");
  const counter = $("contract-counter");
  const btn     = $("btn-make-contract");
  if (selectedContract.length > 0) panel.classList.remove("hidden");
  counter.textContent = `${selectedContract.length} / ${CONTRACT_COUNT}`;
  btn.disabled = selectedContract.length !== CONTRACT_COUNT;
  if (selectedContract.length > 0) {
    const item    = inventory.find(i => i.invId === selectedContract[0]);
    const upgraded= item ? nextRarity(item.rarity) : null;
    $("contract-result-rarity").textContent = upgraded
      ? `→ ${RARITIES[upgraded]?.label || upgraded}`
      : "Максимальная редкость!";
    $("contract-result-rarity").style.color = upgraded ? RARITIES[upgraded]?.color : "#f5c542";
  }
}

$("btn-clear-contract")?.addEventListener("click", () => {
  selectedContract = [];
  $("contract-panel").classList.add("hidden");
  applyFilter();
});

$("btn-make-contract")?.addEventListener("click", async () => {
  try {
    const { item } = await makeContract(currentUser.uid, selectedContract);
    selectedContract = [];
    $("contract-panel").classList.add("hidden");
    toast(`🎉 Контракт! Получен: ${item.name}`, "success");
    await loadInventory();
  } catch(e) { toast(e.message, "error"); }
});
