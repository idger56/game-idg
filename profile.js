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

// Получаем UID из URL
const params = new URLSearchParams(window.location.search);
const uid = params.get("uid");

if (!uid) {
  document.getElementById("profile-content").innerHTML = "<p>Пользователь не найден.</p>";
} else {
  loadProfile(uid);
}

async function loadProfile(uid) {
  // Загружаем данные пользователя
  const userSnapshot = await getDocs(query(collection(db, "users"), where("uid", "==", uid)));
  if (userSnapshot.empty) {
    document.getElementById("profile-content").innerHTML = "<p>Профиль не найден.</p>";
    return;
  }
  const userData = userSnapshot.docs[0].data();

  // Загружаем все игры и оценки
  const gamesSnapshot = await getDocs(collection(db, "games"));
  const totalGames = gamesSnapshot.size;
  
  const ratingsSnapshot = await getDocs(query(collection(db, "ratings"), where("userId", "==", uid)));
  const ratings = ratingsSnapshot.docs.map(d => d.data());

  const percentComplete = totalGames ? Math.round((ratings.length / totalGames) * 100) : 0;
  const avgRating = ratings.length ? (ratings.reduce((a,b) => a + b.rating, 0) / ratings.length).toFixed(1) : "—";

  // Достижения
  let achievementsHTML = "";
  if (percentComplete >= 100) achievementsHTML += "🏆 Мастер прохождений ";
  if (ratings.length >= 50) achievementsHTML += "⭐ Критик ";
  if (userData.favoriteGenre) achievementsHTML += `🎯 Любитель ${userData.favoriteGenre} `;

  // Любимые игры
  let favoriteGamesHTML = "";
  if (userData.favoriteGames?.length) {
    favoriteGamesHTML = `
      <div class="favorite-games">
        <h4>Любимые игры:</h4>
        ${userData.favoriteGames.map(url => `<img src="${url}" alt="game" />`).join("")}
      </div>
    `;
  }

  // Список оцененных игр
  let ratedGamesHTML = "";
  for (const r of ratings) {
    const game = gamesSnapshot.docs.find(g => g.id === r.gameId)?.data();
    if (game) {
      ratedGamesHTML += `
        <div class="game-item">
          <img src="${game.image}" alt="${game.title}">
          <span>${game.title} — ${r.rating} ⭐</span>
        </div>
      `;
    }
  }

  // Рендер профиля
  document.getElementById("profile-content").innerHTML = `
    <div class="profile-header">
      <img src="${userData.avatar || 'https://cdn-images.dzcdn.net/images/cover/8b685b46bec333da34a4f17c7a3e4fc9/1900x1900-000000-80-0-0.jpg'}" alt="Аватар" onerror="this.src='https://via.placeholder.com/150x150?text=Аватар'">
      <div>
        <h2>${userData.nickname}</h2>
        <p><em>${userData.quote || "—"}</em></p>
        <p><strong>Любимый жанр:</strong> ${userData.favoriteGenre || "—"}</p>
        <p><strong>Пройдено:</strong> ${percentComplete}%</p>
        <p><strong>Средняя оценка:</strong> ${avgRating}</p>
        <div class="achievements">${achievementsHTML}</div>
      </div>
    </div>
    ${favoriteGamesHTML}
    <div class="games-list">
      <h4>Оцененные игры:</h4>
      ${ratedGamesHTML || "<p>Нет оценок.</p>"}
    </div>
  `;
}

function getAchievementData(name, value, bronze, silver, gold, unit = "") {
  let level = null;
  let nextTarget = null;
  if (value >= gold) {
    level = { icon: "🥇", levelName: "Золото", target: gold };
  } else if (value >= silver) {
    level = { icon: "🥈", levelName: "Серебро", target: gold };
    nextTarget = gold;
  } else if (value >= bronze) {
    level = { icon: "🥉", levelName: "Бронза", target: silver };
    nextTarget = silver;
  } else {
    level = { icon: "⬜", levelName: "Нет", target: bronze };
    nextTarget = bronze;
  }

  return {
    name,
    icon: level.icon,
    levelName: level.levelName,
    description: getAchievementDescription(name),
    progressText: nextTarget 
      ? `${value}${unit} из ${nextTarget}${unit}`
      : `${value}${unit} (макс уровень)`,
    progressPercent: nextTarget ? Math.min(100, Math.round((value / nextTarget) * 100)) : 100
  };
}

function getAchievementDescription(name) {
  const descriptions = {
    "Мастер прохождений": "Пройди как можно больше игр",
    "Критик": "Оценивай игры и становись признанным критиком",
    "Коллекционер жанров": "Играй в разные жанры и расширяй кругозор",
    "Любимчик жанра": "Будь преданным фанатом своего любимого жанра"
  };
  return descriptions[name] || "";
}

function renderProfileAchievements(container, userStats) {
  const achievements = [];

  achievements.push(
    getAchievementData("Мастер прохождений", userStats.percentComplete, 50, 80, 100, "%")
  );

  achievements.push(
    getAchievementData("Критик", userStats.ratingsCount, 10, 30, 50, "")
  );

  achievements.push(
    getAchievementData("Коллекционер жанров", userStats.genresCount, 3, 5, 8, "")
  );

  achievements.push(
    getAchievementData("Любимчик жанра", userStats.favGenrePercent, 50, 70, 90, "%")
  );

  let html = `<div class="achievements-list">`;
  achievements.forEach(a => {
    html += `
      <div class="achievement-item">
        <span class="medal">${a.icon}</span>
        <div class="achievement-info">
          <h4>${a.name} — ${a.levelName}</h4>
          <p>${a.description}</p>
          <div class="progress-bar">
            <div class="progress" style="width:${a.progressPercent}%;"></div>
          </div>
          <small>${a.progressText}</small>
        </div>
      </div>
    `;
  });
  html += `</div>`;

  container.innerHTML = html;
}

