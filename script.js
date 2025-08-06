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
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  setDoc,  
  getDoc
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
const showProcessBtn = document.getElementById("show-process");
const showPlannedBtn = document.getElementById("show-planned");

let currentFilter = "all"; // Фильтр отображения игр: "all", "completed", "planned"

// ✅ Функция очистки сообщений об ошибке авторизации
function clearAuthMessage() {
  authMessage.textContent = "";
}

// ✅ Обработка изменения состояния авторизации
onAuthStateChanged(auth, async (user) => {
  clearAuthMessage();

  const nicknameSpan = document.getElementById("user-nickname");

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
      } else {
        nicknameSpan.textContent = "👤 Пользователь";
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

// ✅ Фильтр: В процессе
showProcessBtn.addEventListener("click", () => {
  currentFilter = "process";
  loadGames();
});

// ✅ Фильтр: Запланированные игры
showPlannedBtn.addEventListener("click", () => {
  currentFilter = "planned";
  loadGames();
});

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

    // Сохраняем ник в Firestore
await setDoc(doc(db, "users", user.uid), {
  uid: user.uid,
  email: user.email,
  nickname
});

    authMessage.textContent = "Регистрация успешна! Теперь войдите.";
  } catch (error) {
    if (error.code === "auth/email-already-in-use") {
      authMessage.textContent = "Этот email уже зарегистрирован.";
    } else if (error.code === "auth/weak-password") {
      authMessage.textContent = "Пароль слишком простой (минимум 6 символов).";
    } else {
      authMessage.textContent = error.message;
    }
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
    // onAuthStateChanged сам сработает после успешного входа
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      authMessage.textContent = "Пользователь не найден.";
    } else if (error.code === "auth/wrong-password") {
      authMessage.textContent = "Неверный пароль.";
    } else {
      authMessage.textContent = error.message;
    }
  }
};


// ✅ Добавление новой игры (только для администратора)
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user || user.email !== adminEmail) return;

  const title = document.getElementById("title").value.trim();
  const categorySelect = document.getElementById("category");
  const category = Array.from(categorySelect.selectedOptions).map(option => option.value);
  const link = document.getElementById("link").value.trim();
  const image = document.getElementById("image").value.trim();
  const status = document.getElementById("status").value;

  if (!title || category.length === 0 || !link || !image || !status) {
    alert("Пожалуйста, заполните все поля.");
    return;
  }

  try {
    await addDoc(collection(db, "games"), { title, category, link, image, status });
    form.reset();
    loadGames();
  } catch (error) {
    alert("Ошибка при добавлении игры: " + error.message);
  }
});

// ✅ Загрузка и отображение списка игр
async function loadGames() {
  gamesList.innerHTML = "";
  const user = auth.currentUser;

  const snapshot = await getDocs(collection(db, "games"));

  for (const docSnap of snapshot.docs) {
    const game = docSnap.data();
    const gameId = docSnap.id;

    if (currentFilter === "completed" && game.status !== "Пройдена") continue;
    if (currentFilter === "process" && game.status !== "В процессе") continue;
    if (currentFilter === "planned" && game.status !== "В планах") continue;

    // Получаем оценки
    const ratingsQuery = query(collection(db, "ratings"), where("gameId", "==", gameId));
    const ratingsSnapshot = await getDocs(ratingsQuery);

    const ratings = [];
    let userRating = null;

    ratingsSnapshot.forEach(r => {
      const ratingData = r.data();
      ratings.push(ratingData.rating);
      if (user && ratingData.userId === user.uid) {
        userRating = ratingData.rating;
      }
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

    // Оценка (если пользователь может)
    if (user && game.status === "Пройдена" && userRating === null) {
      const ratingLabel = document.createElement("label");
      ratingLabel.innerHTML = `
        Оцените игру:
        <select data-game-id="${gameId}" class="rating-select">
          <option value="">Выберите</option>
          <option value="1">1 ⭐</option>
          <option value="2">2 ⭐</option>
          <option value="3">3 ⭐</option>
          <option value="4">4 ⭐</option>
          <option value="5">5 ⭐</option>
          <option value="6">6 ⭐</option>
          <option value="7">7 ⭐</option>
          <option value="8">8 ⭐</option>          
          <option value="9">9 ⭐</option>          
          <option value="10">10 ⭐</option>
        </select>
      `;
      content.appendChild(ratingLabel);
    }

    // Показываем оценку пользователя
    if (user && userRating !== null) {
      const ratingInfo = document.createElement("p");
      ratingInfo.textContent = `Ваша оценка: ${userRating} ⭐`;
      content.appendChild(ratingInfo);
    }

    // Кнопка редактирования для админа
    if (user && user.email === adminEmail) {
      const editBtn = document.createElement("button");
      editBtn.textContent = "Редактировать";
      editBtn.className = "edit-button mt-10";


      editBtn.addEventListener("click", () => {
const formHtml = `
  <form class="edit-form">
    <div class="form-group">
      <input type="text" name="title" value="${game.title}" required placeholder="Название игры" class="form-input" />
    </div>
    <div class="form-group">
      <input type="text" name="image" value="${game.image}" required placeholder="URL картинки" class="form-input" />
    </div>
    <div class="form-group">
      <input type="text" name="link" value="${game.link}" required placeholder="Ссылка на игру" class="form-input" />
    </div>
    <div class="form-group">
      <select name="status" required class="form-select">
        <option value="Пройдена" ${game.status === "Пройдена" ? "selected" : ""}>Пройдена</option>
        <option value="В процессе" ${game.status === "В процессе" ? "selected" : ""}>В процессе</option>
        <option value="В планах" ${game.status === "В планах" ? "selected" : ""}>В планах</option>
      </select>
    </div>
    <button type="submit" class="save-button">Сохранить</button>
  </form>
`;

        card.innerHTML += formHtml;

        const editForm = card.querySelector(".edit-form");
        editForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const updatedTitle = editForm.title.value.trim();
          const updatedImage = editForm.image.value.trim();
          const updatedLink = editForm.link.value.trim();
          const updatedStatus = editForm.status.value;

          try {
            const gameRef = doc(db, "games", gameId);
            await updateDoc(gameRef, {
              title: updatedTitle,
              image: updatedImage,
              link: updatedLink,
              status: updatedStatus
            });
            alert("Игра обновлена!");
            loadGames();
          } catch (error) {
            alert("Ошибка при обновлении: " + error.message);
          }
        });
      });

      content.appendChild(editBtn);
    }

    gamesList.appendChild(card);
  }

  // Обработка выбора оценки
  document.querySelectorAll(".rating-select").forEach(select => {
    select.addEventListener("change", async (e) => {
      const rating = parseInt(e.target.value);
      const gameId = e.target.getAttribute("data-game-id");

      if (!user || isNaN(rating)) return;

      try {
        await addDoc(collection(db, "ratings"), {
          userId: user.uid,
          gameId,
          rating
        });
        alert("Оценка сохранена!");
        loadGames();
      } catch (error) {
        alert("Ошибка при сохранении оценки: " + error.message);
      }
    });
  });
}
