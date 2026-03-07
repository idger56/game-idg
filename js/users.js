// ============================================================
//  users.js — страница пользователей
// ============================================================
import { db, auth } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import { esc, calcUserStats, formatLastSeen, isOnline } from "./utils.js";
import { GENRES } from "./constants.js";
import { renderHeader, toast } from "./ui.js";
import { renderAchievements, renderBadges, medalIcons, statsToAchievementInput } from "./achievements.js";
import {
  collection, getDocs, getDoc, updateDoc,
  query, where, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

renderHeader({ activePage: "users" });

const $ = id => document.getElementById(id);

let currentUser = null;
let totalGames  = 0;

// ---------- Auth ----------
watchAuth({
  onLogin: async (user, userData) => {
    currentUser = user;
    await loadPage(user, userData);
  },
  onLogout: () => {
    currentUser = null;
    renderNoAuth();
    loadOtherUsers(null);
  }
});

// ---------- Загрузка ----------
async function loadPage(user, userData) {
  const [gamesSnap, ratingsSnap] = await Promise.all([
    getDocs(collection(db,"games")),
    getDocs(query(collection(db,"ratings"), where("userId","==",user.uid))),
  ]);

  totalGames = gamesSnap.size;
  const gamesArr = gamesSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  const ratings  = ratingsSnap.docs.map(d => d.data());
  const stats    = calcUserStats(ratings, gamesArr, totalGames, userData.favoriteGenre);

  renderMyProfile(user, userData, stats);
  await loadOtherUsers(user.uid);
}

// ---------- Мой профиль ----------
function renderMyProfile(user, data, stats) {
  const section = $("my-profile-section");
  const lastMs  = typeof data.lastSeen === "number" ? data.lastSeen : null;
  const online  = isOnline(lastMs);
  const achInput = statsToAchievementInput(stats);

  section.innerHTML = `
    <div class="my-profile-card">
      <img class="my-profile-avatar" src="${esc(data.avatar||"assets/default-avatar.png")}" alt=""
           onerror="this.onerror=null;this.src='assets/default-avatar.png'">
      <div class="my-profile-body">
        <h2>${esc(data.nickname||"Пользователь")}</h2>
        <div class="profile-status">
          <span class="status-dot ${online?"online":"offline"}"></span>
          <span style="color:var(--${online?"online":"offline"})">${online?"Онлайн":formatLastSeen(lastMs)}</span>
        </div>
        <p class="profile-quote">${esc(data.quote || "Цитата не указана")}</p>

        <div class="profile-stats-row">
          <div class="stat-box"><div class="num">${stats.avgRating??0}</div><div class="lbl">Ср. оценка</div></div>
          <div class="stat-box"><div class="num">${stats.percentComplete}%</div><div class="lbl">Пройдено</div></div>
          <div class="stat-box"><div class="num">${stats.ratingsCount}</div><div class="lbl">Оценок</div></div>
          <div class="stat-box"><div class="num">${stats.genresCount}</div><div class="lbl">Жанров</div></div>
        </div>

        <div id="my-badges"></div>

        <div class="edit-profile-fields">
          <div class="form-group">
            <label class="form-label">Аватар (URL)</label>
            <input type="url" id="inp-avatar" value="${esc(data.avatar||"")}" placeholder="https://..." />
          </div>
          <div class="form-group">
            <label class="form-label">Цитата</label>
            <input type="text" id="inp-quote" value="${esc(data.quote||"")}" placeholder="Что-то о себе..." />
          </div>
          <div class="form-group">
            <label class="form-label">Любимый жанр</label>
            <select id="inp-genre">
              <option value="">— Выберите —</option>
              ${GENRES.map(g=>`<option value="${g}" ${g===data.favoriteGenre?"selected":""}>${g}</option>`).join("")}
            </select>
          </div>
          <div class="flex-gap">
            <button class="btn btn-primary btn-sm" id="btn-save-profile">💾 Сохранить</button>
            <a href="profile.html?uid=${user.uid}" class="btn btn-ghost btn-sm">👤 Мой профиль</a>
          </div>
        </div>
      </div>
    </div>`;

  renderBadges($("my-badges"), achInput);

  $("btn-save-profile").addEventListener("click", async () => {
    const avatar = $("inp-avatar").value.trim();
    const quote  = $("inp-quote").value.trim();
    const genre  = $("inp-genre").value;
    try {
      await updateDoc(doc(db,"users",user.uid), {
        avatar: avatar||data.avatar||null,
        quote,
        favoriteGenre: genre||null,
      });
      toast("Профиль сохранён!","success");
      location.reload();
    } catch(e) { toast(e.message,"error"); }
  });
}

function renderNoAuth() {
  $("my-profile-section").innerHTML = `
    <div class="my-profile-card">
      <div class="my-profile-body" style="text-align:center;padding:40px 20px">
        <div style="font-size:3rem;margin-bottom:12px">👤</div>
        <h2 style="margin-bottom:8px">Вы не вошли</h2>
        <p class="profile-quote">Войдите, чтобы видеть свой профиль</p>
        <a href="index.html" class="btn btn-primary mt-16">Войти</a>
      </div>
    </div>`;
}

// ---------- Другие пользователи ----------
async function loadOtherUsers(currentUid) {
  const list = $("users-list");
  list.innerHTML = `<div class="spinner"></div>`;

  const [usersSnap, gamesSnap, ratingsSnap] = await Promise.all([
    getDocs(collection(db,"users")),
    getDocs(collection(db,"games")),
    getDocs(collection(db,"ratings")),
  ]);

  const gamesArr   = gamesSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  const ratingsAll = ratingsSnap.docs.map(d => d.data());
  const total      = gamesSnap.size;

  list.innerHTML = "";

  for (const snap of usersSnap.docs) {
    const u = snap.data();
    if (u.uid === currentUid) continue;

    const ratings   = ratingsAll.filter(r => r.userId === u.uid);
    const stats     = calcUserStats(ratings, gamesArr, total, u.favoriteGenre);
    const achInput  = statsToAchievementInput(stats);
    const lastMs    = typeof u.lastSeen === "number" ? u.lastSeen : null;
    const online    = isOnline(lastMs);
    const medals    = medalIcons(achInput, 4);

    const card = document.createElement("div");
    card.className = "user-card";
    card.innerHTML = `
      <img class="user-card-avatar" src="${esc(u.avatar||"assets/default-avatar.png")}" alt=""
           onerror="this.onerror=null;this.src='assets/default-avatar.png'">
      <div class="user-card-info">
        <h4>${esc(u.nickname||"Пользователь")}</h4>
        <div class="profile-status mt-4">
          <span class="status-dot ${online?"online":"offline"}"></span>
          <span class="meta" style="color:var(--${online?"online":"offline"})">${online?"Онлайн":formatLastSeen(lastMs)}</span>
        </div>
        <div class="meta" style="margin-top:4px">
          Пройдено: <strong>${stats.percentComplete}%</strong> ·
          Оценок: <strong>${stats.ratingsCount}</strong>
        </div>
        <p class="quote">${esc(u.quote||"—")}</p>
        <a href="profile.html?uid=${u.uid}" class="btn btn-ghost btn-sm" style="margin-top:8px;display:inline-flex">
          👤 Профиль
        </a>
      </div>
      <div class="user-medals">${medals}</div>`;

    list.appendChild(card);
  }

  if (!list.children.length) {
    list.innerHTML = `<p class="text-muted">Других пользователей нет</p>`;
  }
}
