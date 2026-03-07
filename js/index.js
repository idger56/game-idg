// ============================================================
//  index.js — главная: слайдер, популярное, каталог, карточка игры
// ============================================================
import { db, auth, ADMIN_EMAIL } from "./firebase.js";
import { login, register, watchAuth } from "./auth.js";
import { esc, toSlug, genreOptions } from "./utils.js";
import { GENRES } from "./constants.js";
import { renderHeader, toast, showSpinner, showEmpty } from "./ui.js";
import {
  collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  addDoc, query, where, doc, orderBy
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

renderHeader({ activePage: "index" });

const $ = id => document.getElementById(id);

// ---------- Состояние ----------
let allGames    = [];
let ratingsAll  = [];
let usersMap    = {};
let commentsAll = [];
let currentUser = null;
let isLoading   = false;

// ---------- Auth ----------
watchAuth({
  onLogin: (user) => {
    currentUser = user;
    $("auth-section").classList.add("hidden");
    $("main-section").classList.remove("hidden");
    if (user.email === ADMIN_EMAIL) $("btn-toggle-add").classList.remove("hidden");
    loadAll();
  },
  onLogout: () => {
    currentUser = null;
    $("auth-section").classList.remove("hidden");
    $("main-section").classList.add("hidden");
  }
});

// ---------- Авторизация ----------
$("btn-login").addEventListener("click", async () => {
  $("auth-error").style.color = "var(--danger)";
  $("auth-error").textContent = "";
  try {
    await login($("auth-email").value.trim(), $("auth-pass").value.trim());
  } catch(e) { $("auth-error").textContent = e.message; }
});

$("btn-register").addEventListener("click", async () => {
  $("auth-error").textContent = "";
  try {
    const msg = await register(
      $("auth-email").value.trim(),
      $("auth-pass").value.trim(),
      $("auth-nick").value.trim()
    );
    $("auth-error").style.color = "var(--accent-2)";
    $("auth-error").textContent = msg;
  } catch(e) {
    $("auth-error").style.color = "var(--danger)";
    $("auth-error").textContent = e.message;
  }
});

// ---------- Загрузка ----------
async function loadAll() {
  if (isLoading) return;
  isLoading = true;

  // Жанры в фильтрах
  $("f-category").innerHTML = genreOptions();
  $("filter-category").innerHTML = `<option value="">Все жанры</option>` +
    GENRES.map(g => `<option value="${g}">${g}</option>`).join("");

  showSpinner($("games-grid"));

  try {
    const [gamesSnap, ratSnap, usersSnap, commSnap] = await Promise.all([
      getDocs(collection(db,"games")),
      getDocs(collection(db,"ratings")),
      getDocs(collection(db,"users")),
      getDocs(collection(db,"gameComments")),
    ]);

    allGames    = gamesSnap.docs.map(d => ({ id:d.id, ...d.data() }));
    ratingsAll  = ratSnap.docs.map(d => d.data());
    usersMap    = Object.fromEntries(usersSnap.docs.map(d => [d.data().uid, d.data()]));
    commentsAll = commSnap.docs.map(d => ({ id:d.id, ...d.data() }));

    renderHeroSlider();
    renderFeatured();
    applyFilters();
  } catch(err) {
    console.error(err);
    toast("Ошибка загрузки: " + err.message, "error");
    showEmpty($("games-grid"), "Ошибка загрузки");
  } finally {
    isLoading = false;
  }
}

// ════════════════════════════════════════════
//  HERO СЛАЙДЕР
// ════════════════════════════════════════════
let heroIdx   = 0;
let heroTimer = null;

function renderHeroSlider() {
  const featured = allGames.filter(g => g.featured === "featured");
  // Если не помечено как featured — берём топ-5 по рейтингу
  const slides = featured.length >= 2
    ? featured
    : [...allGames]
        .map(g => {
          const rs = ratingsAll.filter(r => r.gameId === g.id);
          const avg = rs.length ? rs.reduce((s,r)=>s+r.rating,0)/rs.length : 0;
          return { ...g, avg };
        })
        .sort((a,b) => b.avg - a.avg)
        .slice(0, 5);

  if (!slides.length) {
    $("hero-slider").style.display = "none"; return;
  }

  const slidesEl = $("hero-slides");
  const dotsEl   = $("hero-dots");
  slidesEl.innerHTML = "";
  dotsEl.innerHTML   = "";

  slides.forEach((game, i) => {
    const cats = Array.isArray(game.category) ? game.category : [game.category];
    const rs   = ratingsAll.filter(r => r.gameId === game.id);
    const avg  = rs.length ? (rs.reduce((s,r)=>s+r.rating,0)/rs.length).toFixed(1) : null;

    const slide = document.createElement("div");
    slide.className = "hero-slide";
    slide.dataset.gameId = game.id;
    slide.innerHTML = `
      <img class="hero-bg" src="${esc(game.image)}" alt="${esc(game.title)}">
      <div class="hero-gradient"></div>
      <div class="hero-content">
        <div class="hero-tags">
          ${cats.slice(0,3).map(c=>`<span class="hero-tag">${esc(c)}</span>`).join("")}
        </div>
        <h2 class="hero-game-title">${esc(game.title)}</h2>
        ${game.description ? `<p class="hero-desc">${esc(game.description.slice(0,120))}${game.description.length>120?"…":""}</p>` : ""}
        <div class="hero-meta">
          ${avg ? `<span class="hero-rating">⭐ ${avg}</span>` : ""}
          <span class="hero-status hero-status-${(game.status||"").toLowerCase().replace(" ","-")}">${esc(game.status||"")}</span>
        </div>
        <div class="hero-actions">
          <button class="btn btn-primary hero-open-btn" data-id="${esc(game.id)}">📖 Подробнее</button>
          <a class="btn btn-ghost" href="${esc(game.link)}" target="_blank" rel="noopener">⬇ Скачать</a>
        </div>
      </div>`;
    slide.querySelector(".hero-open-btn").addEventListener("click", () => openGameModal(game));
    slidesEl.appendChild(slide);

    const dot = document.createElement("button");
    dot.className = "hero-dot" + (i===0 ? " active" : "");
    dot.addEventListener("click", () => goToSlide(i));
    dotsEl.appendChild(dot);
  });

  goToSlide(0);

  $("hero-prev").addEventListener("click", () => goToSlide((heroIdx - 1 + slides.length) % slides.length));
  $("hero-next").addEventListener("click", () => goToSlide((heroIdx + 1) % slides.length));

  function goToSlide(idx) {
    heroIdx = idx;
    slidesEl.style.transform = `translateX(-${idx * 100}%)`;
    dotsEl.querySelectorAll(".hero-dot").forEach((d,i) => d.classList.toggle("active", i===idx));
    clearInterval(heroTimer);
    heroTimer = setInterval(() => goToSlide((heroIdx+1) % slides.length), 5000);
  }
}

// ════════════════════════════════════════════
//  FEATURED (популярное)
// ════════════════════════════════════════════
function renderFeatured() {
  const carousel = $("featured-carousel");
  const topGames = [...allGames]
    .map(g => {
      const rs = ratingsAll.filter(r => r.gameId === g.id);
      const avg = rs.length ? rs.reduce((s,r)=>s+r.rating,0)/rs.length : 0;
      return { ...g, avg };
    })
    .sort((a,b) => b.avg - a.avg)
    .slice(0, 12);

  if (!topGames.length) { $("featured-section").style.display="none"; return; }

  carousel.innerHTML = "";
  topGames.forEach((game, i) => {
    const card = document.createElement("div");
    card.className = "feat-card";
    card.innerHTML = `
      <img src="${esc(game.image)}" alt="${esc(game.title)}"
           onerror="this.src='https://placehold.co/220x130/1c2030/4f8ef7?text=?'">
      <div class="feat-card-body">
        <div class="feat-rank">#${i+1}</div>
        <h4>${esc(game.title)}</h4>
        ${game.avg ? `<div class="feat-score">\u2B50 ${game.avg.toFixed(1)}</div>` : ""}
      </div>`;
    card.addEventListener("click", () => openGameModal(game));
    carousel.appendChild(card);
  });

  const scrollStep = () => (carousel.querySelector(".feat-card")?.offsetWidth + 12) * 3 || 696;

  const prevBtn = $("feat-prev");
  const nextBtn = $("feat-next");
  const newPrev = prevBtn.cloneNode(true);
  const newNext = nextBtn.cloneNode(true);
  prevBtn.replaceWith(newPrev);
  nextBtn.replaceWith(newNext);

  newPrev.addEventListener("click", () => {
    carousel.scrollBy({ left: -scrollStep(), behavior: "smooth" });
  });
  newNext.addEventListener("click", () => {
    carousel.scrollBy({ left: scrollStep(), behavior: "smooth" });
  });

  const updateArrows = () => {
    newPrev.style.opacity = carousel.scrollLeft <= 0 ? "0.3" : "1";
    newNext.style.opacity = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 4 ? "0.3" : "1";
  };
  carousel.addEventListener("scroll", updateArrows, { passive: true });
  updateArrows();
}

// ════════════════════════════════════════════
//  ФИЛЬТРЫ + РЕНДЕР
// ════════════════════════════════════════════
$("filter-search")?.addEventListener("input",   applyFilters);
$("filter-category")?.addEventListener("change", applyFilters);
$("filter-status")?.addEventListener("change",   applyFilters);
$("filter-sort")?.addEventListener("change",     applyFilters);

function applyFilters() {
  const search   = ($("filter-search")?.value   || "").toLowerCase();
  const category = $("filter-category")?.value  || "";
  const status   = $("filter-status")?.value    || "";
  const sort     = $("filter-sort")?.value      || "default";

  let filtered = allGames.filter(g => {
    const cats = Array.isArray(g.category) ? g.category : [g.category];
    return (
      g.title.toLowerCase().includes(search) &&
      (!category || cats.includes(category)) &&
      (!status   || g.status === status)
    );
  });

  if (sort === "rating") {
    filtered.sort((a,b) => {
      const ra = ratingsAll.filter(r=>r.gameId===a.id);
      const rb = ratingsAll.filter(r=>r.gameId===b.id);
      const avgA = ra.length ? ra.reduce((s,r)=>s+r.rating,0)/ra.length : 0;
      const avgB = rb.length ? rb.reduce((s,r)=>s+r.rating,0)/rb.length : 0;
      return avgB - avgA;
    });
  } else if (sort === "title") {
    filtered.sort((a,b) => a.title.localeCompare(b.title, "ru"));
  }

  renderGames(filtered);
}

function renderGames(games) {
  const grid = $("games-grid");
  if (!games.length) { showEmpty(grid, "Игры не найдены"); return; }
  grid.innerHTML = "";

  for (const game of games) {
    const rs  = ratingsAll.filter(r => r.gameId === game.id);
    const avg = rs.length ? (rs.reduce((s,r)=>s+r.rating,0)/rs.length).toFixed(1) : null;
    const myR = currentUser ? rs.find(r=>r.userId===currentUser.uid)?.rating ?? null : null;
    const cmtCount = commentsAll.filter(c=>c.gameId===game.id).length;
    grid.appendChild(buildCard(game, avg, myR, cmtCount));
  }
}

// ════════════════════════════════════════════
//  КАРТОЧКА В СЕТКЕ
// ════════════════════════════════════════════
function buildCard(game, avg, userRating, cmtCount) {
  const user    = auth.currentUser;
  const isAdmin = user?.email === ADMIN_EMAIL;
  const cats    = Array.isArray(game.category) ? game.category : [game.category];
  const statusClass = {"Пройдена":"done","В процессе":"playing","В планах":"plan"}[game.status]??"";
  const tags = cats.slice(0,3).map(c=>`<span class="tag">${esc(c)}</span>`).join("") +
    (cats.length>3?`<span class="tag">+${cats.length-3}</span>`:"");

  const card = document.createElement("div");
  card.className = "game-card";
  card.dataset.gameId = game.id;
  card.innerHTML = `
    <div class="game-card-img-wrap">
      <img class="game-card-img" src="${esc(game.image)}" alt="${esc(game.title)}"
           onerror="this.src='https://placehold.co/280x200/1c2030/4f8ef7?text=No+Image'">
      <div class="game-card-overlay">
        <button class="btn btn-primary btn-sm gc-open">📖 Подробнее</button>
      </div>
    </div>
    <div class="game-card-body">
      <h3 class="game-card-title">${esc(game.title)}</h3>
      <div class="game-card-meta">${tags}</div>
      <span class="status-badge ${statusClass}">${esc(game.status)}</span>
      <div class="rating-row">
        <span class="label">⭐ Рейтинг</span>
        <span class="value">${avg ?? "—"}</span>
      </div>
      <div class="rating-row">
        <span class="label">💬 Отзывы</span>
        <span class="value">${cmtCount}</span>
      </div>
      ${user ? `
      <div class="rating-row">
        <span class="label">Ваша оценка</span>
        <span class="value js-my-rating">${userRating ?? "—"}</span>
      </div>` : ""}
    </div>
    <div class="game-card-footer">
      ${user && game.status==="Пройдена" ? `
        <select class="card-select js-rate-select" aria-label="Оценка">
          <option value="">⭐ Оценить...</option>
          ${Array.from({length:10},(_,i)=>`<option value="${i+1}" ${userRating===i+1?"selected":""}>${i+1} ⭐</option>`).join("")}
        </select>` : ""}
      <a class="download-btn" href="${esc(game.link)}" target="_blank" rel="noopener">⬇ Скачать / Перейти</a>
      ${isAdmin ? `
        <div class="flex-gap mt-4">
          <button class="btn btn-ghost btn-sm js-edit">✏️ Изменить</button>
          <button class="btn btn-ghost btn-sm js-del-game" style="color:var(--danger)">🗑 Удалить</button>
        </div>` : ""}
    </div>`;

  card.querySelector(".gc-open").addEventListener("click", () => openGameModal(game));
  card.querySelector(".game-card-img-wrap").addEventListener("click", e => {
    if (e.target.closest(".gc-open")) return;
    openGameModal(game);
  });

  card.querySelector(".js-rate-select")?.addEventListener("change", async e => {
    const rating = parseInt(e.target.value);
    if (isNaN(rating) || !user) return;
    await saveRating(game.id, rating);
    const ex = ratingsAll.find(r=>r.gameId===game.id&&r.userId===user.uid);
    if (ex) ex.rating = rating; else ratingsAll.push({gameId:game.id,userId:user.uid,rating});
    card.querySelector(".js-my-rating").textContent = rating;
  });

  card.querySelector(".js-edit")?.addEventListener("click", () => openEditModal(game));
  card.querySelector(".js-del-game")?.addEventListener("click", async () => {
    if (!confirm(`Удалить «${game.title}»?`)) return;
    await deleteDoc(doc(db,"games",game.id));
    allGames = allGames.filter(g=>g.id!==game.id);
    toast("Игра удалена","success");
    applyFilters();
    renderFeatured();
  });

  return card;
}

// ════════════════════════════════════════════
//  СЛУЧАЙНАЯ ИГРА
// ════════════════════════════════════════════
$("btn-random").addEventListener("click", () => {
  const pool = allGames.filter(g => !$("filter-status").value || g.status === $("filter-status").value);
  if (!pool.length) { toast("Нет игр для выбора","error"); return; }
  const game = pool[Math.floor(Math.random() * pool.length)];
  openGameModal(game);
});

// ════════════════════════════════════════════
//  МОДАЛКА КАРТОЧКИ ИГРЫ
// ════════════════════════════════════════════
const modalOverlay = $("game-modal-overlay");
const modalContent = $("game-modal-content");

$("game-modal-close").addEventListener("click", closeGameModal);
modalOverlay.addEventListener("click", e => { if(e.target===modalOverlay) closeGameModal(); });
document.addEventListener("keydown", e => { if(e.key==="Escape") closeGameModal(); });

function closeGameModal() {
  modalOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}

async function openGameModal(game) {
  document.body.style.overflow = "hidden";
  modalOverlay.classList.remove("hidden");
  modalContent.innerHTML = `<div class="spinner" style="margin:60px auto"></div>`;

  // Свежие данные рейтинга для этой игры
  const rs    = ratingsAll.filter(r => r.gameId === game.id);
  const avg   = rs.length ? (rs.reduce((s,r)=>s+r.rating,0)/rs.length).toFixed(1) : null;
  const myR   = currentUser ? rs.find(r=>r.userId===currentUser.uid)?.rating ?? null : null;
  const cats  = Array.isArray(game.category) ? game.category : [game.category];
  const tags  = cats.map(c=>`<span class="tag">${esc(c)}</span>`).join("");
  const isAdmin = auth.currentUser?.email === ADMIN_EMAIL;
  const statusClass = {"Пройдена":"done","В процессе":"playing","В планах":"plan"}[game.status]??"";
  const user  = auth.currentUser;

  // Кто из друзей оценил
  const raterRows = rs.map(r => {
    const u = usersMap[r.userId];
    if (!u) return "";
    return `<div class="rater-row">
      <img src="${esc(u.avatar||"")}" onerror="this.style.display='none'" class="rater-avatar">
      <span>${esc(u.nickname)}</span>
      <span class="rater-score">⭐ ${r.rating}</span>
    </div>`;
  }).join("");

  modalContent.innerHTML = `
    <div class="gm-hero">
      <img class="gm-cover" src="${esc(game.image)}" alt="${esc(game.title)}">
      <div class="gm-hero-gradient"></div>
      <div class="gm-hero-body">
        <div class="gm-tags">${tags}</div>
        <h1 class="gm-title">${esc(game.title)}</h1>
        <div class="gm-meta-row">
          <span class="status-badge ${statusClass}">${esc(game.status||"")}</span>
          ${avg ? `<span class="gm-avg">⭐ ${avg} <small>(${rs.length} оц.)</small></span>` : `<span class="gm-avg-none">Нет оценок</span>`}
        </div>
      </div>
    </div>

    <div class="gm-body">
      <div class="gm-main">
        ${game.description ? `<div class="gm-desc">${esc(game.description)}</div>` : ""}

        <div class="gm-actions">
          <a class="btn btn-primary" href="${esc(game.link)}" target="_blank" rel="noopener">⬇ Скачать / Перейти</a>
          ${isAdmin ? `
            <button class="btn btn-ghost gm-edit-btn">✏️ Редактировать</button>
            <button class="btn btn-ghost gm-del-btn" style="color:var(--danger)">🗑 Удалить</button>` : ""}
        </div>

        ${user && game.status==="Пройдена" ? `
          <div class="gm-rate-wrap">
            <label class="form-label">Ваша оценка</label>
            <div class="star-picker" id="star-picker">
              ${Array.from({length:10},(_,i)=>`
                <button class="star-btn ${myR===i+1?"active":""}" data-val="${i+1}">${i+1}</button>
              `).join("")}
            </div>
            <span class="gm-my-r">${myR ? `Вы поставили: ⭐ ${myR}` : "Не оценено"}</span>
          </div>` : ""}

        <!-- Комментарии -->
        <div class="gm-comments">
          <h3>💬 Комментарии</h3>
          <div id="gm-comments-list"></div>
          ${user ? `
            <div class="gm-comment-form" id="gm-comment-form">
              <textarea id="gm-comment-text" placeholder="Напишите отзыв..." rows="3"></textarea>
              <button class="btn btn-primary btn-sm" id="gm-send-comment">Отправить</button>
            </div>` : `<p class="text-muted">Войдите, чтобы оставить комментарий</p>`}
        </div>
      </div>

      <div class="gm-sidebar">
        <div class="gm-info-box">
          <div class="gm-info-row"><span>Статус</span><strong>${esc(game.status||"—")}</strong></div>
          <div class="gm-info-row"><span>Рейтинг</span><strong>${avg ? `⭐ ${avg}` : "—"}</strong></div>
          <div class="gm-info-row"><span>Оценок</span><strong>${rs.length}</strong></div>
          <div class="gm-info-row"><span>Жанры</span><div>${tags}</div></div>
        </div>

        ${raterRows ? `
          <div class="gm-raters">
            <h4>Оценки игроков</h4>
            ${raterRows}
          </div>` : ""}
      </div>
    </div>`;

  // Star picker
  const starPicker = modalContent.querySelector("#star-picker");
  starPicker?.querySelectorAll(".star-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const val = parseInt(btn.dataset.val);
      await saveRating(game.id, val);
      const ex = ratingsAll.find(r=>r.gameId===game.id&&r.userId===user.uid);
      if (ex) ex.rating=val; else ratingsAll.push({gameId:game.id,userId:user.uid,rating:val});
      starPicker.querySelectorAll(".star-btn").forEach(b => b.classList.toggle("active", parseInt(b.dataset.val)===val));
      modalContent.querySelector(".gm-my-r").textContent = `Вы поставили: ⭐ ${val}`;
      // Обновляем avg в модалке
      const rsNew = ratingsAll.filter(r=>r.gameId===game.id);
      const avgNew = (rsNew.reduce((s,r)=>s+r.rating,0)/rsNew.length).toFixed(1);
      const avgEl = modalContent.querySelector(".gm-avg");
      if (avgEl) avgEl.innerHTML = `⭐ ${avgNew} <small>(${rsNew.length} оц.)</small>`;
    });
    btn.addEventListener("mouseenter", () => {
      const val = parseInt(btn.dataset.val);
      starPicker.querySelectorAll(".star-btn").forEach(b =>
        b.classList.toggle("hover", parseInt(b.dataset.val) <= val)
      );
    });
    btn.addEventListener("mouseleave", () => {
      starPicker.querySelectorAll(".star-btn").forEach(b => b.classList.remove("hover"));
    });
  });

  // Редактирование (admin)
  modalContent.querySelector(".gm-edit-btn")?.addEventListener("click", () => {
    closeGameModal();
    openEditModal(game);
  });
  modalContent.querySelector(".gm-del-btn")?.addEventListener("click", async () => {
    if (!confirm(`Удалить «${game.title}»?`)) return;
    await deleteDoc(doc(db,"games",game.id));
    allGames = allGames.filter(g=>g.id!==game.id);
    closeGameModal();
    toast("Игра удалена","success");
    applyFilters();
  });

  // Загрузить комментарии
  await loadGameComments(game.id);

  // Отправить комментарий
  modalContent.querySelector("#gm-send-comment")?.addEventListener("click", async () => {
    const text = modalContent.querySelector("#gm-comment-text").value.trim();
    if (!text) return;
    const u = usersMap[user.uid] || {};
    await addDoc(collection(db,"gameComments"), {
      gameId: game.id, userId: user.uid,
      nickname: u.nickname||user.email,
      avatar: u.avatar||"",
      text, likes:0, dislikes:0, votes:{},
      createdAt: Date.now()
    });
    modalContent.querySelector("#gm-comment-text").value = "";
    // Обновляем локальный кэш
    const cSnap = await getDocs(query(collection(db,"gameComments"), where("gameId","==",game.id)));
    commentsAll = commentsAll.filter(c=>c.gameId!==game.id);
    cSnap.docs.forEach(d => commentsAll.push({ id:d.id, ...d.data() }));
    await loadGameComments(game.id);
    toast("Комментарий добавлен!","success");
  });
}

async function loadGameComments(gameId) {
  const list = modalContent.querySelector("#gm-comments-list");
  if (!list) return;

  const comments = commentsAll
    .filter(c => c.gameId === gameId)
    .sort((a,b) => (a.createdAt||0)-(b.createdAt||0));

  if (!comments.length) {
    list.innerHTML = `<p class="text-muted" style="margin:12px 0">Комментариев пока нет</p>`;
    return;
  }

  list.innerHTML = "";
  for (const c of comments) {
    const u    = usersMap[c.userId] || {};
    const isMe = auth.currentUser?.uid === c.userId;
    const isAdmin = auth.currentUser?.email === ADMIN_EMAIL;
    const date = c.createdAt ? new Date(c.createdAt).toLocaleDateString("ru",{day:"numeric",month:"short"}) : "";

    const el = document.createElement("div");
    el.className = "gm-comment";
    el.innerHTML = `
      <div class="gm-comment-header">
        <img class="comment-avatar" src="${esc(c.avatar||u.avatar||"")}"
             onerror="this.src='https://placehold.co/32x32/1c2030/4f8ef7?text=?'">
        <span class="comment-author">${esc(c.nickname||u.nickname||"Аноним")}</span>
        <span class="gm-comment-date">${date}</span>
      </div>
      <p class="comment-text">${esc(c.text)}</p>
      <div class="comment-actions">
        <button class="comment-vote js-like">👍 ${c.likes||0}</button>
        <button class="comment-vote js-dislike">👎 ${c.dislikes||0}</button>
        ${isMe||isAdmin ? `<button class="comment-vote js-del-c" style="color:var(--danger)">🗑</button>` : ""}
      </div>`;

    el.querySelector(".js-like").addEventListener("click", async () => {
      await voteComment(c.id, "like");
      await refreshCommentsCache(gameId);
      await loadGameComments(gameId);
    });
    el.querySelector(".js-dislike").addEventListener("click", async () => {
      await voteComment(c.id, "dislike");
      await refreshCommentsCache(gameId);
      await loadGameComments(gameId);
    });
    el.querySelector(".js-del-c")?.addEventListener("click", async () => {
      await deleteDoc(doc(db,"gameComments",c.id));
      commentsAll = commentsAll.filter(x=>x.id!==c.id);
      await loadGameComments(gameId);
    });
    list.appendChild(el);
  }
}

async function refreshCommentsCache(gameId) {
  const snap = await getDocs(query(collection(db,"gameComments"), where("gameId","==",gameId)));
  commentsAll = commentsAll.filter(c=>c.gameId!==gameId);
  snap.docs.forEach(d => commentsAll.push({ id:d.id, ...d.data() }));
}

async function voteComment(commentId, type) {
  const uid = auth.currentUser?.uid; if (!uid) return;
  const ref  = doc(db,"gameComments",commentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const prev = data.votes?.[uid];
  const isLike = type==="like";
  const updates = {};
  if (prev===isLike) {
    updates[`votes.${uid}`]=null;
    updates[isLike?"likes":"dislikes"]=Math.max(0,(data[isLike?"likes":"dislikes"]||0)-1);
  } else {
    updates[`votes.${uid}`]=isLike;
    updates[isLike?"likes":"dislikes"]=(data[isLike?"likes":"dislikes"]||0)+1;
    if (prev!==undefined) updates[!isLike?"likes":"dislikes"]=Math.max(0,(data[!isLike?"likes":"dislikes"]||0)-1);
  }
  await updateDoc(ref, updates);
}

// ════════════════════════════════════════════
//  ДОБАВИТЬ / РЕДАКТИРОВАТЬ ИГРУ
// ════════════════════════════════════════════
$("btn-toggle-add")?.addEventListener("click", () => $("add-form-wrap").classList.toggle("hidden"));

$("add-game-form").addEventListener("submit", async e => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user||user.email!==ADMIN_EMAIL) return;
  const title    = $("f-title").value.trim();
  const category = Array.from($("f-category").selectedOptions).map(o=>o.value);
  const link     = $("f-link").value.trim();
  const image    = $("f-image").value.trim();
  const status   = $("f-status").value;
  const desc     = $("f-desc").value.trim();
  const featured = $("f-featured").value;
  if (!title||!category.length||!link||!image||!status) { toast("Заполните поля","error"); return; }
  try {
    const id = toSlug(title);
    await setDoc(doc(db,"games",id), { title, category, link, image, status, description:desc, featured });
    e.target.reset();
    $("add-form-wrap").classList.add("hidden");
    toast("Игра добавлена!","success");
    loadAll();
  } catch(err) { toast(err.message,"error"); }
});

function openEditModal(game) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:560px">
      <button class="modal-close">✕</button>
      <div class="modal-body">
        <h2>✏️ Редактировать «${esc(game.title)}»</h2>
        <form class="edit-game-form" style="margin-top:16px;display:flex;flex-direction:column;gap:14px">
          <div class="form-group"><label class="form-label">Название</label>
            <input type="text" name="title" value="${esc(game.title)}" required /></div>
          <div class="form-group"><label class="form-label">Описание</label>
            <textarea name="description" rows="3">${esc(game.description||"")}</textarea></div>
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
          <div class="form-group"><label class="form-label">В слайдере</label>
            <select name="featured">
              <option value="" ${!game.featured?"selected":""}>Нет</option>
              <option value="featured" ${game.featured==="featured"?"selected":""}>Да</option>
            </select></div>
          <div class="form-group"><label class="form-label">Жанры (Ctrl+клик)</label>
            <select name="category" multiple class="multi-select">${genreOptions(game.category)}</select></div>
          <button type="submit" class="btn btn-primary">Сохранить</button>
        </form>
      </div>
    </div>`;

  overlay.querySelector(".modal-close").onclick = () => overlay.remove();
  overlay.addEventListener("click", e => { if(e.target===overlay) overlay.remove(); });

  overlay.querySelector(".edit-game-form").addEventListener("submit", async e => {
    e.preventDefault();
    const fd = e.target;
    try {
      const updated = {
        title:       fd.title.value.trim(),
        description: fd.description.value.trim(),
        image:       fd.image.value.trim(),
        link:        fd.link.value.trim(),
        status:      fd.status.value,
        featured:    fd.featured.value,
        category:    Array.from(fd.category.selectedOptions).map(o=>o.value),
      };
      await updateDoc(doc(db,"games",game.id), updated);
      const idx = allGames.findIndex(g=>g.id===game.id);
      if (idx!==-1) allGames[idx] = {...allGames[idx],...updated};
      overlay.remove();
      toast("Обновлено!","success");
      applyFilters();
      renderHeroSlider();
      renderFeatured();
    } catch(err) { toast(err.message,"error"); }
  });

  document.body.appendChild(overlay);
}

// ════════════════════════════════════════════
//  СОХРАНИТЬ РЕЙТИНГ
// ════════════════════════════════════════════
async function saveRating(gameId, rating) {
  const user = auth.currentUser; if (!user) return;
  const q    = query(collection(db,"ratings"), where("gameId","==",gameId), where("userId","==",user.uid));
  const snap = await getDocs(q);
  if (!snap.empty) await updateDoc(snap.docs[0].ref, { rating });
  else await addDoc(collection(db,"ratings"), { userId:user.uid, gameId, rating });
  toast("Оценка сохранена!","success");
}
