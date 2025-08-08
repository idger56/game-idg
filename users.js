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
  updateDoc
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
const auth = getAuth(app);
const db = getFirestore(app);

const nicknameSpan = document.getElementById("user-nickname");
const myProfileDiv = document.getElementById("my-profile");
const usersList = document.getElementById("users-list");
const authBtn = document.getElementById("auth-btn");

if (authBtn) {
  authBtn.addEventListener("click", () => {
    if (auth.currentUser) {
      signOut(auth).then(() => {
        window.location.href = "index.html";
      });
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  const allGamesSnapshot = await getDocs(collection(db, "games"));
  const totalGames = allGamesSnapshot.size;

  if (!user) {
    myProfileDiv.innerHTML = "<p>Войдите, чтобы увидеть и редактировать свой профиль.</p>";
    await loadOtherUsers(null, totalGames);
    return;
  }

if (user) {
  setInterval(async () => {
    await updateDoc(doc(db, "users", user.uid), {
      lastActive: new Date()
    });
  }, 30000); // каждые 30 секунд
}

  const q = query(collection(db, "users"), where("uid", "==", user.uid));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    myProfileDiv.innerHTML = "<p>Профиль не найден.</p>";
    return;
  }

  const userDoc = snapshot.docs[0];
  const userData = userDoc.data();
  const userDocId = userDoc.id;

  nicknameSpan.textContent = `👤 ${userData.nickname}`;
  nicknameSpan.style.display = "inline-block";

  const userRatingsSnapshot = await getDocs(query(collection(db, "ratings"), where("userId", "==", user.uid)));
  const userRatings = userRatingsSnapshot.docs.map(d => d.data());
  const avgRating = userRatings.length
    ? (userRatings.reduce((a, b) => a + b.rating, 0) / userRatings.length).toFixed(1)
    : "—";
  const percentComplete = totalGames
    ? Math.round((userRatings.length / totalGames) * 100)
    : 0;

  myProfileDiv.innerHTML = `
    <div class="game-card">
      <img id="profile-avatar" src="${userData.avatar || 'https://cdn-images.dzcdn.net/images/cover/8b685b46bec333da34a4f17c7a3e4fc9/1900x1900-000000-80-0-0.jpg'}" alt="Аватар">
      <div class="game-content">
        <h3>${userData.nickname}</h3>
        <p><strong>Средняя оценка:</strong> ${avgRating}</p>
        <p><strong>Пройдено:</strong> ${percentComplete}%</p>
        <p><strong>Любимый жанр:</strong> ${userData.favoriteGenre || '—'}</p>
        <p><em>${userData.quote || '—'}</em></p>
        <input type="url" id="avatar-url" placeholder="Ссылка на аватарку" value="${userData.avatar || ''}" />
        <input type="text" id="quote-input" placeholder="Цитата" value="${userData.quote || ''}" />
        <input type="text" id="genre-input" placeholder="Любимый жанр" value="${userData.favoriteGenre || ''}" />
        <button id="save-profile">Сохранить профиль</button>
      </div>
    </div>
  `;

  const profileAvatar = document.getElementById("profile-avatar");
  profileAvatar.onerror = () => {
    profileAvatar.src = "https://cdn-images.dzcdn.net/images/cover/8b685b46bec333da34a4f17c7a3e4fc9/1900x1900-000000-80-0-0.jpg";
  };

  document.getElementById("save-profile").addEventListener("click", async () => {
    const quote = document.getElementById("quote-input").value.trim();
    const genre = document.getElementById("genre-input").value.trim();
    const avatarUrl = document.getElementById("avatar-url").value.trim();

    await updateDoc(doc(db, "users", userDocId), {
      avatar: avatarUrl,
      quote,
      favoriteGenre: genre,
      lastActive: new Date()
    });

    alert("Профиль обновлён!");
    location.reload();
  });

  await loadOtherUsers(user.uid, totalGames);
});

async function loadOtherUsers(currentUserId, totalGames) {
  const usersSnapshot = await getDocs(collection(db, "users"));
  const ratingsSnapshot = await getDocs(collection(db, "ratings"));
  const gamesSnapshot = await getDocs(collection(db, "games"));

  const games = gamesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const ratingMap = {};
  for (const doc of ratingsSnapshot.docs) {
    const r = doc.data();
    if (!ratingMap[r.userId]) ratingMap[r.userId] = [];
    ratingMap[r.userId].push(r);
  }

  const now = Date.now();

  for (const docSnap of usersSnapshot.docs) {
    const user = docSnap.data();

    const ratings = ratingMap[user.uid] || [];
    const percentComplete = totalGames ? Math.round((ratings.length / totalGames) * 100) : 0;

    // --- Онлайн статус ---
    let statusText = "Оффлайн";
    let statusClass = "offline";
    if (user.lastActive && now - user.lastActive.toMillis() < 5 * 60 * 1000) {
      statusText = "Онлайн";
      statusClass = "online";
    } else if (user.lastActive) {
      const minsAgo = Math.floor((now - user.lastActive.toMillis()) / 60000);
      statusText = `Был в сети ${minsAgo} мин назад`;
    }

    // --- Подсчёт достижений ---
    const medals = [];

    // 1. Мастер прохождений
    const m1 = getMedalLevel(percentComplete, 50, 80, 100);
    if (m1) medals.push({ ...m1, name: "Мастер прохождений" });

    // 2. Критик
    const m2 = getMedalLevel(ratings.length, 10, 30, 50);
    if (m2) medals.push({ ...m2, name: "Критик" });

    // 3. Коллекционер жанров
    const genresPlayed = new Set();
    ratings.forEach(r => {
      const game = games.find(g => g.id === r.gameId);
      if (game && game.category) {
        if (Array.isArray(game.category)) {
          game.category.forEach(c => genresPlayed.add(c));
        } else {
          genresPlayed.add(game.category);
        }
      }
    });
    const m3 = getMedalLevel(genresPlayed.size, 3, 5, 8);
    if (m3) medals.push({ ...m3, name: "Коллекционер жанров" });

    // 4. Любимчик жанра
    const genreCount = {};
    ratings.forEach(r => {
      const game = games.find(g => g.id === r.gameId);
      if (game && game.category) {
        const categories = Array.isArray(game.category) ? game.category : [game.category];
        categories.forEach(cat => {
          genreCount[cat] = (genreCount[cat] || 0) + 1;
        });
      }
    });
    const favGenrePercent = Math.max(...Object.values(genreCount).map(v => (v / ratings.length) * 100 || 0));
    const m4 = getMedalLevel(favGenrePercent, 50, 70, 90);
    if (m4) medals.push({ ...m4, name: "Любимчик жанра" });

    // --- Вертикальная колонка с медалями ---
    let medalsHTML = `<div class="achievements-bar">`;
    medals.forEach(m => {
      medalsHTML += `<div class="medal" title="${m.name} — Уровень ${m.level}">${m.icon}</div>`;
    });
    medalsHTML += `</div>`;

        // Кнопка перехода на профиль
    const profileBtn = `<button class="view-profile" onclick="window.location.href='profile.html?uid=${user.uid}'">
                          ${user.uid === currentUserId ? "Открыть мой профиль" : "Посмотреть профиль"}
                        </button>`;
                        
    // --- Карточка пользователя ---
    const card = document.createElement("div");
    card.className = "game-card hover-animate";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="flex: 1;">
          <img src="${user.avatar || 'https://via.placeholder.com/300x300?text=Аватар'}" 
               alt="Аватар" 
               onerror="this.src='https://via.placeholder.com/300x300?text=Аватар'">
          <div class="game-content">
            <h3>${user.nickname}</h3>
            <p class="status ${statusClass}">${statusText}</p>
            <p><strong>Пройдено:</strong> ${percentComplete}%</p>
            <p><em>${user.quote || '—'}</em></p>
          </div>
        </div>
        ${medalsHTML}
      </div>
    `;

    usersList.appendChild(card);
  }
}

// Вспомогательная функция
function getMedalLevel(value, bronze, silver, gold) {
  if (value >= gold) return { icon: "🥇", level: "Золото" };
  if (value >= silver) return { icon: "🥈", level: "Серебро" };
  if (value >= bronze) return { icon: "🥉", level: "Бронза" };
  return null;
}

