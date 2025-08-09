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
  getDoc,
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

let intervalId = null;

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
let currentRenderToken = 0;

async function updateUserStatus(uid, status) {
  if (!uid) return;
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { 
      status,
      lastSeen: Date.now()
    });
  } catch (e) {
    console.error("Ошибка обновления статуса:", e);
  }
}


function clearAuthMessage() {
  authMessage.textContent = "";
}



let lastSeenIntervalId = null;  // глобально вверху файла
let userStatusIntervalId = null; // для обновления статуса онлайн
let currentUserUid = null; // чтобы хранить uid текущего пользователя

async function updateUserStatus(uid, status) {
  if (!uid) return;
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      status,
      lastSeen: Date.now()
    });
  } catch (e) {
    console.error("Ошибка обновления статуса:", e);
  }
}

// Главный обработчик авторизации
onAuthStateChanged(auth, async (user) => {
  clearAuthMessage();

  // Если пользователь вошел
  if (user) {
    currentUserUid = user.uid;

    await updateUserStatus(user.uid, "online");
    await updateUserLastSeen(user.uid);

    // Обновляем lastSeen каждую минуту
    if (lastSeenIntervalId) clearInterval(lastSeenIntervalId);
    lastSeenIntervalId = setInterval(() => updateUserLastSeen(user.uid), 60000);

    // Обновляем статус онлайн каждую минуту (можно и реже)
    if (userStatusIntervalId) clearInterval(userStatusIntervalId);
    userStatusIntervalId = setInterval(() => updateUserStatus(user.uid, "online"), 60000);

    // Обновляем UI
    authSection.style.display = "none";
    mainSection.style.display = "block";
    authBtn.textContent = "Выход";

    // ... (твой остальной код настройки UI)

    // Обработчик закрытия вкладки или выхода с сайта
    window.addEventListener("beforeunload", async () => {
      await updateUserStatus(user.uid, "offline");
    });

    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "hidden") {
        await updateUserStatus(user.uid, "offline");
      } else if (document.visibilityState === "visible") {
        await updateUserStatus(user.uid, "online");
      }
    });

    loadGames();

  } else {
    // Пользователь вышел

    if (lastSeenIntervalId) {
      clearInterval(lastSeenIntervalId);
      lastSeenIntervalId = null;
    }
    if (userStatusIntervalId) {
      clearInterval(userStatusIntervalId);
      userStatusIntervalId = null;
    }

    // Обновляем статус оффлайн, если есть сохраненный uid
    if (currentUserUid) {
      await updateUserStatus(currentUserUid, "offline");
      currentUserUid = null;
    }

    // Сброс UI
    authSection.style.display = "block";
    mainSection.style.display = "none";
    authBtn.textContent = "Вход";
    nicknameSpan.style.display = "none";
    nicknameSpan.textContent = "";
    document.getElementById("games-btn").style.display = "none";
    document.querySelector(".top-btn[href='top.html']").style.display = "none";
    document.querySelector(".top-btn[href='users.html']").style.display = "none";
  }
});

// Обработчик выхода по кнопке
authBtn.addEventListener("click", async () => {
  if (auth.currentUser) {
    if (lastSeenIntervalId) {
      clearInterval(lastSeenIntervalId);
      lastSeenIntervalId = null;
    }
    if (userStatusIntervalId) {
      clearInterval(userStatusIntervalId);
      userStatusIntervalId = null;
    }

    await updateUserStatus(auth.currentUser.uid, "offline");

    await signOut(auth);
    window.location.href = "index.html";
  }
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
    // Проверка ника до создания аккаунта
    const q = query(collection(db, "users"), where("nickname", "==", nickname));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      authMessage.textContent = "Такой ник уже занят. Выберите другой.";
      return;
    }

    // Создание пользователя в Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Создание профиля в Firestore
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      nickname,
      avatar: "https://cdn-images.dzcdn.net/images/cover/8b685b46bec333da34a4f17c7a3e4fc9/1900x1900-000000-80-0-0.jpg",
      quote: "",
      favoriteGenre: ""
    });

    authMessage.textContent = "Регистрация успешна! Теперь войдите.";
    await signOut(auth); // чтобы вернуть на форму входа
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

const customId = title.toLowerCase().replace(/\s+/g, "_"); // или slugify-функцию для чистоты
const gameRef = doc(db, "games", customId);

await setDoc(gameRef, { title, category, link, image, status });
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
    const matchesCategory = category
      ? (Array.isArray(game.category) ? game.category.includes(category) : game.category === category)
      : true;
    const matchesStatus = status ? game.status === status : true;
    return matchesTitle && matchesCategory && matchesStatus;
  });

  const renderToken = ++currentRenderToken;
  renderGames(filtered, user, renderToken);
}


async function renderGames(games, user, renderToken = currentRenderToken) {
  gamesList.innerHTML = "";
  for (const game of games) {
    if (renderToken !== currentRenderToken) return;
    const gameId = game.id;
    const ratingsSnapshot = await getDocs(query(collection(db, "ratings"), where("gameId", "==", gameId)));
    if (renderToken !== currentRenderToken) return;
    const ratings = [];
    let userRating = null;
const userRatingsMap = {}; // userId => { nickname, rating }

for (const docSnap of ratingsSnapshot.docs) {
  const data = docSnap.data();
  ratings.push(data.rating);

  if (user && data.userId === user.uid) {
    userRating = data.rating;
  }

  const userSnapshot = await getDocs(query(collection(db, "users"), where("uid", "==", data.userId)));
  if (!userSnapshot.empty) {
    const nickname = userSnapshot.docs[0].data().nickname || "Неизвестно";
    userRatingsMap[data.userId] = { nickname, rating: data.rating };
  }
}

    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b) / ratings.length).toFixed(1) : null;

    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <img src="${game.image}" alt="${game.title}" />
      <div class="game-content">
        <h3>${game.title}</h3>
        <p>Категория: ${Array.isArray(game.category) ? game.category.join(", ") : game.category}</p>
        <p>Статус: ${game.status}</p>
<div class="rating-summary">
  <span class="rating-label"><strong>Средняя:</strong> ${avgRating ?? "—"} ⭐</span>
  <span class="rating-label"><strong>Ваша:</strong> ${userRating ?? "—"} ⭐</span>
</div>
        <div class="download-btn-wrapper">
  <a class="download-btn" href="${game.link}" target="_blank">Скачать / Перейти</a>
</div>

      </div>
    `;

    const content = card.querySelector(".game-content");

if (user && game.status === "Пройдена") {
  const ratingWrapper = document.createElement("div");
  ratingWrapper.className = "rating-form";
ratingWrapper.innerHTML = `
  <div class="rating-block">
    <label class="rating-label">
      Ваша оценка:
      <select data-game-id="${gameId}" class="rating-select styled-select">
        <option value="">Выберите</option>
        ${Array.from({ length: 10 }, (_, i) => {
          const val = i + 1;
          const selected = userRating === val ? "selected" : "";
          return `<option value="${val}" ${selected}>${val} ⭐</option>`;
        }).join('')}
      </select>
    </label>
  </div>
`;

  content.appendChild(ratingWrapper);

  ratingWrapper.querySelector("select").addEventListener("change", async (e) => {
    const rating = parseInt(e.target.value);
    if (!user || isNaN(rating)) return;

const q = query(
  collection(db, "ratings"),
  where("gameId", "==", gameId),
  where("userId", "==", user.uid)
);
const snapshot = await getDocs(q);

if (!snapshot.empty) {
  await updateDoc(snapshot.docs[0].ref, { rating });
} else {
  await addDoc(collection(db, "ratings"), {
    userId: user.uid,
    gameId,
    rating
  });
}


    loadGames(); // перерисовка без alert
  });
}

    // ✅ Кнопка редактирования — ВСЕГДА для админа, не внутри других условий
    if (user && user.email === adminEmail) {
      const editBtn = document.createElement("button");
      editBtn.textContent = "✏️ Редактировать";
      editBtn.className = "edit-button mt-10";
      editBtn.style.marginBottom = "10px";
const showRatingsBtn = document.createElement("button");
showRatingsBtn.textContent = "📋 Оценки";
showRatingsBtn.className = "edit-button mt-10";

showRatingsBtn.addEventListener("click", () => {
  const ratingsList = Object.values(userRatingsMap).map(
    (entry) => `<li><strong>${entry.nickname}:</strong> ${entry.rating} ⭐</li>`
  ).join("");

  const ratingHtml = `
    <div class="ratings-popup">
      <h4>Оценки пользователей</h4>
      <ul>${ratingsList || "<li>Нет оценок</li>"}</ul>
    </div>
  `;
  content.innerHTML += ratingHtml;
});
content.appendChild(showRatingsBtn);

      editBtn.addEventListener("click", () => {
const allGenres = [
  "Экшен", "Шутер от первого лица", "Шутер от третьего лица", "Battle Royale", "RPG", "MMORPG",
  "Выживание", "Песочница", "Приключения", "Хоррор", "Файтинг", "Гонки", "Платформер",
  "Стратегия", "Тактический шутер", "Моба", "Симулятор", "Головоломка", "Зомби", "Тактическая стратегия"
];

const formHtml = `
  <form class="edit-form">
    <input type="text" name="title" value="${game.title}" required class="form-input" />
    <input type="text" name="image" value="${game.image}" required class="form-input" />
    <input type="text" name="link" value="${game.link}" required class="form-input" />
    <select name="status" required class="form-select">
      <option value="Пройдена" ${game.status === "Пройдена" ? "selected" : ""}>Пройдена</option>
      <option value="В процессе" ${game.status === "В процессе" ? "selected" : ""}>В процессе</option>
      <option value="В планах" ${game.status === "В планах" ? "selected" : ""}>В планах</option>
    </select>
<select name="category" multiple size="10" class="multi-select">
  ${allGenres.map(genre => `
    <option value="${genre}" ${game.category.includes(genre) ? "selected" : ""}>${genre}</option>
  `).join('')}
</select>
    <button type="submit" class="save-button">Сохранить</button>
  </form>
`;

        content.innerHTML += formHtml;

        const editForm = card.querySelector(".edit-form");
        editForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const updatedTitle = editForm.title.value.trim();
          const updatedImage = editForm.image.value.trim();
          const updatedLink = editForm.link.value.trim();
          const updatedStatus = editForm.status.value;
          const updatedCategory = Array.from(editForm.category.selectedOptions).map(o => o.value);


          try {
            const gameRef = doc(db, "games", gameId);
            await updateDoc(gameRef, {
              title: updatedTitle,
              image: updatedImage,
              link: updatedLink,
              status: updatedStatus,
              category: updatedCategory
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

    if (renderToken !== currentRenderToken) return;
    gamesList.appendChild(card);

  }
}
