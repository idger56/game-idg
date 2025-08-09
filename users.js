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
const usersList = document.getElementById("users-list");
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

function safeImgAttrs(src, alt = "") {
  // returns html-safe img attributes with onerror fallback (relative locked image)
  const locked = `assets/medals/locked.png`;
  return `src="${src}" alt="${alt}" onerror="this.onerror=null; this.src='${locked}';"`;
}

/* ========== AUTH BUTTON (LOGOUT -> index.html) ========== */
if (authBtn) {
  authBtn.addEventListener("click", () => {
    if (auth.currentUser) {
      signOut(auth).then(() => {
        window.location.href = "index.html";
      }).catch(e => {
        console.error("Sign out error:", e);
        window.location.href = "index.html";
      });
    } else {
      // if not signed in, maybe open login on index — keep default behavior
      window.location.href = "index.html";
    }
  });
}

/* ========== MAIN: onAuthStateChanged ========== */
onAuthStateChanged(auth, async (user) => {
  // load total games count for percents
  const allGamesSnapshot = await getDocs(collection(db, "games"));
  const totalGames = allGamesSnapshot.size || 0;

  if (!user) {
    // not signed in: show message and still render other users
    myProfileDiv.innerHTML = `<div class="full-width-msg">Войдите, чтобы увидеть и редактировать свой профиль.</div>`;
    await loadOtherUsers(null, totalGames);
    nicknameSpan.style.display = "none";
    return;
  }

  // update lastActive periodically in background (every 30s)
  // NOTE: this only writes if security rules allow user to write their doc
  setInterval(async () => {
    try {
      await updateDoc(doc(db, "users", user.uid), { lastActive: serverTimestamp() });
    } catch (e) {
      // ошибок не мешаем пользователю
      // console.warn("Не удалось обновить lastActive:", e.message);
    }
  }, 30000);

  // fetch my user doc by uid
  const q = query(collection(db, "users"), where("uid", "==", user.uid));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    myProfileDiv.innerHTML = `<div class="full-width-msg">Профиль не найден в базе. Если вы только что зарегистрировались, попробуйте войти снова.</div>`;
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

/* ========== renderMyProfile ========== */
function renderMyProfile(userData, stats, docId) {
  const avatar = userData.avatar || "assets/default-avatar.png"; // local placeholder if you have it
  // Left: avatar; center: info; right: achievements column
  myProfileDiv.innerHTML = `
    <div class="my-profile-expanded game-card" style="display:flex; gap:20px; padding:18px; align-items:flex-start;">
      <div style="flex:0 0 280px;">
        <img id="my-avatar-img" src="${avatar}" alt="Аватар" onerror="this.onerror=null; this.src='assets/default-avatar.png'">
        <div style="margin-top:10px; text-align:center;">
          <button id="open-my-profile" class="top-btn">Открыть страницу профиля</button>
          <button id="edit-my-profile" class="top-btn" style="margin-left:8px;">Редактировать</button>
        </div>
      </div>

      <div style="flex:1;">
        <h2>${userData.nickname || "Пользователь"}</h2>
        <p><strong>Средняя оценка:</strong> ${stats.avgRating}</p>
        <p><strong>Пройдено:</strong> ${stats.percentComplete}% (${stats.ratingsCount}/${stats.totalGames || 0})</p>
        <p><strong>Любимый жанр:</strong> ${userData.favoriteGenre || "—"}</p>
        <p style="font-style:italic;">${userData.quote || "—"}</p>

        <div style="margin-top:12px;">
          <label>Аватар (URL):</label>
          <input id="avatar-url-input" type="url" value="${userData.avatar || ''}" style="width:100%; padding:8px; margin-top:6px;">
          <label style="margin-top:8px; display:block;">Цитата:</label>
          <input id="quote-input-top" type="text" value="${userData.quote || ''}" style="width:100%; padding:8px; margin-top:6px;">
          <label style="margin-top:8px; display:block;">Любимый жанр:</label>
          <input id="genre-input-top" type="text" value="${userData.favoriteGenre || ''}" style="width:100%; padding:8px; margin-top:6px;">
          <div style="margin-top:10px;">
            <button id="save-my-profile" class="submit-button">Сохранить профиль</button>
          </div>
        </div>
      </div>

      <div id="my-achievements-column" style="flex:0 0 320px;"></div>
    </div>
  `;

  // render achievements column (use same renderer as profile page)
  const statsObj = {
    percentComplete: stats.percentComplete,
    ratingsCount: stats.ratingsCount,
    genresCount: stats.genresCount,
    favGenrePercent: computeFavGenrePercent(userData, stats.ratingsCount) // helper returns 0..100
  };
  renderAchievementsColumn(document.getElementById("my-achievements-column"), statsObj);

  // open my profile button -> profile.html?uid=<uid>
  document.getElementById("open-my-profile").addEventListener("click", () => {
    const uid = userData.uid;
    window.location.href = `profile.html?uid=${uid}`;
  });

  // save profile click
  document.getElementById("save-my-profile").addEventListener("click", async () => {
    const avatarUrl = document.getElementById("avatar-url-input").value.trim();
    const quote = document.getElementById("quote-input-top").value.trim();
    const genre = document.getElementById("genre-input-top").value.trim();
    try {
      await updateDoc(doc(db, "users", userData.uid), {
        avatar: avatarUrl || userData.avatar || null,
        quote,
        favoriteGenre: genre || null,
        lastActive: serverTimestamp()
      });
      alert("Профиль успешно сохранён.");
      location.reload();
    } catch (e) {
      console.error("Save profile error:", e);
      alert("Ошибка при сохранении профиля. Проверьте правила Firestore и сеть.");
    }
  });
}

/* ========== helper computeFavGenrePercent (approx) ========== */
function computeFavGenrePercent(userData, ratingsCount) {
  // If userData.favoriteGenre exists, we cannot compute percentage precisely without fetching ratings by genre.
  // For the column display we return 0..100 fallback using a simple heuristic (if unknown -> 0).
  // Detailed percent is computed in profile page.
  return 0;
}

/* ========== loadOtherUsers ========== */
async function loadOtherUsers(currentUserId, totalGames) {
  usersList.innerHTML = ""; // clear
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
    let statusText = "Оффлайн", statusClass = "offline";
    if (user.lastActive && typeof user.lastActive.toMillis === "function") {
      if (now - user.lastActive.toMillis() < 5 * 60 * 1000) {
        statusText = "Онлайн"; statusClass = "online";
      } else {
        const mins = Math.floor((now - user.lastActive.toMillis()) / 60000);
        statusText = `Был в сети ${mins} мин назад`;
      }
    }

    // medals
    const medals = [];
    const m1 = getMedalLevel(percentComplete, 50, 80, 100);
    if (m1.level !== "Нет") medals.push({ key: "master", name: "Мастер прохождений", level: m1.level, value: percentComplete });

    const m2 = getMedalLevel(ratings.length, 10, 30, 50);
    if (m2.level !== "Нет") medals.push({ key: "critic", name: "Критик", level: m2.level, value: ratings.length });

    // collection of genres
    const genresPlayed = new Set();
    ratings.forEach(r => {
      const g = games.find(x => x.id === r.gameId);
      if (g && g.category) {
        if (Array.isArray(g.category)) g.category.forEach(c => genresPlayed.add(c));
        else genresPlayed.add(g.category);
      }
    });
    const m3 = getMedalLevel(genresPlayed.size, 3, 5, 8);
    if (m3.level !== "Нет") medals.push({ key: "genres", name: "Коллекционер жанров", level: m3.level, value: genresPlayed.size });

    // favorite genre percent
    let favGenrePercent = 0;
    if (user.favoriteGenre && ratings.length) {
      // compute percent of ratings in favoriteGenre
      const favCount = ratings.filter(r => {
        const g = games.find(x => x.id === r.gameId);
        if (!g || !g.category) return false;
        const cats = Array.isArray(g.category) ? g.category : [g.category];
        return cats.includes(user.favoriteGenre);
      }).length;
      favGenrePercent = Math.round((favCount / ratings.length) * 100);
    }
    const m4 = getMedalLevel(favGenrePercent, 50, 70, 90);
    if (m4.level !== "Нет") medals.push({ key: "favgenre", name: "Любимчик жанра", level: m4.level, value: favGenrePercent });

    // medals column HTML (small icons)
    let medalsHTML = `<div class="achievements-bar-compact">`;
    medals.forEach(m => {
      const iconPath = getMedalIconPath(m.key, m.level);
      medalsHTML += `<div class="medal-compact" title="${m.name} — ${m.level}">
                       <img src="${iconPath}" alt="${m.name}" onerror="this.onerror=null; this.src='assets/medals/locked.png'">
                     </div>`;
    });
    medalsHTML += `</div>`;

    // profile button
    const profileBtn = `<button class="view-profile" onclick="window.location.href='profile.html?uid=${user.uid}'">Посмотреть профиль</button>`;

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
    usersList.appendChild(card);
  }
}

/* ========== small renderer for achievements used in my profile column ========== */
function renderAchievementsColumn(container, stats) {
  // build same-achievement list used in profile page
  const list = [
    { key: "master", name: "Мастер прохождений", desc: "Пройди как можно больше игр", value: stats.percentComplete, bronze:50, silver:80, gold:100, unit: "%" },
    { key: "critic", name: "Критик", desc: "Оценивай игры и становись признанным критиком", value: stats.ratingsCount, bronze:10, silver:30, gold:50, unit: "" },
    { key: "genres", name: "Коллекционер жанров", desc: "Играй в разные жанры", value: stats.genresCount, bronze:3, silver:5, gold:8, unit: "" },
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
      <div class="steam-achievement-compact" title="${a.name}">
        <img class="medal-icon-compact" src="${icon}" alt="${a.name}" onerror="this.onerror=null; this.src='assets/medals/locked.png'">
        <div style="flex:1; margin-left:8px;">
          <div style="display:flex; justify-content:space-between;"><strong style="font-size:0.95em">${a.name}</strong><span style="color:#ffcc00">${medal.level}</span></div>
          <div class="mini-progress"><div class="mini-progress-bar" style="width:${progressPercent}%"></div></div>
          <small style="color:#999">${progressText}</small>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}
