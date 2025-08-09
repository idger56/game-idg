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
    }, 30000);
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
    <div class="user-card-full">
      <div class="user-info">
        <img class="avatar-large" src="${userData.avatar || 'https://via.placeholder.com/300x300?text=Аватар'}" alt="Аватар">
        <div class="user-details">
          <h3>${userData.nickname}</h3>
          <p><strong>Средняя оценка:</strong> ${avgRating}</p>
          <p><strong>Пройдено:</strong> ${percentComplete}%</p>
          <p><strong>Любимый жанр:</strong> ${userData.favoriteGenre || '—'}</p>
          <p><em>${userData.quote || '—'}</em></p>
        </div>
      </div>
      <div class="achievements-grid">
        <!-- Здесь будут иконки достижений -->
      </div>
    </div>
  `;

  document.querySelector(".avatar-large").onerror = () => {
    document.querySelector(".avatar-large").src = "https://via.placeholder.com/300x300?text=Аватар";
  };

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
    if (user.uid === currentUserId) continue;

    const ratings = ratingMap[user.uid] || [];
    const percentComplete = totalGames ? Math.round((ratings.length / totalGames) * 100) : 0;

    let statusText = "Оффлайн";
    let statusClass = "offline";
    if (user.lastActive && now - user.lastActive.toMillis() < 5 * 60 * 1000) {
      statusText = "Онлайн";
      statusClass = "online";
    } else if (user.lastActive) {
      const minsAgo = Math.floor((now - user.lastActive.toMillis()) / 60000);
      statusText = `Был в сети ${minsAgo} мин назад`;
    }

    const medalsHTML = `<div class="achievements-bar-small">
      <img src="medals/master.png" alt="Master">
      <img src="medals/critic.png" alt="Critic">
      <img src="medals/genres.png" alt="Genres">
      <img src="medals/favgenre.png" alt="Fav Genre">
    </div>`;

    const card = document.createElement("div");
    card.className = "game-card hover-animate";
    card.innerHTML = `
      <img src="${user.avatar || 'https://via.placeholder.com/300x300?text=Аватар'}" alt="Аватар">
      <div class="game-content">
        <h3>${user.nickname}</h3>
        <p class="status ${statusClass}">${statusText}</p>
        <p><strong>Пройдено:</strong> ${percentComplete}%</p>
        <p><em>${user.quote || '—'}</em></p>
        ${medalsHTML}
        <button class="view-profile" onclick="window.location.href='profile.html?uid=${user.uid}'">
          Посмотреть профиль
        </button>
      </div>
    `;

    usersList.appendChild(card);
  }
}
