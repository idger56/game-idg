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
      <img src="${userData.avatar || 'https://via.placeholder.com/150x150?text=Аватар'}" alt="Аватар" onerror="this.src='https://via.placeholder.com/150x150?text=Аватар'">
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
