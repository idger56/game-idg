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
  storageBucket: "game-idg.firebasestorage.app",
  messagingSenderId: "987199066254",
  appId: "1:987199066254:web:ed82cea15f4a7b7a4279df",
  measurementId: "G-QLLFXDHX51"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const topGamesContainer = document.getElementById("top-games");

async function loadTopGames() {
  const gamesSnapshot = await getDocs(collection(db, "games"));
  const games = gamesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const ratedGames = [];

  for (const game of games) {
    const ratingsSnapshot = await getDocs(query(collection(db, "ratings"), where("gameId", "==", game.id)));
    const ratings = [];
    ratingsSnapshot.forEach(doc => ratings.push(doc.data().rating));

    if (ratings.length > 0) {
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      ratedGames.push({ ...game, avgRating: avg.toFixed(1) });
    }
  }

  ratedGames.sort((a, b) => b.avgRating - a.avgRating);

  for (const game of ratedGames) {
    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <img src="${game.image}" alt="${game.title}" />
      <div class="game-content">
        <h3>${game.title}</h3>
        <p>Категория: ${Array.isArray(game.category) ? game.category.join(", ") : game.category}</p>
        <p>Статус: ${game.status}</p>
        <div class="rating-summary">
          <span><strong>Средняя:</strong> ${game.avgRating} ⭐</span>
        </div>
        <div class="download-btn-wrapper">
          <a class="download-btn" href="${game.link}" target="_blank">Скачать / Перейти</a>
        </div>
      </div>
    `;
    topGamesContainer.appendChild(card);
  }
}

loadTopGames();
