// ============================================================
//  top.js — топ игр по средней оценке (красивый дизайн)
// ============================================================
import { db } from "./firebase.js";
import { watchAuth } from "./auth.js";
import { esc } from "./utils.js";
import { renderHeader, showEmpty } from "./ui.js";
import {
  collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

renderHeader({ activePage: "top" });

// watchAuth нужен для онлайн-статуса на всех страницах
watchAuth({});

const container = document.getElementById("top-list");

async function loadTop() {
  const [gamesSnap, ratingsSnap] = await Promise.all([
    getDocs(collection(db, "games")),
    getDocs(collection(db, "ratings")),
  ]);

  const games      = gamesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const ratingsAll = ratingsSnap.docs.map(d => d.data());

  const ranked = games
    .map(game => {
      const rs = ratingsAll.filter(r => r.gameId === game.id);
      if (!rs.length) return null;
      const avg = rs.reduce((s, r) => s + r.rating, 0) / rs.length;
      return { ...game, avg: +avg.toFixed(1), count: rs.length };
    })
    .filter(Boolean)
    .sort((a, b) => b.avg - a.avg || b.count - a.count);

  if (!ranked.length) {
    showEmpty(container, "Оценок пока нет");
    return;
  }

  container.innerHTML = "";

  ranked.forEach((game, i) => {
    const rank  = i + 1;
    const cats  = Array.isArray(game.category) ? game.category : [game.category];
    const tags  = cats.slice(0, 3).map(c => `<span class="top-tag">${esc(c)}</span>`).join("") +
      (cats.length > 3 ? `<span class="top-tag">+${cats.length - 3}</span>` : "");

    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
    const rankCls = rank === 1 ? "top-rank-1" : rank === 2 ? "top-rank-2" : rank === 3 ? "top-rank-3" : "top-rank-other";

    // Цвет звезды зависит от оценки
    const starColor = game.avg >= 8 ? "#f5c542" : game.avg >= 6 ? "#4f8ef7" : "#8892a4";

    // Заполнение полосы рейтинга (макс 10)
    const barWidth = (game.avg / 10 * 100).toFixed(0);

    const card = document.createElement("div");
    card.className = `top-entry ${rankCls}`;
    card.innerHTML = `
      <div class="top-entry-cover">
        <img src="${esc(game.image)}" alt="${esc(game.title)}"
             onerror="this.src='https://placehold.co/900x340/1c2030/4f8ef7?text=No+Image'">
        <div class="top-entry-cover-overlay"></div>
        <div class="top-entry-rank-badge">
          ${medal ? `<span class="top-medal">${medal}</span>` : ""}
          <span class="top-rank-num">${medal ? "" : "#"}${medal ? rank + " место" : rank}</span>
        </div>
      </div>
      <div class="top-entry-body">
        <div class="top-entry-left">
          <h2 class="top-entry-title">${esc(game.title)}</h2>
          <div class="top-entry-tags">${tags}</div>
          <div class="top-entry-bar-wrap">
            <div class="top-entry-bar">
              <div class="top-entry-bar-fill" style="width:${barWidth}%;background:${starColor}"></div>
            </div>
            <span class="top-entry-score" style="color:${starColor}">
              ⭐ ${game.avg}
            </span>
          </div>
          <span class="top-entry-votes">${game.count} ${pluralVote(game.count)}</span>
        </div>
        <div class="top-entry-right">
          <a class="download-btn" href="${esc(game.link)}" target="_blank" rel="noopener">
            ⬇ Перейти
          </a>
        </div>
      </div>`;

    container.appendChild(card);
  });
}

function pluralVote(n) {
  if (n % 100 > 10 && n % 100 < 20) return "оценок";
  const n1 = n % 10;
  if (n1 === 1) return "оценка";
  if (n1 >= 2 && n1 <= 4) return "оценки";
  return "оценок";
}

loadTop();
