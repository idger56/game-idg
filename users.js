// users.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

/* ========== CONFIG ========== */
const firebaseConfig = {
  apiKey: "AIzaSyBNuHz-OPbVWHoc7gtuxHU21-CC5TbYKbw",
  authDomain: "game-idg.firebaseapp.com",
  projectId: "game-idg",
  storageBucket: "game-idg.appspot.com",
  messagingSenderId: "987199066254",
  appId: "1:987199066254:web:ed82cea15f4a7b7a4279df",
  measurementId: "G-QLLFXDHX51"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ========== DOM ========== */
const nicknameSpan = document.getElementById("user-nickname");
const myProfileDiv = document.getElementById("my-profile");
const usersGrid = document.getElementById("users-grid");
const authBtn = document.getElementById("auth-btn");

/* ========== HELPERS (MEDALS) ========== */
// Medals stored in assets/medals/<key>/{gold,silver,bronze,locked}.png
function getMedalLevel(value, bronze, silver, gold) {
  if (value >= gold) return { level: "Золото" };
  if (value >= silver) return { level: "Серебро" };
  if (value >= bronze) return { level: "Бронза" };
  return { level: "Нет" };
}

function getMedalIconPath(key, level) {
  const base = `assets/medals/${key}`;
  switch (level) {
    case "Золото": return `${base}/gold.png`;
    case "Серебро": return `${base}/silver.png`;
    case "Бронза": return `${base}/bronze.png`;
    default: return `${base}/locked.png`;
  }
}

/* ========== small util: russian plural (минут/часов) ========== */
function ruPlural(n, forms){
  // forms: [singular, paucal(2-4), plural]
  n = Math.abs(n) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

/* format last seen from millis => human string */
function formatLastSeenFromMillis(lastMillis){
  if (!lastMillis) return "—";
  const diff = Date.now() - lastMillis;
  if (diff < 0) return "—";
  // online threshold 5 minutes
  if (diff < 1 * 60 * 1000) return "Онлайн";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) {
    return `Был в сети ${mins} ${ruPlural(mins,['минута','минуты','минут'])} назад`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `Был в сети ${hours} ${ruPlural(hours,['час','часа','часов'])} назад`;
  }
  const days = Math.floor(hours / 24);
  return `Был в сети ${days} ${ruPlural(days,['день','дня','дней'])} назад`;
}

/* ========= AUTH BUTTON (LOGOUT -> index.html) ========== */
if (auth.currentUser) {
  try {
    await updateDoc(doc(db, "users", auth.currentUser.uid), { lastActive: serverTimestamp() });
  } catch(e) {
    console.warn("Не удалось обновить lastActive при выходе", e);
  }
  signOut(auth).then(() => {
    window.location.href = "index.html";
  }).catch(e => {
    console.error("Sign out error:", e);
    window.location.href = "index.html";
  });
}

if (authBtn) {
  authBtn.addEventListener("click", async () => {
    if (auth.currentUser) {
      try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { lastActive: serverTimestamp() });
      } catch (e) {
        console.warn("Не удалось обновить lastActive при выходе", e);
      }
      signOut(auth).then(() => {
        window.location.href = "index.html";
      }).catch(() => {
        window.location.href = "index.html";
      });
    } else {
      window.location.href = "index.html";
    }
  });
}


/* ========== MAIN: onAuthStateChanged ========== */
onAuthStateChanged(auth, async (user) => {
  // load total games count for percents
  if (authBtn) {
  authBtn.textContent = user ? "Выход" : "Вход";
}

  const allGamesSnapshot = await getDocs(collection(db, "games"));
  const totalGames = allGamesSnapshot.size || 0;

  if (!user) {
    myProfileDiv.innerHTML = `<div class="my-profile-expanded game-card" style="grid-column:1 / -1; padding:18px;">
      <div style="width:100%; text-align:center;">Войдите, чтобы увидеть и редактировать свой профиль.</div>
    </div>`;
    await loadOtherUsers(null, totalGames);
    nicknameSpan.style.display = "none";
    return;
  }

 if (user) {
    // обновляем сразу при входе
    try {
      await updateDoc(doc(db, "users", user.uid), { lastActive: serverTimestamp() });
    } catch(e) {}

    // уже есть setInterval, обновляющий каждые 30 сек
    setInterval(async () => {
      try {
        await updateDoc(doc(db, "users", user.uid), { lastActive: serverTimestamp() });
      } catch (e) {}
    }, 30000);
  }


window.addEventListener("beforeunload", async () => {
  if (auth.currentUser) {
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), { lastActive: serverTimestamp() });
    } catch (e) {}
  }
});

  // fetch my user doc by uid
  const q = query(collection(db, "users"), where("uid", "==", user.uid));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    myProfileDiv.innerHTML = `<div class="my-profile-expanded game-card" style="grid-column:1 / -1; padding:18px;">
      <div style="width:100%; text-align:center;">Профиль не найден в базе. Если вы только что зарегистрировались, попробуйте войти снова.</div>
    </div>`;
    await loadOtherUsers(user.uid, totalGames);
    return;
  }

  const myDoc = snapshot.docs[0];
  const myData = myDoc.data();
  const myDocId = myDoc.id;

  nicknameSpan.textContent = `👤 ${myData.nickname || user.email}`;
  nicknameSpan.style.display = "inline-block";

  // user ratings to compute average & percent
  const userRatingsSnapshot = await getDocs(query(collection(db, "ratings"), where("userId", "==", user.uid)));
  const userRatings = userRatingsSnapshot.docs.map(d => d.data());
  const avgRating = userRatings.length
    ? (userRatings.reduce((a, b) => a + b.rating, 0) / userRatings.length).toFixed(1)
    : "—";
  const percentComplete = totalGames ? Math.round((userRatings.length / totalGames) * 100) : 0;

  // compute genre count
  const gamesSnap = allGamesSnapshot; // already fetched
  const gamesArr = gamesSnap.docs.map(g => ({ id: g.id, ...g.data() }));
  const genresSet = new Set();
  userRatings.forEach(r => {
    const g = gamesArr.find(x => x.id === r.gameId);
    if (g && g.category) {
      if (Array.isArray(g.category)) g.category.forEach(c => genresSet.add(c));
      else genresSet.add(g.category);
    }
  });

  // render big expanded profile on top (full width)
  renderMyProfile(myData, {
    avgRating,
    percentComplete,
    ratingsCount: userRatings.length,
    genresCount: genresSet.size,
    totalGames
  }, myDocId);

  // then list other users
  await loadOtherUsers(user.uid, totalGames);
});

/* ========== renderMyProfile (новая верстка / поведение) ========== */
function renderMyProfile(userData, stats, docId) {
  const avatar = userData.avatar || "assets/default-avatar.png"; // local placeholder if you have it

  // lastActive in millis (if exists)
  let lastActiveMillis = null;
  if (userData.lastActive && typeof userData.lastActive.toMillis === "function") {
    lastActiveMillis = userData.lastActive.toMillis();
  } else if (typeof userData.lastActive === "number") {
    lastActiveMillis = userData.lastActive;
  }

  myProfileDiv.innerHTML = `
    <div class="my-profile-expanded">
      <div class="profile-avatar">
        <img id="my-avatar-img" src="${avatar}" alt="Аватар" onerror="this.onerror=null; this.src='assets/default-avatar.png'">
      </div>

      <div class="profile-info">
        <div>
          <h2 id="self-nickname">${userData.nickname || "Пользователь"}</h2>
          <div class="profile-meta">
            <div class="mini-muted">Средняя оценка: <strong>${stats.avgRating}</strong></div>
            <div class="mini-muted">Пройдено: <strong>${stats.percentComplete}%</strong></div>
            <div id="self-status" class="self-status status ${ (lastActiveMillis && (Date.now() - lastActiveMillis) < 5*60*1000) ? 'online' : 'offline' }" data-lastactive="${ lastActiveMillis || '' }">
              ${ formatLastSeenFromMillis(lastActiveMillis) }
            </div>
          </div>
          <p class="profile-quote">${userData.quote || "—"}</p>
        </div>

        <div>
          <div class="achievement-icons" id="self-achievement-icons" aria-hidden="false"></div>
        </div>

        <div class="profile-edit">
          <label>Аватар (URL)</label>
          <input id="avatar-url-input" type="url" value="${userData.avatar || ''}" placeholder="https://...">
          <label>Цитата</label>
          <input id="quote-input-top" type="text" value="${userData.quote || ''}" placeholder="Короткая цитата">
<label>Любимый жанр</label>
<select id="genre-input-top">
  <option value="">— Выберите жанр —</option>
  <!-- Топовые жанры -->
  <option value="Экшен">Экшен</option>
  <option value="Шутер от первого лица">Шутер от первого лица</option>
  <option value="Шутер от третьего лица">Шутер от третьего лица</option>
  <option value="Battle Royale">Battle Royale</option>
  <option value="RPG">RPG</option>
  <option value="MMORPG">MMORPG</option>
  <option value="Выживание">Выживание</option>
  <option value="Песочница">Песочница</option>
  <option value="Приключения">Приключения</option>
  <option value="Хоррор">Хоррор</option>
  <!-- Средняя популярность -->
  <option value="Файтинг">Файтинг</option>
  <option value="Гонки">Гонки</option>
  <option value="Платформер">Платформер</option>
  <option value="Стратегия">Стратегия</option>
  <option value="Тактический шутер">Тактический шутер</option>
  <option value="Моба">МОБА</option>
  <option value="Симулятор">Симулятор</option>
  <!-- Дополнительные/нишевые -->
  <option value="Головоломка">Головоломка</option>
  <option value="Зомби">Зомби</option>
  <option value="Тактическая стратегия">Тактическая стратегия</option>
</select>

          <div style="display:flex; gap:8px;">
            <button id="save-my-profile" class="btn btn-primary">Сохранить профиль</button>
            <button id="cancel-edit" class="btn btn-secondary">Отмена</button>
            <button id="open-my-profile" class="btn btn-primary">В профиль</button>
          </div>
        </div>
      </div>

      <div id="my-achievements-column" class="profile-achievements-column"></div>
    </div>
  `;

    const genreSelect = document.getElementById("genre-input-top");
  if (genreSelect && userData.favoriteGenre) {
    genreSelect.value = userData.favoriteGenre;
  }

  // render achievements icons (compact) - example: показываем до 6 иконок (при наличии)
  const iconsContainer = document.getElementById("self-achievement-icons");
  const medalsArr = [];
  // build same medals as elsewhere
  const m1 = getMedalLevel(stats.percentComplete, 20, 50, 80);
  if (m1.level !== "Нет") medalsArr.push({ key: "master", level: m1.level });
  const m2 = getMedalLevel(stats.ratingsCount, 10, 30, 50);
  if (m2.level !== "Нет") medalsArr.push({ key: "critic", level: m2.level });
  const m3 = getMedalLevel(stats.genresCount, 8, 13, 20);
  if (m3.level !== "Нет") medalsArr.push({ key: "genres", level: m3.level });
  const m4 = getMedalLevel(stats.favGenrePercent || 0, 50, 70, 90);
  if (m4.level !== "Нет") medalsArr.push({ key: "favgenre", level: m4.level });

  // order: gold -> silver -> bronze -> locked (and limit to ~6 icons)
  const ordered = [];
  ["Золото","Серебро","Бронза","Нет"].forEach(lvl=>{
    medalsArr.forEach(m=>{
      if (m.level === lvl) ordered.push(m);
    });
  });
  ordered.slice(0,6).forEach(m => {
    const path = getMedalIconPath(m.key, m.level);
    const img = document.createElement("img");
    img.src = path;
    img.alt = m.key;
    img.title = `${m.key} — ${m.level}`;
    img.onerror = function(){ this.onerror=null; this.src='assets/medals/locked.png' };
    iconsContainer.appendChild(img);
  });

  // render achievements column (detailed)
  renderAchievementsColumn(document.getElementById("my-achievements-column"), {
    percentComplete: stats.percentComplete,
    ratingsCount: stats.ratingsCount,
    genresCount: stats.genresCount,
    favGenrePercent: stats.favGenrePercent || 0
  });

  // open my profile button -> profile.html?uid=<uid>
  document.getElementById("open-my-profile").addEventListener("click", () => {
    const uid = userData.uid;
    window.location.href = `profile.html?uid=${uid}`;
  });

  // cancel edit just resets inputs to current values
  document.getElementById("cancel-edit").addEventListener("click", () => {
    document.getElementById("avatar-url-input").value = userData.avatar || '';
    document.getElementById("quote-input-top").value = userData.quote || '';
    document.getElementById("genre-input-top").value = userData.favoriteGenre || '';
  });

  // save profile click -> use docId to update correct document
  document.getElementById("save-my-profile").addEventListener("click", async () => {
    const avatarUrl = document.getElementById("avatar-url-input").value.trim();
    const quote = document.getElementById("quote-input-top").value.trim();
    const genre = document.getElementById("genre-input-top").value.trim();
    try {
      await updateDoc(doc(db, "users", docId), {
        avatar: avatarUrl || userData.avatar || null,
        quote,
        favoriteGenre: genre || null,
        lastActive: serverTimestamp()
      });
      // обновляем UI — проще перезагрузить страницу чтобы всё синхронизировалось
      alert("Профиль успешно сохранён.");
      location.reload();
    } catch (e) {
      console.error("Save profile error:", e);
      alert("Ошибка при сохранении профиля. Проверьте правила Firestore и сеть.");
    }
  });

  // start live updater for "был в сети" каждые 60 секунд
  startSelfLastActiveUpdater("self-status");
}

/* ========= updater for self lastActive (обновляет текст и класс) ========= */
function startSelfLastActiveUpdater(elementId){
  const el = document.getElementById(elementId);
  if (!el) return;
  // clear existing interval if any
  if (el._lastActiveInterval) clearInterval(el._lastActiveInterval);

  function tick(){
    const raw = el.getAttribute("data-lastactive");
    const ms = raw ? parseInt(raw, 10) : null;
    const txt = formatLastSeenFromMillis(ms);
    el.textContent = txt;
    if (ms && (Date.now() - ms) < 5*60*1000) {
      el.classList.add("online");
      el.classList.remove("offline");
    } else {
      el.classList.remove("online");
      el.classList.add("offline");
    }
  }
  tick();
  el._lastActiveInterval = setInterval(tick, 60 * 1000);
}

/* ========== loadOtherUsers ========== */
async function loadOtherUsers(currentUserId, totalGames) {
  document.querySelectorAll("#users-grid .user-compact").forEach(el => el.remove());
  const usersSnapshot = await getDocs(collection(db, "users"));
  const ratingsSnapshot = await getDocs(collection(db, "ratings"));
  const gamesSnapshot = await getDocs(collection(db, "games"));

  const games = gamesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  const ratingMap = {};
  for (const rdoc of ratingsSnapshot.docs) {
    const r = rdoc.data();
    if (!ratingMap[r.userId]) ratingMap[r.userId] = [];
    ratingMap[r.userId].push(r);
  }

  const now = Date.now();

  for (const docSnap of usersSnapshot.docs) {
    const user = docSnap.data();
    // skip rendering current user in the grid (we already showed it large on top)
    if (user.uid === currentUserId) continue;

    const ratings = ratingMap[user.uid] || [];
    const percentComplete = totalGames ? Math.round((ratings.length / totalGames) * 100) : 0;

    // online/offline
// Предполагается, что ruPlural и formatLastSeenFromMillis уже объявлены

let statusText = "Оффлайн";
let statusClass = "offline";

if (user.lastActive && typeof user.lastActive.toMillis === "function") {
  const lastMillis = user.lastActive.toMillis();
  statusText = formatLastSeenFromMillis(lastMillis);

  // Если статус "Онлайн" — класс online, иначе offline
  statusClass = (statusText === "Онлайн") ? "online" : "offline";
}


    // medals
    const medals = [];
    const m1 = getMedalLevel(percentComplete, 20, 50, 80);
    if (m1.level !== "Нет") medals.push({ key: "master", name: "Мастер прохождений", level: m1.level, value: percentComplete });

    const m2 = getMedalLevel(ratings.length, 10, 30, 50);
    if (m2.level !== "Нет") medals.push({ key: "critic", name: "Критик", level: m2.level, value: ratings.length });

const genresPlayed = new Set();
const genreCount = {};
ratings.forEach(r => {
  const g = games.find(x => x.id === r.gameId);
  if (g && g.category) {
    const cats = Array.isArray(g.category) ? g.category : [g.category];
    cats.forEach(cat => {
      genresPlayed.add(cat);
      genreCount[cat] = (genreCount[cat] || 0) + 1;
    });
  }
});
const m3 = getMedalLevel(genresPlayed.size, 8, 13, 20);
if (m3.level !== "Нет") medals.push({ key: "genres", name: "Коллекционер жанров", level: m3.level, value: genresPlayed.size });

// загружаем userData ...
let favGenrePercent = 0;
if (userData.favoriteGenre && ratings.length) {
  favGenrePercent = Math.round(((genreCount[userData.favoriteGenre] || 0) / ratings.length) * 100);
}



    const m4 = getMedalLevel(favGenrePercent, 50, 70, 90);
    if (m4.level !== "Нет") medals.push({ key: "favgenre", name: "Любимчик жанра", level: m4.level, value: favGenrePercent });

    // medals column HTML (small icons) limited to show "важные" ранги
    let medalsHTML = `<div class="achievements-bar-compact" style="display:flex; gap:6px; flex-wrap:wrap; justify-content:center;">`;
    // order gold -> silver -> bronze
    const levelsOrder = ["Золото","Серебро","Бронза"];
    levelsOrder.forEach(lvl => {
      medals.filter(m => m.level === lvl).forEach(m => {
        const iconPath = getMedalIconPath(m.key, m.level);
        medalsHTML += `<div class="medal-compact" title="${m.name} — ${m.level}">
                         <img src="${iconPath}" alt="${m.name}" style="width:28px;height:28px;border-radius:6px;" onerror="this.onerror=null; this.src='assets/medals/locked.png'">
                       </div>`;
      });
    });
    medalsHTML += `</div>`;

    // profile button
    const profileBtn = `<button class="view-profile btn btn-primary" onclick="window.location.href='profile.html?uid=${user.uid}'">Профиль</button>`;

    // user card (compact)
    const card = document.createElement("div");
    card.className = "game-card user-compact";
    card.innerHTML = `
      <div style="display:flex; gap:12px; align-items:flex-start;">
        <div style="flex:0 0 120px;">
          <img src="${user.avatar || 'assets/default-avatar.png'}" alt="Аватар" onerror="this.onerror=null; this.src='assets/default-avatar.png'" style="width:120px; height:120px; object-fit:cover; border-radius:8px;">
        </div>
        <div style="flex:1;">
          <h4 style="margin:0;">${user.nickname || 'Пользователь'}</h4>
          <p class="status ${statusClass}" style="margin:6px 0 4px 0;">${statusText}</p>
          <p style="margin:0;"><strong>Пройдено:</strong> ${percentComplete}%</p>
          <p style="margin:6px 0;"><em>${user.quote || '—'}</em></p>
          <div style="margin-top:8px;">
            ${profileBtn}
          </div>
        </div>
        <div style="flex:0 0 80px; display:flex; align-items:center; justify-content:center;">
          ${medalsHTML}
        </div>
      </div>
    `;
    usersGrid.appendChild(card);
  }
}

/* ========== small renderer for achievements used in my profile column ========== */
function renderAchievementsColumn(container, stats) {
  // build same-achievement list used in profile page
  const list = [
    { key: "master", name: "Мастер прохождений", desc: "Пройди как можно больше игр", value: stats.percentComplete, bronze:20, silver:50, gold:80, unit: "%" },
    { key: "critic", name: "Критик", desc: "Оценивай игры и становись признанным критиком", value: stats.ratingsCount, bronze:10, silver:30, gold:50, unit: "" },
    { key: "genres", name: "Коллекционер жанров", desc: "Играй в разные жанры", value: stats.genresCount, bronze:8, silver:13, gold:20, unit: "" },
    { key: "favgenre", name: "Любимчик жанра", desc: "Будь преданным фанатом жанра", value: stats.favGenrePercent || 0, bronze:50, silver:70, gold:90, unit: "%" }
  ];

  let html = `<div class="steam-achievements-compact">`;
  list.forEach(a => {
    const medal = getMedalLevel(a.value, a.bronze, a.silver, a.gold);
    const icon = getMedalIconPath(a.key, medal.level);
    const nextTarget = medal.level === "Золото" ? null
      : medal.level === "Серебро" ? a.gold
      : medal.level === "Бронза" ? a.silver : a.bronze;
    const progressPercent = nextTarget ? Math.min(100, Math.round((a.value / nextTarget) * 100)) : 100;
    const progressText = nextTarget ? `${a.value}${a.unit} из ${nextTarget}${a.unit}` : `${a.value}${a.unit} (макс)`; 

    html += `
      <div class="steam-achievement" style="display:flex; gap:10px; align-items:flex-start; margin-bottom:12px;">
        <img class="medal-icon" src="${icon}" alt="${a.name}" onerror="this.onerror=null; this.src='assets/medals/locked.png'" style="width:56px;height:56px;border-radius:8px;">
        <div class="achievement-details" style="flex:1;">
          <h4 style="margin:0 0 4px 0;">${a.name} <span class="level" style="color:#ffcc00">${medal.level}</span></h4>
          <p style="margin:0 0 6px 0; color:#666;">${a.desc}</p>
          <div class="mini-progress"><div class="mini-progress-bar" style="width:${progressPercent}%; height:8px; background:linear-gradient(90deg,#4cafef,#4c9ff0); border-radius:999px;"></div></div>
          <small style="color:#999">${progressText}</small>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}

