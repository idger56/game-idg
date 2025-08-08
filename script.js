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

function clearAuthMessage() {
  authMessage.textContent = "";
}

onAuthStateChanged(auth, async (user) => {
  clearAuthMessage();
  if (user) {
    authSection.style.display = "none";
    mainSection.style.display = "block";
    authBtn.textContent = "Выход";
    const addBtn = document.getElementById("toggle-add-form");
    form.style.display = (user.email === adminEmail) ? "block" : "none";
    addBtn.style.display = (user.email === adminEmail) ? "inline-block" : "none";
     document.getElementById("games-btn").style.display = "inline-block";
  document.querySelector(".top-btn[href='top.html']").style.display = "inline-block";
  document.querySelector(".top-btn[href='users.html']").style.display = "inline-block";


     if (user.email === adminEmail) {
      document.getElementById("toggle-add-form").style.display = "block";
    }
    
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

    if (user.email === adminEmail) {
  const toggleAddFormBtn = document.getElementById("toggle-add-form");
  const addFormContainer = document.getElementById("add-form-container");

  if (toggleAddFormBtn && addFormContainer) {
    toggleAddFormBtn.style.display = "inline-block";
    addFormContainer.style.display = "none";

    toggleAddFormBtn.addEventListener("click", () => {
      const isVisible = addFormContainer.style.display === "block";
      addFormContainer.style.display = isVisible ? "none" : "block";
    });
  }
}

    loadGames();
  } else {
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

authBtn.addEventListener("click", () => {
  if (auth.currentUser) {
    signOut(auth).then(() => {
      window.location.href = "index.html";
    });
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
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
const nicknameId = nickname.toLowerCase().replace(/\s+/g, "_"); // или slugify
const userRef = doc(db, "users", nicknameId);

const userSnap = await getDoc(userRef);
if (userSnap.exists()) {
  authMessage.textContent = "Такой ник уже занят. Выберите другой.";
  return;
}

await setDoc(userRef, {
  uid: user.uid,
  email: user.email,
  nickname
});

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
