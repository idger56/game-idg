// ============================================================
//  index.js — главная страница (мультиплеер игры)
// ============================================================
import { db, auth, ADMIN_EMAIL } from "./firebase.js";
import { login, register, logout, watchAuth } from "./auth.js";
import { esc, toSlug, genreOptions, statusOptions, calcUserStats } from "./utils.js";
import { GENRES } from "./constants.js";
import { renderHeader, toast, showSpinner, showEmpty } from "./ui.js";
import {
  collection, addDoc, getDocs, getDoc, setDoc,
  updateDoc, query, where, doc
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

// ---------- Инициализация ----------
renderHeader({ activePage: "index" });

const $ = id => document.getElementById(id);

const authSection  = $("auth-section");
const mainSection  = $("main-section");
const authError    = $("auth-error");
const gamesGrid    = $("games-grid");
const addFormWrap  = $("add-form-wrap");
const btnToggleAdd = $("btn-toggle-add");
const addForm      = $("add-game-form");

// Заполняем жанры
$("f-category").innerHTML    = genreOptions();
$("filter-category").innerHTML = `<option value="">Все жанры</option>` + GENRES.map(g =>
  `<option value="${g}">${g}</option>`).join("");

// ---------- Авторизация ----------
$("btn-login").addEventListener("click", async () => {
  authError.textContent = "";
  try {
    await login($("auth-email").value.trim(), $("auth-pass").value.trim());
  } catch (e) {
    authError.textContent = e.message;
  }
});

$("btn-register").addEventListener("click", async () => {
  authError.textContent = "";
  try {
    const msg = await register(
      $("auth-email").value.trim(),
      $("auth-pass").value.trim(),
      $("auth-nick").value.trim()
    );
    authError.style.color = "var(--accent-2)";
    authError.textContent = msg;
  } catch (e) {
    authError.style.color = "var(--danger)";
    authError.textContent = e.message;
  }
});

// ---------- Состояние ----------
let allGames = [];
let currentUser = null;
let renderToken = 0;

// ---------- Watch Auth ----------
watchAuth({
  onLogin: (user) => {
    currentUser = user;
    authSection.classList.add("hidden");
    mainSection.classList.remove("hidden");
    if (user.email === ADMIN_EMAIL) {
      btnToggleAdd.classList.remove("hidden");
    }
    loadGames();
  },
  onLogout: () => {
    currentUser = null;
    authSection.classList.remove("hidden");
    mainSection.classList.add("hidden");
    btnToggleAdd.classList.add("hidden");
  }
});

// ---------- Форма добавления ----------
btnToggleAdd?.addEventListener("click", () => addFormWrap.classList.toggle("hidden"));

addForm.addEventListener("submit", async e => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user || user.email !== ADMIN_EMAIL) return;

  const title    = $("f-title").value.trim();
  const category = Array.from($("f-category").selectedOptions).map(o => o.value);
  const link     = $("f-link").value.trim();
  const image    = $("f-image").value.trim();
  const status   = $("f-status").value;

  if (!title || !category.length || !link || !image || !status) {
    toast("Заполните все поля", "error"); return;
  }

  try {
    const id = toSlug(title);
    await setDoc(doc(db, "games", id), { title, category, link, image, status });
    addForm.reset();
    addFormWrap.classList.add("hidden");
    toast("Игра добавлена!", "success");
    loadGames();
  } catch (err) {
    toast(err.message, "error");
  }
});

// ---------- Загрузка ----------
async function loadGames() {
  showSpinner(gamesGrid);
  const snap = await getDocs(collection(db, "games"));
  allGames = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  applyFilters();
}

// ---------- Фильтры ----------
["filter-search","filter-category","filter-status"].forEach(id =>
  $(id)?.addEventListener("input", applyFilters)
);
// для select используем change
["filter-category","filter-status"].forEach(id =>
  $(id)?.addEventListener("change", applyFilters)
);

function applyFilters() {
  const search   = ($("filter-search")?.value || "").toLowerCase();
  const category = $("filter-category")?.value || "";
  const status   = $("filter-status")?.value   || "";

  const filtered = allGames.filter(g => {
    const cats = Array.isArray(g.category) ? g.category : [g.category];
    return (
      g.title.toLowerCase().includes(search) &&
      (!category || cats.includes(category)) &&
      (!status   || g.status === status)
    );
  });

  const token = ++renderToken;
  renderGames(filtered, token);
}

// ---------- Рендер ----------
async function renderGames(games, token) {
  if (!games.length) { showEmpty(gamesGrid, "Игры не найдены"); return; }

  gamesGrid.innerHTML = "";

  // Загружаем все рейтинги одним запросом
  const [ratingsSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, "ratings")),
    getDocs(collection(db, "users")),
  ]);
  if (token !== renderToken) return;

  const ratingsAll = ratingsSnap.docs.map(d => d.data());
  const usersMap   = Object.fromEntries(usersSnap.docs.map(d => [d.data().uid, d.data()]));

  for (const game of games) {
    if (token !== renderToken) return;

    const gameRatings = ratingsAll.filter(r => r.gameId === game.id);
    const avg = gameRatings.length
      ? (gameRatings.reduce((s,r) => s + r.rating, 0) / gameRatings.length).toFixed(1)
      : null;

    const userRatingObj = currentUser
      ? gameRatings.find(r => r.userId === currentUser.uid)
      : null;
    const userRating = userRatingObj?.rating ?? null;

    const card = buildCard(game, avg, userRating, usersMap, gameRatings);
    gamesGrid.appendChild(card);
  }
}

function buildCard(game, avg, userRating, usersMap, gameRatings) {
  const user  = auth.currentUser;
  const isAdmin = user?.email === ADMIN_EMAIL;
  const cats  = Array.isArray(game.category) ? game.category : [game.category];

  const statusClass = { "Пройдена":"done","В процессе":"playing","В планах":"plan" }[game.status] ?? "";
  const tagsHtml = cats.slice(0,3).map(c => `<span class="tag">${esc(c)}</span>`).join("") +
    (cats.length > 3 ? `<span class="tag">+${cats.length-3}</span>` : "");

  const card = document.createElement("div");
  card.className = "game-card";
  card.innerHTML = `
    <img class="game-card-img" src="${esc(game.image)}" alt="${esc(game.title)}"
         onerror="this.src='https://via.placeholder.com/280x200/1c2030/4f8ef7?text=No+Image'">
    <div class="game-card-body">
      <h3 class="game-card-title">${esc(game.title)}</h3>
      <div class="game-card-meta">${tagsHtml}</div>
      <span class="status-badge ${statusClass}">${esc(game.status)}</span>
      <div class="rating-row">
        <span class="label">⭐ Средняя</span>
        <span class="value">${avg ?? "—"}</span>
      </div>
      ${user ? `
      <div class="rating-row">
        <span class="label">Ваша оценка</span>
        <span class="value" id="my-rating-${game.id}">${userRating ?? "—"}</span>
      </div>` : ""}
    </div>
    <div class="game-card-footer">
      ${user && game.status === "Пройдена" ? `
        <select class="card-select" id="rate-select-${game.id}" aria-label="Ваша оценка">
          <option value="">Оценить...</option>
          ${Array.from({length:10},(_,i)=>`<option value="${i+1}" ${userRating===i+1?"selected":""}>${i+1} ⭐</option>`).join("")}
        </select>
      ` : ""}
      <a class="download-btn" href="${esc(game.link)}" target="_blank" rel="noopener">
        ⬇ Скачать / Перейти
      </a>
      ${isAdmin ? `
        <div class="flex-gap mt-4">
          <button class="btn btn-ghost btn-sm" data-edit="${game.id}">✏️ Редактировать</button>
          <button class="btn btn-ghost btn-sm" data-ratings="${game.id}">📋 Оценки</button>
        </div>
      ` : ""}
    </div>
  `;

  // Рейтинг
  const rateSelect = card.querySelector(`#rate-select-${game.id}`);
  if (rateSelect) {
    rateSelect.addEventListener("change", async () => {
      const rating = parseInt(rateSelect.value);
      if (isNaN(rating)) return;
      await saveRating(game.id, rating);
      card.querySelector(`#my-rating-${game.id}`).textContent = rating;
    });
  }

  // Кнопка редактирования
  card.querySelector("[data-edit]")?.addEventListener("click", () =>
    openEditModal(game)
  );

  // Кнопка «Оценки»
  card.querySelector("[data-ratings]")?.addEventListener("click", () =>
    openRatingsModal(game, gameRatings, usersMap)
  );

  return card;
}

async function saveRating(gameId, rating) {
  const user = auth.currentUser;
  if (!user) return;
  const q    = query(collection(db,"ratings"), where("gameId","==",gameId), where("userId","==",user.uid));
  const snap = await getDocs(q);
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, { rating });
  } else {
    await addDoc(collection(db,"ratings"), { userId: user.uid, gameId, rating });
  }
  toast("Оценка сохранена!", "success");
}

// ---------- Модалка редактирования ----------
function openEditModal(game) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px">
      <button class="modal-close">✕</button>
      <div class="modal-body">
        <h2>✏️ Редактировать игру</h2>
        <form id="edit-form" class="form-row" style="margin-top:16px">
          <div class="form-group"><label class="form-label">Название</label>
            <input type="text" name="title" value="${esc(game.title)}" required /></div>
          <div class="form-group"><label class="form-label">URL обложки</label>
            <input type="url" name="image" value="${esc(game.image)}" required /></div>
          <div class="form-group"><label class="form-label">Ссылка</label>
            <input type="url" name="link" value="${esc(game.link)}" required /></div>
          <div class="form-group"><label class="form-label">Статус</label>
            <select name="status">
              <option ${game.status==="Пройдена"?"selected":""}>Пройдена</option>
              <option ${game.status==="В процессе"?"selected":""}>В процессе</option>
              <option ${game.status==="В планах"?"selected":""}>В планах</option>
            </select></div>
          <div class="form-group"><label class="form-label">Жанры</label>
            <select name="category" multiple class="multi-select">${genreOptions(game.category)}</select></div>
          <button type="submit" class="btn btn-primary">Сохранить</button>
        </form>
      </div>
    </div>`;

  overlay.querySelector(".modal-close").onclick = () => overlay.remove();
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector("#edit-form").addEventListener("submit", async e => {
    e.preventDefault();
    const fd = e.target;
    try {
      await updateDoc(doc(db,"games",game.id), {
        title:    fd.title.value.trim(),
        image:    fd.image.value.trim(),
        link:     fd.link.value.trim(),
        status:   fd.status.value,
        category: Array.from(fd.category.selectedOptions).map(o => o.value),
      });
      overlay.remove();
      toast("Игра обновлена!", "success");
      loadGames();
    } catch (err) {
      toast(err.message, "error");
    }
  });

  document.body.appendChild(overlay);
}

// ---------- Модалка «Оценки» ----------
function openRatingsModal(game, gameRatings, usersMap) {
  const rows = gameRatings.map(r => {
    const u = usersMap[r.userId];
    return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
      <span>${u ? esc(u.nickname) : "Аноним"}</span>
      <strong style="color:var(--accent)">${r.rating} ⭐</strong>
    </div>`;
  }).join("") || "<p class='text-muted'>Оценок нет</p>";

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px">
      <button class="modal-close">✕</button>
      <div class="modal-body">
        <h2>📋 Оценки — ${esc(game.title)}</h2>
        <div style="margin-top:16px">${rows}</div>
      </div>
    </div>`;

  overlay.querySelector(".modal-close").onclick = () => overlay.remove();
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}
