
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  arrayUnion
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
const auth = getAuth(app);
const db = getFirestore(app);

const adminEmail = "boreko.ivan@gmail.com";

const authSection = document.getElementById("auth-section");
const mainSection = document.getElementById("main-section");
const authMessage = document.getElementById("auth-message");
const form = document.getElementById("add-game-form");
const gamesList = document.getElementById("games-list");
const authBtn = document.getElementById("auth-btn");
const statusFilter = document.getElementById("status-filter");
const genreFilter = document.getElementById("genre-filter");

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    authSection.style.display = "none";
    mainSection.style.display = "block";
    authBtn.textContent = "Выход";
    const isAdmin = user.email === adminEmail;
    document.getElementById("admin-controls").style.display = isAdmin ? "block" : "none";
    form.style.display = isAdmin ? "block" : "none";
    loadGames();
  } else {
    currentUser = null;
    authSection.style.display = "block";
    mainSection.style.display = "none";
    authBtn.textContent = "Вход";
    document.getElementById("admin-controls").style.display = "none";
  }
});

authBtn.addEventListener("click", () => {
  if (auth.currentUser) {
    signOut(auth);
  } else {
    signInWithPopup(auth, provider).catch((error) => {
      console.error(error);
    });
  }
});


window.login = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) {
    authMessage.textContent = "Пожалуйста, заполните email и пароль";
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    authMessage.textContent = error.message;
  }
};

window.register = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) {
    authMessage.textContent = "Пожалуйста, заполните email и пароль";
    return;
  }
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    authMessage.textContent = error.message;
  }
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser || currentUser.email !== adminEmail) return;

  const title = document.getElementById("title").value.trim();
  const category = document.getElementById("category").value.trim();
  const link = document.getElementById("link").value.trim();
  const image = document.getElementById("image").value.trim();
  const status = document.getElementById("status").value;

  if (!title || !category || !link || !image || !status) {
    alert("Пожалуйста, заполните все поля.");
    return;
  }

  await addDoc(collection(db, "games"), {
    title, category, link, image, status, ratings: []
  });

  form.reset();
  loadGames();
});

statusFilter.addEventListener("change", loadGames);
genreFilter.addEventListener("input", loadGames);

async function loadGames() {
  gamesList.innerHTML = "";
  const snapshot = await getDocs(collection(db, "games"));
  snapshot.forEach(docSnap => {
    const game = docSnap.data();
    const docId = docSnap.id;

    const statusVal = statusFilter.value;
    const genreVal = genreFilter.value.toLowerCase();

    if (statusVal !== "all" && game.status !== statusVal) return;
    if (genreVal && !game.category.toLowerCase().includes(genreVal)) return;

    const avgRating = (game.ratings?.length > 0)
      ? (game.ratings.reduce((a, b) => a + b, 0) / game.ratings.length).toFixed(1)
      : "—";

    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <img src="${game.image}" alt="${game.title}" />
      <div class="game-content">
        <h3>${game.title}</h3>
        <p>Категория: ${game.category}</p>
        <p>Статус: ${game.status}</p>
        <p>Средняя оценка: ${avgRating}</p>
        <a href="${game.link}" target="_blank">Скачать / Перейти</a>
        <div class="rate-area">
          <label>Ваша оценка:</label>
          <select data-id="${docId}" class="rating-select">
            <option value="">—</option>
            ${[1,2,3,4,5].map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
    gamesList.appendChild(card);
  });

  document.querySelectorAll(".rating-select").forEach(select => {
    select.addEventListener("change", async (e) => {
      const value = parseInt(e.target.value);
      const docId = e.target.getAttribute("data-id");
      if (value >= 1 && value <= 5) {
        const gameRef = doc(db, "games", docId);
        await updateDoc(gameRef, {
          ratings: arrayUnion(value)
        });
        loadGames();
      }
    });
  });
}



const auth = getAuth();
const db = getFirestore(app);
const gamesCollection = collection(db, "games");
const ratingsCollection = collection(db, "ratings");

const adminEmail = "boreko.ivan@gmail.com";
let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  const authBtn = document.getElementById("auth-btn");
  const addGameBtn = document.getElementById("nav-add-game");
  const userName = document.getElementById("user-name");

  if (user) {
    authBtn.textContent = "Выйти";
    userName.textContent = user.email;
    if (user.email === adminEmail) {
      addGameBtn.style.display = "inline-block";
    }
  } else {
    authBtn.textContent = "Войти";
    userName.textContent = "";
    addGameBtn.style.display = "none";
  }

  authBtn.onclick = () => {
    if (user) {
      signOut(auth);
    } else {
      const email = prompt("Введите email");
      const password = prompt("Введите пароль");
      signInWithEmailAndPassword(auth, email, password).catch(alert);
    }
  };
});

// Загрузка игр
document.getElementById("nav-games").addEventListener("click", async () => {
  const main = document.getElementById("main-content");
  main.innerHTML = "<h2>Игры</h2><div id='filters'></div><div id='game-list' class='game-list'></div>";
  const snapshot = await getDocs(gamesCollection);
  const games = [];
  snapshot.forEach(doc => {
    games.push({ id: doc.id, ...doc.data() });
  });
  renderGames(games);
});

// Рендер карточек игр
async function renderGames(games) {
  const container = document.getElementById("game-list");
  container.innerHTML = "";

  for (const game of games) {
    const gameCard = document.createElement("div");
    gameCard.className = "game-card";

    const userRated = game.ratings?.[currentUser?.uid];
    const averageRating = calcAverageRating(game.ratings);

    gameCard.innerHTML = `
      <h3>${game.title}</h3>
      <p><strong>Описание:</strong> ${game.description}</p>
      <p><strong>Жанр:</strong> ${game.genre}</p>
      <p><strong>Статус:</strong> ${game.status}</p>
      <p><strong>Средняя оценка:</strong> ${averageRating ?? "Нет"}</p>
      ${currentUser && !userRated ? ratingSelectHTML(game.id) : ""}
      ${currentUser?.email === adminEmail ? adminButtonsHTML(game.id) : ""}
    `;

    container.appendChild(gameCard);

    if (currentUser && !userRated) {
      gameCard.querySelector(".rate-btn").addEventListener("click", async () => {
        const rating = parseInt(gameCard.querySelector(".rating-select").value);
        if (rating >= 1 && rating <= 10) {
          const gameRef = doc(db, "games", game.id);
          const updatedRatings = { ...(game.ratings || {}), [currentUser.uid]: rating };
          await updateDoc(gameRef, { ratings: updatedRatings });
          alert("Оценка сохранена!");
          document.getElementById("nav-games").click(); // Обновим
        }
      });
    }

    if (currentUser?.email === adminEmail) {
      gameCard.querySelector(".delete-btn").addEventListener("click", async () => {
        if (confirm("Удалить игру?")) {
          await deleteDoc(doc(db, "games", game.id));
          document.getElementById("nav-games").click();
        }
      });
    }
  }
}

function calcAverageRating(ratings) {
  if (!ratings) return null;
  const values = Object.values(ratings);
  const sum = values.reduce((a, b) => a + b, 0);
  return (sum / values.length).toFixed(1);
}

function ratingSelectHTML(gameId) {
  return `
    <div>
      <label for="rating-${gameId}">Ваша оценка:</label>
      <select class="rating-select" id="rating-${gameId}">
        ${[...Array(10)].map((_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("")}
      </select>
      <button class="rate-btn">Оценить</button>
    </div>
  `;
}

function adminButtonsHTML(gameId) {
  return `
    <div class="admin-controls">
      <button class="delete-btn">Удалить</button>
    </div>
  `;
}
