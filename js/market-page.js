// ============================================================
//  market-page.js — страница рынка: листинги, покупка, обмены
// ============================================================
import { db, auth } from "./firebase.js";
import { watchAuth } from "./auth.js";
import { renderHeader, toast } from "./ui.js";
import { esc } from "./utils.js";
import { RARITIES, RARITY_ORDER, ITEM_TYPES, CURRENCY } from "./items.js";
import { getBalance } from "./economy.js";
import { getUserInventory } from "./inventory.js";
import { getActiveListings, buyItem, sendTradeOffer, getTradesForUser, acceptTrade, declineTrade } from "./market.js";

renderHeader({ activePage: "market" });

const $ = id => document.getElementById(id);
let currentUser = null;
let listings    = [];
let myInventory = [];

watchAuth({
  onLogin: async (user) => {
    currentUser = user;
    $("mkt-auth").classList.add("hidden");
    $("mkt-main").classList.remove("hidden");
    await loadAll();
    await updateBalanceDisplay();
    await loadTrades();
  },
  onLogout: () => {
    currentUser = null;
    $("mkt-auth").classList.remove("hidden");
    $("mkt-main").classList.add("hidden");
  }
});

async function updateBalanceDisplay() {
  if (!currentUser) return;
  const bal = await getBalance(currentUser.uid);
  const el = $("balance-display-mkt");
  if (el) el.textContent = `${CURRENCY.icon} ${bal} ${CURRENCY.short}`;
}

async function loadAll() {
  [listings, myInventory] = await Promise.all([
    getActiveListings(),
    getUserInventory(currentUser.uid),
  ]);
  applyMarketFilter();
}

// ── Фильтры ──────────────────────────────────────────────
$("mkt-filter-rarity")?.addEventListener("change", applyMarketFilter);
$("mkt-search")?.addEventListener("input", applyMarketFilter);
$("mkt-sort")?.addEventListener("change", applyMarketFilter);

function applyMarketFilter() {
  const rarity = $("mkt-filter-rarity")?.value || "";
  const search = ($("mkt-search")?.value || "").toLowerCase();
  const sort   = $("mkt-sort")?.value || "newest";

  let filtered = listings.filter(l =>
    l.sellerUid !== currentUser?.uid &&
    (!rarity || l.rarity === rarity) &&
    (!search || l.name.toLowerCase().includes(search))
  );

  if (sort === "price_asc")  filtered.sort((a,b) => a.price - b.price);
  if (sort === "price_desc") filtered.sort((a,b) => b.price - a.price);
  if (sort === "newest")     filtered.sort((a,b) => b.createdAt - a.createdAt);

  renderListings(filtered);
}

// ── Рендер лотов ─────────────────────────────────────────
function renderListings(items) {
  const grid = $("market-grid");
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">🏪</div><p>Нет активных лотов</p></div>`;
    return;
  }
  grid.innerHTML = "";

  for (const listing of items) {
    const r = RARITIES[listing.rarity] || RARITIES.common;
    const card = document.createElement("div");
    card.className = "market-card";
    card.innerHTML = `
      <div class="market-card-img" style="border-color:${r.color};box-shadow:0 0 14px ${r.glow}">
        <img src="${esc(listing.image)}" alt="${esc(listing.name)}"
             onerror="this.src='https://placehold.co/96x96/1c2030/4f8ef7?text=?'">
      </div>
      <div class="market-card-body">
        <h4>${esc(listing.name)}</h4>
        <span class="rarity-label" style="color:${r.color}">${r.label}</span>
        <div class="market-price">${CURRENCY.icon} ${listing.price} <small>${CURRENCY.short}</small></div>
      </div>
      <div class="market-card-actions">
        <button class="btn btn-primary btn-sm js-buy">💰 Купить</button>
        <button class="btn btn-ghost btn-sm js-trade">🔄 Обмен</button>
      </div>`;

    card.querySelector(".js-buy").addEventListener("click", async () => {
      if (!confirm(`Купить «${listing.name}» за ${listing.price} ${CURRENCY.short}?`)) return;
      try {
        await buyItem(currentUser.uid, listing.listingId);
        toast(`✅ Куплено: ${listing.name}!`, "success");
        await loadAll();
        await updateBalanceDisplay();
      } catch(e) { toast(e.message, "error"); }
    });

    card.querySelector(".js-trade").addEventListener("click", () => {
      openTradeModal(listing);
    });

    grid.appendChild(card);
  }
}

// ── Модалка обмена ────────────────────────────────────────
function openTradeModal(targetListing) {
  const myItems = myInventory.filter(i => !i.listedPrice && !i.onShowcase);
  if (!myItems.length) {
    toast("У вас нет свободных предметов для обмена", "error"); return;
  }

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px">
      <button class="modal-close">✕</button>
      <div class="modal-body">
        <h2>🔄 Предложить обмен</h2>
        <div class="trade-sides">
          <div class="trade-side">
            <h4>Они отдают</h4>
            <div class="trade-item-preview">
              <img src="${esc(targetListing.image)}" alt="">
              <span>${esc(targetListing.name)}</span>
              <span class="rarity-label" style="color:${RARITIES[targetListing.rarity]?.color}">${RARITIES[targetListing.rarity]?.label}</span>
            </div>
          </div>
          <div class="trade-arrow">⇄</div>
          <div class="trade-side">
            <h4>Вы отдаёте</h4>
            <select id="trade-my-item" style="width:100%">
              ${myItems.map(i => `
                <option value="${i.invId}">${esc(i.name)} (${RARITIES[i.rarity]?.label})</option>
              `).join("")}
            </select>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-send-trade" style="width:100%;margin-top:20px">
          📤 Отправить предложение
        </button>
      </div>
    </div>`;

  overlay.querySelector(".modal-close").onclick = () => overlay.remove();
  overlay.addEventListener("click", e => { if(e.target === overlay) overlay.remove(); });

  overlay.querySelector("#btn-send-trade").addEventListener("click", async () => {
    const myInvId = overlay.querySelector("#trade-my-item").value;
    try {
      await sendTradeOffer(currentUser.uid, targetListing.sellerUid, myInvId, targetListing.invId);
      toast("Предложение обмена отправлено!", "success");
      overlay.remove();
    } catch(e) { toast(e.message, "error"); }
  });

  document.body.appendChild(overlay);
}

// ── Входящие обмены ───────────────────────────────────────
async function loadTrades() {
  const trades = await getTradesForUser(currentUser.uid);
  const section = $("trades-section");
  if (!trades.length) {
    section.innerHTML = `<p class="text-muted">Нет активных предложений обмена</p>`;
    return;
  }

  // Загрузить никнеймы
  const { getDocs, query, collection, where } = await import(
    "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js"
  );
  const uids = [...new Set(trades.flatMap(t => [t.fromUid, t.toUid]))];
  const usersSnap = await getDocs(collection(db, "users"));
  const usersMap  = Object.fromEntries(usersSnap.docs.map(d => [d.data().uid, d.data()]));

  section.innerHTML = "";
  for (const trade of trades) {
    const isIncoming = trade.dir === "incoming";
    const otherUid   = isIncoming ? trade.fromUid : trade.toUid;
    const otherUser  = usersMap[otherUid] || {};
    const row = document.createElement("div");
    row.className = "trade-row";
    row.innerHTML = `
      <div class="trade-row-info">
        <span class="trade-direction">${isIncoming ? "📥 Входящий" : "📤 Исходящий"}</span>
        <span>${isIncoming ? "От" : "Кому"}: <b>${esc(otherUser.nickname || otherUid)}</b></span>
        <div class="trade-items-preview">
          <div>
            <small>Вы отдаёте</small>
            <img src="${esc(isIncoming ? trade.wantedItem.image : trade.offeredItem.image)}" alt=""
                 style="width:40px;height:40px;border-radius:6px;object-fit:cover">
          </div>
          <span>⇄</span>
          <div>
            <small>Вы получаете</small>
            <img src="${esc(isIncoming ? trade.offeredItem.image : trade.wantedItem.image)}" alt=""
                 style="width:40px;height:40px;border-radius:6px;object-fit:cover">
          </div>
        </div>
      </div>
      <div class="trade-row-actions">
        ${isIncoming ? `
          <button class="btn btn-success btn-sm js-accept">✅ Принять</button>
          <button class="btn btn-ghost btn-sm js-decline">❌ Отклонить</button>
        ` : `
          <button class="btn btn-ghost btn-sm js-cancel">🗑 Отменить</button>
        `}
      </div>`;

    row.querySelector(".js-accept")?.addEventListener("click", async () => {
      try {
        await acceptTrade(currentUser.uid, trade.tradeId);
        toast("Обмен принят!", "success");
        await loadAll();
        await loadTrades();
      } catch(e) { toast(e.message, "error"); }
    });
    row.querySelector(".js-decline")?.addEventListener("click", async () => {
      try {
        await declineTrade(currentUser.uid, trade.tradeId);
        toast("Обмен отклонён", "info");
        await loadTrades();
      } catch(e) { toast(e.message, "error"); }
    });
    row.querySelector(".js-cancel")?.addEventListener("click", async () => {
      try {
        await declineTrade(currentUser.uid, trade.tradeId);
        toast("Предложение отменено", "info");
        await loadTrades();
      } catch(e) { toast(e.message, "error"); }
    });

    section.appendChild(row);
  }
}

// Переключение вкладок
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    $(`tab-${tab}`)?.classList.add("active");
  });
});
