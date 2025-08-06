// Обновлённый script.js с поддержкой фильтрации и сохранением всех игр в памяти

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
  query,
  where,
  doc,
  updateDoc,
  setDoc
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
const nicknameSpan = document.getElementById("user-nickname");

const searchInput = document.getElementById("search-input");
const filterCategory = document.getElementById("filter-category");
const filterStatus = document.getElementById("filter-status");

let allGames = [];

function clearAuthMessage() {
  authMessage.textContent = "";
}

onAuthStateChanged(auth, async (user) => {
  clearAuthMessage();
  if (user) {
    authSection.style.display = "none";
    mainSection.style.display = "block";
    authBtn.textContent = "Выход";
    form.style.display = (user.email === adminEmail) ? "block" : "none";

    try {
      const q = query(collection(db, "users"), where("uid", "==", user.uid));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        nicknameSpan.textContent = `👤 ${userData.nickname}`;
        nicknameSpan.style.display = "inline-block";
      }
    } catch (error) {
      console.error("Ошибка при загрузке ника:", error.message);
    }

    loadGames();
  } else {
    authSection.style.display = "block";
    mainSection.style.display = "none";
    authBtn.textContent = "Вход";
    nicknameSpan.style.display = "none";
    nicknameSpan.textContent = "";
  }
});

authBtn.addEventListener("click", () => {
  if (auth.currentUser) signOut(auth);
});

document.getElementById("games-btn")?.addEventListener("click", () => applyFilters());
searchInput?.addEventListener("input", applyFilters);
filterCategory?.addEventListener("change", applyFilters);
filterStatus?.addEventListener("change", applyFilters);

window.register = async function () {
  clearAuthMessage();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const nickname = document.getElementById("nickname").value.trim();
  if (!email || !password || !nickname) {
    authMessage.textContent = "Пожалуйста, заполните все поля";
    return;
  }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await setDoc(doc(db, "users", user.uid), { uid: user.uid, email: user.email, nickname });
    authMessage.textContent = "Регистрация успешна! Теперь войдите.";
  } catch (error) {
    authMessage.textContent = error.message;
  }
};

window.login = async function () {
  clearAuthMessage();
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

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user || user.email !== adminEmail) return;

  const title = document.getElementById("title").value.trim();
  const category = Array.from(document.getElementById("category").selectedOptions).map(o => o.value);
  const link = document.getElementById("link").value.trim();
  const image = document.getElementById("image").value.trim();
  const status = document.getElementById("status").value;

  if (!title || category.length === 0 || !link || !image || !status) {
    alert("Пожалуйста, заполните все поля.");
    return;
  }

  await addDoc(collection(db, "games"), { title, category, link, image, status });
  form.reset();
  loadGames();
});

async function loadGames() {
  const snapshot = await getDocs(collection(db, "games"));
  allGames = snapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id }));
  applyFilters();
}

function applyFilters() {
  const user = auth.currentUser;
  const title = searchInput?.value.toLowerCase() || "";
  const category = filterCategory?.value || "";
  const status = filterStatus?.value || "";

  const filtered = allGames.filter(game => {
    const matchesTitle = game.title.toLowerCase().includes(title);
    const matchesCategory = category ? (Array.isArray(game.category) ? game.category.includes(category) : game.category === category) : true;
    const matchesStatus = status ? game.status === status : true;
    return matchesTitle && matchesCategory && matchesStatus;
  });

  renderGames(filtered, user);
}

async function renderGames(games, user) {
  gamesList.innerHTML = "";
  for (const game of games) {
    const gameId = game.id;
    const ratingsSnapshot = await getDocs(query(collection(db, "ratings"), where("gameId", "==", gameId)));
    const ratings = [];
    let userRating = null;
    ratingsSnapshot.forEach(r => {
      const data = r.data();
      ratings.push(data.rating);
      if (user && data.userId === user.uid) userRating = data.rating;
    });
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b) / ratings.length).toFixed(1) : null;

    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <img src="${game.image}" alt="${game.title}" />
      <div class="game-content">
        <h3>${game.title}</h3>
        <p>Категория: ${Array.isArray(game.category) ? game.category.join(", ") : game.category}</p>
        <p>Статус: ${game.status}</p>
        <p>Средняя оценка: ${avgRating ? `${avgRating} ⭐` : "Нет оценок"}</p>
        <a href="${game.link}" target="_blank">Скачать / Перейти</a>
      </div>
    `;

    const content = card.querySelector(".game-content");

    if (user && game.status === "Пройдена" && userRating === null) {
      const ratingLabel = document.createElement("label");
      ratingLabel.innerHTML = `
        Оцените игру:
        <select data-game-id="${gameId}" class="rating-select">
          <option value="">Выберите</option>
          ${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1} ⭐</option>`).join('')}
        </select>
      `;
      content.appendChild(ratingLabel);

      ratingLabel.querySelector("select").addEventListener("change", async (e) => {
        const rating = parseInt(e.target.value);
        if (!user || isNaN(rating)) return;
        await addDoc(collection(db, "ratings"), { userId: user.uid, gameId, rating });
        alert("Оценка сохранена!");
        loadGames();
      });
    }

    if (user && userRating !== null) {
      const ratingInfo = document.createElement("p");
      ratingInfo.textContent = `Ваша оценка: ${userRating} ⭐`;
      content.appendChild(ratingInfo);
    }

    gamesList.appendChild(card);
  }
}
