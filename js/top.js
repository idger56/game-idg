// ============================================================
//  top.js — топ игр (пирамидальная раскладка)
// ============================================================
import { db }        from "./firebase.js";
import { watchAuth } from "./auth.js";
import { esc }       from "./utils.js";
import { renderHeader, showEmpty } from "./ui.js";
import {
  collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

renderHeader({ activePage: "top" });
watchAuth({});   // только для обновления онлайн-статуса

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

  if (!ranked.length) { showEmpty(container, "Оценок пока нет"); return; }

  container.innerHTML = "";

  // Пирамидальная структура:
  // Ряд 0: [0]         → 1 карточка (место 1)
  // Ряд 1: [1, 2]      → 2 карточки (места 2–3)
  // Ряд 2: [3, 4, 5]   → 3 карточки (места 4–6)
  // Далее: по 3 в ряд
  const rows = buildRows(ranked);

  rows.forEach((rowGames, rowIdx) => {
    const row = document.createElement("div");
    row.className = `top-row top-row-${Math.min(rowIdx, 3)}`;

    rowGames.forEach((game, colIdx) => {
      const rank   = ranked.indexOf(game) + 1;
      const card   = buildCard(game, rank, rowIdx);
      row.appendChild(card);
    });

    container.appendChild(row);
  });
}

/** Разбиваем массив на ряды: 1 / 2 / 3 / 3 / 3 ... */
function buildRows(games) {
  const rows  = [];
  const sizes = [1, 2, 3]; // первые три ряда особые
  let   i     = 0;

  for (const size of sizes) {
    if (i >= games.length) break;
    rows.push(games.slice(i, i + size));
    i += size;
  }
  // Всё остальное — по 3
  while (i < games.length) {
    rows.push(games.slice(i, i + 3));
    i += 3;
  }
  return rows;
}

function buildCard(game, rank, rowIdx) {
  const cats = Array.isArray(game.category) ? game.category : [game.category];
  const tags = cats.slice(0, 2).map(c => `<span class="top-tag">${esc(c)}</span>`).join("") +
    (cats.length > 2 ? `<span class="top-tag">+${cats.length - 2}</span>` : "");

  // Медаль / номер
  const medal     = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  const rankLabel = medal ? `${medal} ${rank} место` : `#${rank}`;
  const rankCls   = `top-r${Math.min(rank, 4)}`;

  // Цвет звезды
  const starColor = game.avg >= 8 ? "#f5c542" : game.avg >= 6 ? "#4f8ef7" : "#8892a4";
  const barW      = (game.avg / 10 * 100).toFixed(0);

  const card = document.createElement("div");
  card.className = `top-card ${rankCls}`;
  card.innerHTML = `
    <div class="top-card-img-wrap">
      <img src="${esc(game.image)}" alt="${esc(game.title)}"
           onerror="this.src='https://placehold.co/600x300/1c2030/4f8ef7?text=No+Image'">
      <div class="top-card-overlay"></div>
      <span class="top-card-rank ${rankCls}-badge">${rankLabel}</span>
    </div>
    <div class="top-card-body">
      <h3 class="top-card-title">${esc(game.title)}</h3>
      <div class="top-card-tags">${tags}</div>
      <div class="top-card-score-row">
        <div class="top-card-bar-wrap">
          <div class="top-card-bar">
            <div class="top-card-bar-fill" style="width:${barW}%;background:${starColor}"></div>
          </div>
          <span class="top-card-score" style="color:${starColor}">⭐ ${game.avg}</span>
        </div>
        <span class="top-card-votes">${game.count} ${pluralVote(game.count)}</span>
      </div>
      <a class="download-btn" href="${esc(game.link)}" target="_blank" rel="noopener"
         style="margin-top:10px;display:flex;justify-content:center">
        ⬇ Перейти
      </a>
    </div>`;

  return card;
}

function pluralVote(n) {
  if (n % 100 > 10 && n % 100 < 20) return "оценок";
  const n1 = n % 10;
  if (n1 === 1) return "оценка";
  if (n1 >= 2 && n1 <= 4) return "оценки";
  return "оценок";
}

loadTop();
