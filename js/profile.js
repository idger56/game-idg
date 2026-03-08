// ============================================================
//  profile.js — публичная страница профиля
// ============================================================
import { db } from "./firebase.js";
import { watchAuth } from "./auth.js";
import { esc, calcUserStats, formatLastSeen, isOnline } from "./utils.js";
import { renderHeader, showEmpty } from "./ui.js";
import { renderAchievements, renderBadges, statsToAchievementInput } from "./achievements.js";
import {
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

renderHeader({ activePage: "" });
// Трекинг присутствия на этой странице
watchAuth({});

const uid = new URLSearchParams(location.search).get("uid");
const container = document.getElementById("profile-content");

if (!uid) {
  container.innerHTML = `<div class="empty-state"><div class="icon">❓</div><p>Пользователь не найден</p></div>`;
} else {
  loadProfile(uid);
}

async function loadProfile(uid) {
  const [userSnap, gamesSnap, ratingsSnap] = await Promise.all([
    getDocs(query(collection(db,"users"), where("uid","==",uid))),
    getDocs(collection(db,"games")),
    getDocs(query(collection(db,"ratings"), where("userId","==",uid))),
  ]);

  if (userSnap.empty) {
    container.innerHTML = `<div class="empty-state"><div class="icon">❓</div><p>Профиль не найден</p></div>`;
    return;
  }

  const userData = userSnap.docs[0].data();
  const gamesArr = gamesSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  const ratings  = ratingsSnap.docs.map(d => d.data());
  const stats    = calcUserStats(ratings, gamesArr, gamesSnap.size, userData.favoriteGenre);
  const achInput = statsToAchievementInput(stats);

  document.title = `GameIDG — ${userData.nickname}`;

  const lastMs = typeof userData.lastSeen === "number" ? userData.lastSeen : null;
  const online = isOnline(lastMs);

  container.innerHTML = `
    <div class="profile-header">
      <div>
        <img class="profile-avatar-big" src="${esc(userData.avatar||"assets/default-avatar.png")}" alt=""
             onerror="this.onerror=null;this.src='assets/default-avatar.png'">
      </div>
      <div class="profile-mid">
        <h1>${esc(userData.nickname||"Пользователь")}</h1>
        <div class="profile-status" style="margin-bottom:12px">
          <span class="status-dot ${online?"online":"offline"}"></span>
          <span style="color:var(--${online?"online":"offline"})">${online?"Онлайн":formatLastSeen(lastMs)}</span>
        </div>
        <p style="color:var(--text-secondary);font-style:italic;margin-bottom:16px">
          "${esc(userData.quote||"—")}"
        </p>
        <div class="profile-stats-row" style="max-width:320px">
          <div class="stat-box"><div class="num">${stats.avgRating??0}</div><div class="lbl">Ср. оценка</div></div>
          <div class="stat-box"><div class="num">${stats.percentComplete}%</div><div class="lbl">Пройдено</div></div>
          <div class="stat-box"><div class="num">${stats.ratingsCount}</div><div class="lbl">Оценок</div></div>
          <div class="stat-box"><div class="num">${stats.genresCount}</div><div class="lbl">Жанров</div></div>
        </div>
        ${userData.favoriteGenre ? `
          <p style="margin-top:12px;font-size:0.9rem;color:var(--text-secondary)">
            🎮 Любимый жанр: <strong style="color:var(--accent)">${esc(userData.favoriteGenre)}</strong>
          </p>` : ""}
        <div id="profile-badges" style="margin-top:16px"></div>
      </div>
      <div class="profile-achievements" id="profile-achievements"></div>
    </div>

    <section style="margin-top:36px">
      <h2 style="font-size:1.2rem;font-weight:700;margin-bottom:16px;color:var(--text-primary)">
        🎮 Оцененные игры (${ratings.length})
      </h2>
      <div class="rated-games-list" id="rated-games-list"></div>
    </section>`;

  renderBadges(document.getElementById("profile-badges"), achInput);
  renderAchievements(document.getElementById("profile-achievements"), achInput);

  // Витрина предметов
  try {
    const { getShowcase } = await import("./inventory.js");
    const showcase = await getShowcase(uid);
    if (showcase.length) {
      const { RARITIES, ITEM_TYPES } = await import("./items.js");
      const showcaseSection = document.createElement("section");
      showcaseSection.style.cssText = "margin-top:32px";
      showcaseSection.innerHTML = `
        <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:14px;color:var(--text-primary)">
          🖼 Витрина (${showcase.length}/5)
        </h2>
        <div class="showcase-grid" id="showcase-grid"></div>`;
      container.querySelector("section")?.before(showcaseSection);
      const grid = showcaseSection.querySelector("#showcase-grid");
      for (const item of showcase) {
        const r = RARITIES[item.rarity] || RARITIES.common;
        const card = document.createElement("div");
        card.className = "showcase-card";
        card.style.cssText = `border-color:${r.color};box-shadow:0 0 14px ${r.glow}`;
        card.innerHTML = `
          <img src="${esc(item.image)}" alt="${esc(item.name)}"
               onerror="this.src='https://placehold.co/80x80/1c2030/4f8ef7?text=?'">
          <div class="showcase-info">
            <span class="showcase-name">${esc(item.name)}</span>
            <span class="showcase-rarity" style="color:${r.color}">${r.label}</span>
          </div>`;
        grid.appendChild(card);
      }
    }
  } catch(_) {}

  // Оцененные игры
  const ratedList = document.getElementById("rated-games-list");
  if (!ratings.length) {
    ratedList.innerHTML = `<p class="text-muted">Нет оценённых игр</p>`;
  } else {
    const sorted = [...ratings].sort((a,b) => b.rating - a.rating);
    for (const r of sorted) {
      const game = gamesArr.find(g => g.id === r.gameId);
      if (!game) continue;
      const item = document.createElement("div");
      item.className = "rated-game-item";
      item.innerHTML = `
        <img src="${esc(game.image)}" alt="${esc(game.title)}"
             onerror="this.src='https://via.placeholder.com/44x44/1c2030/4f8ef7?text=?'">
        <div class="info">
          <div class="title">${esc(game.title)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">${
            (Array.isArray(game.category)?game.category:[game.category]).slice(0,2).join(", ")
          }</div>
        </div>
        <div class="score">${r.rating} ⭐</div>`;
      ratedList.appendChild(item);
    }
  }
}
