// ============================================================
//  top.js — топ игр по средней оценке
// ============================================================
import { db } from "./firebase.js";
import { esc } from "./utils.js";
import { renderHeader, showEmpty } from "./ui.js";
import {
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

renderHeader({ activePage: "top" });

const container = document.getElementById("top-list");

async function loadTop() {
  // Загружаем игры и все рейтинги параллельно
  const [gamesSnap, ratingsSnap] = await Promise.all([
    getDocs(collection(db,"games")),
    getDocs(collection(db,"ratings")),
  ]);

  const games      = gamesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const ratingsAll = ratingsSnap.docs.map(d => d.data());

  // Считаем средние
  const ranked = games
    .map(game => {
      const rs  = ratingsAll.filter(r => r.gameId === game.id);
      if (!rs.length) return null;
      const avg = rs.reduce((s,r) => s + r.rating, 0) / rs.length;
      return { ...game, avg: avg.toFixed(1), count: rs.length };
    })
    .filter(Boolean)
    .sort((a,b) => b.avg - a.avg);

  if (!ranked.length) {
    showEmpty(container,"Оценок пока нет");
    return;
  }

  // Строим сетку топ
  const grid = document.createElement("div");
  grid.id = "top-games-list";

  ranked.forEach((game, i) => {
    const rank = i + 1;
    const cls  = rank===1?"rank-1" : rank===2?"rank-2" : rank===3?"rank-3" : "rank-other";
    const rankLabel = rank===1?"🥇 1 место" : rank===2?"🥈 2 место" : rank===3?"🥉 3 место" : `#${rank}`;

    const cats = Array.isArray(game.category) ? game.category : [game.category];
    const tagsHtml = cats.slice(0,2).map(c=>`<span class="tag">${esc(c)}</span>`).join("") +
      (cats.length>2?`<span class="tag">+${cats.length-2}</span>`:"");

    const card = document.createElement("div");
    card.className = `top-card ${cls}`;
    card.innerHTML = `
      <span class="rank-badge ${cls}">${rankLabel}</span>
      <img src="${esc(game.image)}" alt="${esc(game.title)}"
           onerror="this.src='https://via.placeholder.com/400x240/1c2030/4f8ef7?text=No+Image'">
      <div class="top-card-body">
        <h3>${esc(game.title)}</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0">${tagsHtml}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
          <span style="font-size:1.2rem;font-weight:700;color:var(--accent)">⭐ ${game.avg}</span>
          <span style="font-size:0.8rem;color:var(--text-muted)">${game.count} ${pluralVote(game.count)}</span>
        </div>
        <a class="download-btn" href="${esc(game.link)}" target="_blank" rel="noopener"
           style="margin-top:10px">⬇ Перейти</a>
      </div>`;

    grid.appendChild(card);
  });

  container.innerHTML = "";
  container.appendChild(grid);
}

function pluralVote(n) {
  if (n%100 > 10 && n%100 < 20) return "оценок";
  const n1 = n%10;
  if (n1===1) return "оценка";
  if (n1>=2 && n1<=4) return "оценки";
  return "оценок";
}

loadTop();
