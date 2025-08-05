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
  getDocs
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
const showCompletedBtn = document.getElementById("show-completed");
const showPlannedBtn = document.getElementById("show-planned");

let currentFilter = "all"; // "completed", "planned", "all"

function clearAuthMessage() {
  authMessage.textContent = "";
}

onAuthStateChanged(auth, (user) => {
  clearAuthMessage();
  if (user) {
    authSection.style.display = "none";
    mainSection.style.display = "block";
    authBtn.textContent = "Выход";
    form.style.display = (user.email === adminEmail) ? "block" : "none";
    loadGames();
  } else {
    authSection.style.display = "block";
    mainSection.style.display = "none";
    authBtn.textContent = "Вход";
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

showCompletedBtn.addEventListener("click", () => {
  currentFilter = "completed";
  loadGames();
});

showPlannedBtn.addEventListener("click", () => {
  currentFilter = "planned";
  loadGames();
});

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
    if (error.code === "auth/user-not-found") {
      authMessage.textContent = "Пользователь не найден. Зарегистрируйтесь.";
    } else if (error.code === "auth/wrong-password") {
      authMessage.textContent = "Неверный пароль.";
    } else {
      authMessage.textContent = error.message;
    }
  }
};

window.register = async function () {
  clearAuthMessage();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) {
    authMessage.textContent = "Пожалуйста, заполните email и пароль";
    return;
  }
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    if (error.code === "auth/email-already-in-use") {
      authMessage.textContent = "Этот email уже зарегистрирован. Попробуйте войти.";
    } else if (error.code === "auth/weak-password") {
      authMessage.textContent = "Пароль слишком простой. Используйте минимум 6 символов.";
    } else {
      authMessage.textContent = error.message;
    }
  }
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user || user.email !== adminEmail) return;

  const title = document.getElementById("title").value.trim();
  const category = document.getElementById("category").value.trim();
  const link = document.getElementById("link").value.trim();
  const image = document.getElementById("image").value.trim();
  const status = document.getElementById("status").value;

  if (!title || !category || !link || !image || !status) {
    alert("Пожалуйста, заполните все поля.");
    return;
  }

  try {
    await addDoc(collection(db, "games"), { title, category, link, image, status });
    form.reset();
    loadGames
();
} catch (error) {
alert("Ошибка при добавлении игры: " + error.message);
}
});

async function loadGames() {
gamesList.innerHTML = "";
const snapshot = await getDocs(collection(db, "games"));
snapshot.forEach(doc => {
const game = doc.data();
if (currentFilter === "completed" && game.status !== "Пройдена") return;
if (currentFilter === "planned" && game.status !== "В планах") return;
const card = document.createElement("div");
card.className = "game-card";

card.innerHTML = `
  <img src="${game.image}" alt="${game.title}" />
  <div class="game-content">
    <h3>${game.title}</h3>
    <p>Категория: ${game.category}</p>
    <p>Статус: ${game.status}</p>
    <a href="${game.link}" target="_blank">Скачать / Перейти</a>
  </div>
`;

gamesList.appendChild(card);
});
}