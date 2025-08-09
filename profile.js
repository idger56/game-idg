// profile.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

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
const db = getFirestore(app);

const params = new URLSearchParams(window.location.search);
const uid = params.get("uid");

if (!uid) {
  document.getElementById("profile-content").innerHTML = "<p>Пользователь не найден.</p>";
} else {
  loadProfile(uid);
}

/* Helper: medal level & icon - same logic as in users.js */
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
function onErrorImg(e){ e.target.onerror = null; e.target.src = 'assets/default-avatar.png'; }

async function loadProfile(uid) {
  // load user by uid field
  const userSnapshot = await getDocs(query(collection(db, "users"), where("uid", "==", uid)));
  if (userSnapshot.empty) {
    document.getElementById("profile-content").innerHTML = "<p>Профиль не найден.</p>";
    return;
  }
  const userDoc = userSnapshot.docs[0];
  const userData = userDoc.data();

  // load games and ratings
  const gamesSnapshot = await getDocs(collection(db, "games"));
  const totalGames = gamesSnapshot.size || 0;

  const ratingsSnapshot = await getDocs(query(collection(db, "ratings"), where("userId", "==", uid)));
  const ratings = ratingsSnapshot.docs.map(d => d.data());
  const percentComplete = totalGames ? Math.round((ratings.length / totalGames) * 100) : 0;
  const avgRating = ratings.length ? (ratings.reduce((a,b) => a + b.rating, 0) / ratings.length).toFixed(1) : "—";

  // compute genresCount and favGenre percent
  const gamesArr = gamesSnapshot.docs.map(g => ({ id: g.id, ...g.data() }));
  const genresSet = new Set();
  const genreCount = {};
  ratings.forEach(r => {
    const game = gamesArr.find(g => g.id === r.gameId);
    if (game && game.category) {
      const cats = Array.isArray(game.category) ? game.category : [game.category];
      cats.forEach(cat => {
        genresSet.add(cat);
        genreCount[cat] = (genreCount[cat] || 0) + 1;
      });
    }
  });
  const genresCount = genresSet.size;
  let favGenrePercent = 0;
  if (userData.favoriteGenre && ratings.length) {
    favGenrePercent = Math.round(((genreCount[userData.favoriteGenre] || 0) / ratings.length) * 100);
  }

  // Achievements data (Steam-style)
  const userStats = {
    percentComplete,
    ratingsCount: ratings.length,
    genresCount,
    favGenrePercent
  };

  // Favorite games thumbnails (if available)
  let favoriteGamesHTML = "";
  if (Array.isArray(userData.favoriteGames) && userData.favoriteGames.length) {
    favoriteGamesHTML = `
      <div class="favorite-games">
        <h4>Любимые игры</h4>
        <div class="fav-games-row">
          ${userData.favoriteGames.map(url => `<img src="${url}" alt="game" onerror="this.onerror=null; this.src='assets/default-game.png'">`).join("")}
        </div>
      </div>
    `;
  }

  // rated games list
  let ratedGamesHTML = "";
  for (const r of ratings) {
    const gameDoc = gamesSnapshot.docs.find(g => g.id === r.gameId);
    if (!gameDoc) continue;
    const game = gameDoc.data();
    ratedGamesHTML += `
      <div class="game-item">
        <img src="${game.image}" alt="${game.title}" onerror="this.onerror=null; this.src='assets/default-game.png'">
        <div class="game-item-info">
          <strong>${game.title}</strong>
          <span>${r.rating} ⭐</span>
        </div>
      </div>
    `;
  }

  // render main profile area
  document.getElementById("profile-content").innerHTML = `
    <div class="profile-header steam-profile">
      <div class="profile-left">
        <img id="profile-main-avatar" src="${userData.avatar || 'assets/default-avatar.png'}" alt="Аватар">
      </div>
      <div class="profile-mid">
        <h2>${userData.nickname}</h2>
        <p class="quote"><em>${userData.quote || "—"}</em></p>
        <p><strong>Любимый жанр:</strong> ${userData.favoriteGenre || "—"}</p>
        <p><strong>Пройдено:</strong> ${percentComplete}%</p>
        <p><strong>Средняя оценка:</strong> ${avgRating}</p>
        <div class="achievements-inline" id="profile-achievements-inline"></div>
      </div>
      <div class="profile-right" id="profile-achievements-right"></div>
    </div>

    ${favoriteGamesHTML}

    <div class="games-list">
      <h4>Оцененные игры</h4>
      ${ratedGamesHTML || "<p>Нет оценок.</p>"}
    </div>
  `;

  // attach onerror fallback
  const mainAvatar = document.getElementById("profile-main-avatar");
  mainAvatar.onerror = onErrorImg;

  // render achievements on right (detailed list)
  renderProfileAchievements(document.getElementById("profile-achievements-right"), { ...userStats, favoriteGenre: userData.favoriteGenre });

  // small inline badges under mid area (compact)
  renderProfileBadges(document.getElementById("profile-achievements-inline"), userStats);
}

/* Render badges (compact, under header) */
function renderProfileBadges(container, stats) {
  const badges = [];
  const m1 = getMedalLevel(stats.percentComplete, 50, 80, 100);
  badges.push({ key: "master", name: "Мастер прохождений", level: m1.level });
  const m2 = getMedalLevel(stats.ratingsCount, 10, 30, 50);
  badges.push({ key: "critic", name: "Критик", level: m2.level });
  const m3 = getMedalLevel(stats.genresCount, 3,5,8);
  badges.push({ key: "genres", name: "Коллекционер жанров", level: m3.level });
  const m4 = getMedalLevel(stats.favGenrePercent, 50,70,90);
  badges.push({ key: "favgenre", name: "Любимчик жанра", level: m4.level });

  let html = `<div class="profile-badges">`;
  badges.forEach(b => {
    const icon = getMedalIconPath(b.key, b.level);
    html += `<div class="badge-item" title="${b.name} — ${b.level}">
               <img src="${icon}" alt="${b.name}" onerror="this.onerror=null; this.src='assets/medals/locked.png'">
             </div>`;
  });
  html += `</div>`;
  container.innerHTML = html;
}

/* Render detailed achievements (right column) */
function renderProfileAchievements(container, userStats) {
  const achList = [
    { key:"master", name:"Мастер прохождений", desc:"Пройди как можно больше игр", value:userStats.percentComplete, bronze:50, silver:80, gold:100, unit:"%" },
    { key:"critic", name:"Критик", desc:"Оценивай игры и становись признанным критиком", value:userStats.ratingsCount, bronze:10, silver:30, gold:50, unit:"" },
    { key:"genres", name:"Коллекционер жанров", desc:"Играй в разные жанры и расширяй кругозор", value:userStats.genresCount, bronze:3, silver:5, gold:8, unit:"" },
    { key:"favgenre", name:"Любимчик жанра", desc:"Будь преданным фанатом своего любимого жанра", value:userStats.favGenrePercent, bronze:50, silver:70, gold:90, unit:"%" }
  ];

  let html = `<div class="achievements-list steam-achievements">`;
  achList.forEach(a => {
    const medal = getMedalLevel(a.value, a.bronze, a.silver, a.gold);
    const icon = getMedalIconPath(a.key, medal.level);
    const nextTarget = medal.level === "Золото" ? null
      : medal.level === "Серебро" ? a.gold
      : medal.level === "Бронза" ? a.silver : a.bronze;
    const progressPercent = nextTarget ? Math.min(100, Math.round((a.value / nextTarget) * 100)) : 100;
    const progressText = nextTarget ? `${a.value}${a.unit} из ${nextTarget}${a.unit}` : `${a.value}${a.unit} (макс. уровень)`;

    html += `
      <div class="steam-achievement">
        <img class="medal-icon" src="${icon}" alt="${a.name}" onerror="this.onerror=null; this.src='assets/medals/locked.png'">
        <div class="achievement-details">
          <h4>${a.name} <span class="level">— ${medal.level}</span></h4>
          <p>${a.desc}</p>
          <div class="progress-bar"><div class="progress" style="width:${progressPercent}%"></div></div>
          <small>${progressText}</small>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}
