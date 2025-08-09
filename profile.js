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

async function loadProfile(uid) {
  const userSnapshot = await getDocs(query(collection(db, "users"), where("uid", "==", uid)));
  if (userSnapshot.empty) {
    document.getElementById("profile-content").innerHTML = "<p>Профиль не найден.</p>";
    return;
  }
  const userData = userSnapshot.docs[0].data();

  const gamesSnapshot = await getDocs(collection(db, "games"));
  const totalGames = gamesSnapshot.size;

  const ratingsSnapshot = await getDocs(query(collection(db, "ratings"), where("userId", "==", uid)));
  const ratings = ratingsSnapshot.docs.map(d => d.data());

  const percentComplete = totalGames ? Math.round((ratings.length / totalGames) * 100) : 0;
  const avgRating = ratings.length ? (ratings.reduce((a,b) => a + b.rating, 0) / ratings.length).toFixed(1) : "—";

  let ratedGamesHTML = "";
  ratings.forEach(r => {
    const game = gamesSnapshot.docs.find(g => g.id === r.gameId)?.data();
    if (game) {
      ratedGamesHTML += `
        <div class="game-item">
          <img src="${game.image}" alt="${game.title}">
          <span>${game.title} — ${r.rating} ⭐</span>
        </div>
      `;
    }
  });

  document.getElementById("profile-content").innerHTML = `
    <div class="profile-header">
      <div class="profile-left">
        <img src="${userData.avatar || 'https://via.placeholder.com/300x300?text=Аватар'}" alt="Аватар">
        <div class="profile-badges">
          <img src="medals/master.png" alt="Master">
          <img src="medals/critic.png" alt="Critic">
          <img src="medals/genres.png" alt="Genres">
          <img src="medals/favgenre.png" alt="Fav Genre">
        </div>
      </div>
      <div class="profile-mid">
        <h2>${userData.nickname}</h2>
        <p><em>${userData.quote || "—"}</em></p>
        <p><strong>Любимый жанр:</strong> ${userData.favoriteGenre || "—"}</p>
        <p><strong>Пройдено:</strong> ${percentComplete}%</p>
        <p><strong>Средняя оценка:</strong> ${avgRating}</p>
      </div>
      <div class="profile-right">
        <div class="achievements-list-scroll">
          <div class="steam-achievement"><img class="medal-icon" src="medals/master.png"><div>Мастер прохождений — ${percentComplete}%</div></div>
          <div class="steam-achievement"><img class="medal-icon" src="medals/critic.png"><div>Критик — ${ratings.length} игр</div></div>
        </div>
      </div>
    </div>
    <div class="games-list two-columns">
      ${ratedGamesHTML || "<p>Нет оценок.</p>"}
    </div>
  `;
}
