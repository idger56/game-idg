// ✅ Импортируем нужные модули из Firebase
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

// ✅ Конфигурация Firebase проекта
const firebaseConfig = {
  apiKey: "AIzaSyBNuHz-OPbVWHoc7gtuxHU21-CC5TbYKbw",
  authDomain: "game-idg.firebaseapp.com",
  projectId: "game-idg",
  storageBucket: "game-idg.firebasestorage.app",
  messagingSenderId: "987199066254",
  appId: "1:987199066254:web:ed82cea15f4a7b7a4279df",
  measurementId: "G-QLLFXDHX51"
};

// ✅ Инициализируем Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);        // Модуль аутентификации
const db = getFirestore(app);     // Модуль базы данных Firestore

// ✅ Email администратора (только он может добавлять игры)
const adminEmail = "boreko.ivan@gmail.com";

// ✅ Элементы DOM
const authSection = document.getElementById("auth-section");
const mainSection = document.getElementById("main-section");
const authMessage = document.getElementById("auth-message");
const form = document.getElementById("add-game-form");
const gamesList = document.getElementById("games-list");

const authBtn = document.getElementById("auth-btn");
const showCompletedBtn = document.getElementById("show-completed");
const showPlannedBtn = document.getElementById("show-planned");

let currentFilter = "all"; // Фильтр отображения игр: "all", "completed", "planned"

// ✅ Функция очистки сообщений об ошибке авторизации
function clearAuthMessage() {
  authMessage.textContent = "";
}

// ✅ Обработка изменения состояния авторизации
onAuthStateChanged(auth, (user) => {
  clearAuthMessage();
  if (user) {
    // Если пользователь вошел
    authSection.style.display = "none";
    mainSection.style.display = "block";
    authBtn.textContent = "Выход";
    
    // Показываем форму добавления игр только администратору
    form.style.display = (user.email === adminEmail) ? "block" : "none";
    
    loadGames(); // Загружаем список игр
  } else {
    // Если пользователь вышел
    authSection.style.display = "block";
    mainSection.style.display = "none";
    authBtn.textContent = "Вход";
  }
});

// ✅ Кнопка "Вход/Выход"
authBtn.addEventListener("click", () => {
  if (auth.currentUser) {
    signOut(auth); // Если вошел — выходим
  } else {
    authSection.style.display = "block";
    mainSection.style.display = "none";
  }
});

// ✅ Фильтр: Пройденные игры
showCompletedBtn.addEventListener("click", () => {
  currentFilter = "completed";
  loadGames();
});

// ✅ Фильтр: Запланированные игры
showPlannedBtn.addEventListener("click", () => {
  currentFilter = "planned";
  loadGames();
});

// ✅ Функция входа в аккаунт
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
    // Обработка ошибок входа
    if (error.code === "auth/user-not-found") {
      authMessage.textContent = "Пользователь не найден. Зарегистрируйтесь.";
    } else if (error.code === "auth/wrong-password") {
      authMessage.textContent = "Неверный пароль.";
    } else {
      authMessage.textContent = error.message;
    }
  }
};

// ✅ Функция регистрации нового пользователя
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
    // Обработка ошибок регистрации
    if (error.code === "auth/email-already-in-use") {
      authMessage.textContent = "Этот email уже зарегистрирован. Попробуйте войти.";
    } else if (error.code === "auth/weak-password") {
      authMessage.textContent = "Пароль слишком простой. Используйте минимум 6 символов.";
    } else {
      authMessage.textContent = error.message;
    }
  }
};

// ✅ Добавление новой игры (только для администратора)
form.addEventListener("submit", async (e) => {
  e.preventDefault(); // Отменяем перезагрузку страницы

  const user = auth.currentUser;
  if (!user || user.email !== adminEmail) return; // Только админ может добавлять


  // Получаем данные из формы
  const title = document.getElementById("title").value.trim();
  const categorySelect = document.getElementById("category");
  const category = Array.from(categorySelect.selectedOptions).map(option => option.value);
  const link = document.getElementById("link").value.trim();
  const image = document.getElementById("image").value.trim();
  const status = document.getElementById("status").value;

  // Проверка на заполнение всех полей
  if (!title || category.length === 0 || !link || !image || !status) {
    alert("Пожалуйста, заполните все поля.");
    return;
  }

  try {
    // Добавляем игру в коллекцию Firestore
    await addDoc(collection(db, "games"), { title, category, link, image, status });
    form.reset(); // Сброс формы
    loadGames();  // Обновление списка
  } catch (error) {
    alert("Ошибка при добавлении игры: " + error.message);
  }
});

// ✅ Загрузка и отображение списка игр
async function loadGames() {
  gamesList.innerHTML = ""; // Очищаем текущий список

  const snapshot = await getDocs(collection(db, "games"));

  snapshot.forEach(doc => {
    const game = doc.data();

    // Фильтрация по статусу
    if (currentFilter === "completed" && game.status !== "Пройдена") return;
    if (currentFilter === "planned" && game.status !== "В планах") return;

    // Создаем карточку игры
    const card = document.createElement("div");
    card.className = "game-card";

    card.innerHTML = `
      <img src="${game.image}" alt="${game.title}" />
      <div class="game-content">
        <h3>${game.title}</h3>
        <p>Категория: ${Array.isArray(game.category) ? game.category.join(", ") : game.category}</p>
        <p>Статус: ${game.status}</p>
        <a href="${game.link}" target="_blank">Скачать / Перейти</a>
      </div>
    `;



    // Добавляем карточку в DOM
    gamesList.appendChild(card);
  });
}
