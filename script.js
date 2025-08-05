
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
    authSection.style.display = "block";
    mainSection.style.display = "none";
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
