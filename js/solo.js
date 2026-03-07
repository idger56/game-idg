// ============================================================
//  solo.js — соло-игры (без id-селекторов со спецсимволами)
// ============================================================
import { db, auth, ADMIN_EMAIL } from "./firebase.js";
import { watchAuth } from "./auth.js";
import { esc, toSlug, genreOptions } from "./utils.js";
import { GENRES } from "./constants.js";
import { renderHeader, toast, showSpinner, showEmpty } from "./ui.js";
import {
  collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, doc
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

renderHeader({ activePage: "solo" });

const $ = id => document.getElementById(id);

// Заполняем жанры
const fCat = $("f-category");
if (fCat) fCat.innerHTML = genreOptions();
const filterCat = $("filter-category");
if (filterCat) filterCat.innerHTML =
  `<option value="">Все жанры</option>` +
  GENRES.map(g => `<option value="${g}">${g}</option>`).join("");

// -------- Состояние --------
let allGames   = [];
let soloRatAll = [];   // все рейтинги — загружаем один раз
let myStatuses = {};   // gameId → status
let myRatings  = {};   // gameId → rating
let currentUser = null;
let isLoading   = false;

const statusDocId = (uid, gid) => `${uid}_${gid}`;
const ratingDocId = (uid, gid) => `${uid}_${gid}`;

// -------- Auth --------
watchAuth({
  onLogin: async (user) => {
    currentUser = user;
    $("auth-wall")?.classList.add("hidden");
    $("main-section")?.classList.remove("hidden");
    if (user.email === ADMIN_EMAIL) $("btn-toggle-add")?.classList.remove("hidden");
    await preloadUserData(user.uid);
    loadGames();
  },
  onLogout: () => {
    currentUser = null;
    $("main-section")?.classList.add("hidden");
    $("auth-wall")?.classList.remove("hidden");
  }
});

async function preloadUserData(uid) {
  const [statSnap, ratSnap] = await Promise.all([
    getDocs(query(collection(db,"soloStatuses"), where("userId","==",uid))),
    getDocs(query(collection(db,"soloRatings"),  where("userId","==",uid))),
  ]);
  myStatuses = Object.fromEntries(statSnap.docs.map(d => [d.data().gameId, d.data().status]));
  myRatings  = Object.fromEntries(ratSnap.docs.map(d => [d.data().gameId, d.data().rating]));
}

async function saveStatus(uid, gameId, status) {
  await setDoc(doc(db,"soloStatuses", statusDocId(uid,gameId)), {
    userId: uid, gameId, status, updatedAt: Date.now()
  });
  myStatuses[gameId] = status;
  if (status !== "Пройдена") {
    await deleteDoc(doc(db,"soloRatings", ratingDocId(uid,gameId))).catch(()=>{});
    delete myRatings[gameId];
  }
}

async function saveRating(uid, gameId, rating) {
  await setDoc(doc(db,"soloRatings", ratingDocId(uid,gameId)), {
    userId: uid, gameId, rating, updatedAt: Date.now()
  });
  myRatings[gameId] = rating;
  // Обновляем локальный кэш
  const ex = soloRatAll.find(r => r.gameId === gameId && r.userId === uid);
  if (ex) ex.rating = rating;
  else soloRatAll.push({ gameId, userId: uid, rating });
}

// -------- Форма добавления --------
$("btn-toggle-add")?.addEventListener("click", () =>
  $("add-form-wrap")?.classList.toggle("hidden")
);

$("add-game-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user || user.email !== ADMIN_EMAIL) return;

  const title    = $("f-title").value.trim();
  const category = Array.from($("f-category").selectedOptions).map(o=>o.value);
  const link     = $("f-link").value.trim();
  const image    = $("f-image").value.trim();
  const desc     = $("f-desc").value.trim();

  if (!title || !category.length || !link || !image) {
    toast("Заполните обязательные поля","error"); return;
  }
  try {
    await setDoc(doc(db,"soloGames", toSlug(title)), { title, category, link, image, description: desc });
    e.target.reset();
    $("add-form-wrap").classList.add("hidden");
    toast("Игра добавлена!","success");
    loadGames();
  } catch(err) { toast(err.message,"error"); }
});

// -------- Загрузка --------
async function loadGames() {
  if (isLoading) return;
  isLoading = true;
  showSpinner($("games-grid"));
  try {
    const [gamesSnap, ratSnap] = await Promise.all([
      getDocs(collection(db,"soloGames")),
      getDocs(collection(db,"soloRatings")),
    ]);
    allGames   = gamesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    soloRatAll = ratSnap.docs.map(d => d.data());
    applyFilters();
  } catch(err) {
    toast("Ошибка загрузки: " + err.message, "error");
    showEmpty($("games-grid"), "Ошибка загрузки");
  } finally {
    isLoading = false;
  }
}

// -------- Фильтры --------
$("filter-search")?.addEventListener("input",   applyFilters);
$("filter-category")?.addEventListener("change", applyFilters);
$("filter-status")?.addEventListener("change",   applyFilters);

function applyFilters() {
  const search   = ($("filter-search")?.value  || "").toLowerCase();
  const category = $("filter-category")?.value || "";
  const status   = $("filter-status")?.value   || "";

  let filtered = allGames.filter(g => {
    const cats = Array.isArray(g.category) ? g.category : [g.category];
    return (
      g.title.toLowerCase().includes(search) &&
      (!category || cats.includes(category))
    );
  });

  if (status && currentUser) {
    filtered = filtered.filter(g => (myStatuses[g.id]||"") === status);
  }

  renderGames(filtered);
}

// -------- Рендер (синхронный) --------
function renderGames(games) {
  const grid = $("games-grid");
  if (!games.length) { showEmpty(grid,"Игры не найдены"); return; }
  grid.innerHTML = "";

  for (const game of games) {
    const rs  = soloRatAll.filter(r => r.gameId === game.id);
    const avg = rs.length ? (rs.reduce((s,r)=>s+r.rating,0)/rs.length).toFixed(1) : null;
    grid.appendChild(buildCard(game, avg));
  }
}

// -------- Карточка (без id-селекторов!) --------
function buildCard(game, avg) {
  const user     = auth.currentUser;
  const cats     = Array.isArray(game.category) ? game.category : [game.category];
  const myStatus = myStatuses[game.id] || "";
  const myRating = myRatings[game.id] ?? null;

  const tagsHtml = cats.slice(0,3).map(c=>`<span class="tag">${esc(c)}</span>`).join("") +
    (cats.length>3?`<span class="tag">+${cats.length-3}</span>`:"");

  const card = document.createElement("div");
  card.className = "game-card";
  card.dataset.gameId = game.id;

  card.innerHTML = `
    <img class="game-card-img" src="${esc(game.image)}" alt="${esc(game.title)}"
         onerror="this.src='https://placehold.co/280x200/1c2030/4f8ef7?text=No+Image'">
    <div class="game-card-body">
      <h3 class="game-card-title">${esc(game.title)}</h3>
      <div class="game-card-meta">${tagsHtml}</div>
      <div class="rating-row">
        <span class="label">⭐ Средняя оценка</span>
        <span class="value">${avg ?? "—"}</span>
      </div>
      <div class="rating-row">
        <span class="label">Ваша оценка</span>
        <span class="value js-my-rating">${myRating ?? "—"}</span>
      </div>
    </div>
    <div class="game-card-footer">
      ${user ? `
        <select class="card-select js-status-sel" aria-label="Ваш статус">
          <option value="">— Ваш статус —</option>
          <option value="Пройдена"   ${myStatus==="Пройдена"?"selected":""}>✅ Пройдена</option>
          <option value="В процессе" ${myStatus==="В процессе"?"selected":""}>🎮 В процессе</option>
          <option value="В планах"   ${myStatus==="В планах"?"selected":""}>📌 В планах</option>
        </select>
        ${myStatus==="Пройдена" ? `
          <select class="card-select js-rate-sel" aria-label="Оценить">
            <option value="">⭐ Оценить...</option>
            ${Array.from({length:10},(_,i)=>`
              <option value="${i+1}" ${myRating===i+1?"selected":""}>${i+1} ⭐</option>
            `).join("")}
          </select>
        ` : ""}
      ` : ""}
      <a class="download-btn" href="${esc(game.link)}" target="_blank" rel="noopener">⬇ Перейти</a>
      <div class="flex-gap mt-4">
        <button class="btn btn-ghost btn-sm js-details">💬 Детали</button>
        ${user?.email===ADMIN_EMAIL ? `<button class="btn btn-ghost btn-sm js-edit">✏️ Ред.</button>` : ""}
      </div>
    </div>`;

  // Смена статуса
  card.querySelector(".js-status-sel")?.addEventListener("change", async e => {
    const newStatus = e.target.value;
    await saveStatus(user.uid, game.id, newStatus);
    toast("Статус обновлён","success");
    applyFilters(); // перерисовываем
  });

  // Оценка
  card.querySelector(".js-rate-sel")?.addEventListener("change", async e => {
    const r = parseInt(e.target.value);
    if (isNaN(r)) return;
    await saveRating(user.uid, game.id, r);
    card.querySelector(".js-my-rating").textContent = r;
    toast("Оценка сохранена","success");
  });

  // Детали
  card.querySelector(".js-details")?.addEventListener("click", () => openMiniModal(game));

  // Редактирование
  card.querySelector(".js-edit")?.addEventListener("click", () => openEditModal(game));

  return card;
}

// -------- Модалка деталей + комментарии --------
async function openMiniModal(game) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="modal">
      <button class="modal-close">✕</button>
      <img class="modal-cover" src="${esc(game.image)}" alt="${esc(game.title)}">
      <div class="modal-body">
        <h2>${esc(game.title)}</h2>
        <p>${esc(game.description || "Описание отсутствует.")}</p>
        <div class="comments-section" id="comments-wrap-modal">
          <div class="spinner"></div>
        </div>
      </div>
    </div>`;

  overlay.querySelector(".modal-close").onclick = () => overlay.remove();
  overlay.addEventListener("click", e => { if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);

  await loadComments(game.id, overlay.querySelector("#comments-wrap-modal"), game);
}

async function loadComments(gameId, wrap, game) {
  wrap.innerHTML = `<h3 style="margin-bottom:14px">Комментарии</h3>`;

  const [commSnap, usersSnap] = await Promise.all([
    getDocs(query(collection(db,"soloComments"), where("gameId","==",gameId))),
    getDocs(collection(db,"users")),
  ]);

  const usersMap = Object.fromEntries(usersSnap.docs.map(d=>[d.data().uid, d.data()]));
  const comments = commSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (a.createdAt||0) - (b.createdAt||0));

  if (!comments.length) {
    wrap.innerHTML += `<p class="text-muted">Комментариев пока нет. Будьте первым!</p>`;
  } else {
    for (const c of comments) {
      const u    = usersMap[c.userId] || {};
      const isMe = auth.currentUser?.uid === c.userId;

      const el = document.createElement("div");
      el.className = "comment-item";
      el.innerHTML = `
        <div class="comment-header">
          <img class="comment-avatar" src="${esc(u.avatar||"")}" alt=""
               onerror="this.src='https://placehold.co/28x28/1c2030/4f8ef7?text=?'">
          <span class="comment-author">${esc(u.nickname||"Аноним")}</span>
        </div>
        <p class="comment-text">${esc(c.text)}</p>
        <div class="comment-actions">
          <button class="comment-vote js-like">👍 ${c.likes||0}</button>
          <button class="comment-vote js-dislike">👎 ${c.dislikes||0}</button>
          ${isMe ? `
            <button class="comment-vote js-del">🗑 Удалить</button>
            <button class="comment-vote js-edit-c">✏️ Изменить</button>
          ` : ""}
        </div>`;

      el.querySelector(".js-like")?.addEventListener("click", async () => {
        await voteComment(c.id,"like");
        await loadComments(gameId, wrap, game);
      });
      el.querySelector(".js-dislike")?.addEventListener("click", async () => {
        await voteComment(c.id,"dislike");
        await loadComments(gameId, wrap, game);
      });
      el.querySelector(".js-del")?.addEventListener("click", async () => {
        await deleteDoc(doc(db,"soloComments",c.id));
        await loadComments(gameId, wrap, game);
      });
      el.querySelector(".js-edit-c")?.addEventListener("click", () =>
        showCommentForm(wrap, game, c, () => loadComments(gameId, wrap, game))
      );
      wrap.appendChild(el);
    }
  }

  if (auth.currentUser) {
    const myComment = comments.find(c => c.userId === auth.currentUser.uid);
    if (!myComment) showCommentForm(wrap, game, null, () => loadComments(gameId, wrap, game));
  }
}

function showCommentForm(wrap, game, existing, onDone) {
  wrap.querySelector(".comment-form")?.remove();

  const form = document.createElement("div");
  form.className = "comment-form";
  form.innerHTML = `
    <textarea placeholder="Напишите комментарий...">${esc(existing?.text||"")}</textarea>
    <div class="flex-gap">
      <button class="btn btn-primary btn-sm js-save-comment">Сохранить</button>
      ${existing ? `<button class="btn btn-ghost btn-sm js-cancel-comment">Отмена</button>` : ""}
    </div>`;

  form.querySelector(".js-cancel-comment")?.addEventListener("click", () => form.remove());

  form.querySelector(".js-save-comment").addEventListener("click", async () => {
    const text = form.querySelector("textarea").value.trim();
    if (!text) return;
    const uid  = auth.currentUser.uid;
    const snap = await getDoc(doc(db,"users",uid));
    const u    = snap.exists() ? snap.data() : {};

    if (existing) {
      await updateDoc(doc(db,"soloComments",existing.id), { text });
    } else {
      const q = query(collection(db,"soloComments"),
        where("userId","==",uid), where("gameId","==",game.id));
      const check = await getDocs(q);
      if (!check.empty) {
        await updateDoc(check.docs[0].ref, { text });
      } else {
        await setDoc(doc(collection(db,"soloComments")), {
          userId: uid, gameId: game.id, text,
          nickname: u.nickname||"", avatar: u.avatar||"",
          likes:0, dislikes:0, votes:{}, createdAt: Date.now()
        });
      }
    }
    form.remove();
    onDone?.();
  });

  wrap.appendChild(form);
}

async function voteComment(commentId, type) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const ref  = doc(db,"soloComments",commentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const prev = data.votes?.[uid];
  const isLike = type === "like";

  const updates = {};
  if (prev === isLike) {
    updates[`votes.${uid}`] = null;
    updates[isLike?"likes":"dislikes"] = Math.max(0,(data[isLike?"likes":"dislikes"]||0)-1);
  } else {
    updates[`votes.${uid}`] = isLike;
    updates[isLike?"likes":"dislikes"] = (data[isLike?"likes":"dislikes"]||0)+1;
    if (prev !== undefined) {
      updates[!isLike?"likes":"dislikes"] = Math.max(0,(data[!isLike?"likes":"dislikes"]||0)-1);
    }
  }
  await updateDoc(ref, updates);
}

// -------- Редактирование (admin) --------
function openEditModal(game) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px">
      <button class="modal-close">✕</button>
      <div class="modal-body">
        <h2>✏️ Редактировать</h2>
        <form class="solo-edit-form" style="margin-top:16px;display:flex;flex-direction:column;gap:14px">
          <div class="form-group"><label class="form-label">Название</label>
            <input type="text" name="title" value="${esc(game.title)}" required /></div>
          <div class="form-group"><label class="form-label">Обложка</label>
            <input type="url" name="image" value="${esc(game.image)}" required /></div>
          <div class="form-group"><label class="form-label">Ссылка</label>
            <input type="url" name="link" value="${esc(game.link)}" required /></div>
          <div class="form-group"><label class="form-label">Описание</label>
            <textarea name="description" rows="3">${esc(game.description||"")}</textarea></div>
          <div class="form-group"><label class="form-label">Жанры</label>
            <select name="category" multiple class="multi-select">${genreOptions(game.category||[])}</select></div>
          <button type="submit" class="btn btn-primary">Сохранить</button>
        </form>
      </div>
    </div>`;

  overlay.querySelector(".modal-close").onclick = () => overlay.remove();
  overlay.addEventListener("click", e => { if(e.target===overlay) overlay.remove(); });

  overlay.querySelector(".solo-edit-form").addEventListener("submit", async e => {
    e.preventDefault();
    const fd = e.target;
    try {
      await updateDoc(doc(db,"soloGames",game.id), {
        title:       fd.title.value.trim(),
        image:       fd.image.value.trim(),
        link:        fd.link.value.trim(),
        description: fd.description.value.trim(),
        category:    Array.from(fd.category.selectedOptions).map(o=>o.value),
      });
      overlay.remove();
      toast("Обновлено!","success");
      loadGames();
    } catch(err) { toast(err.message,"error"); }
  });

  document.body.appendChild(overlay);
}
