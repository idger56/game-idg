import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

const allGenres = [
  "Экшен","Шутер от первого лица","Шутер от третьего лица","Battle Royale","RPG","MMORPG",
  "Выживание","Песочница","Приключения","Хоррор","Открытый мир","Souls-like",
  "Файтинг","Гонки","Платформер","Стратегия","Пошаговая стратегия","Тактический шутер",
  "МОБА","Симулятор","Карточная игра","Спорт","Кооператив","Онлайн PvP","Головоломка",
  "Зомби","Тактическая стратегия","Roguelike","Roguelite","Метроидвания","Визуальная новелла",
  "Музыкальная","Квест","Киберпанк","Фэнтези","Историческая","Менеджмент","Стелс","Хакерство","Космос"
];

const gamesListEl = document.getElementById("games-list");
const mainSection = document.getElementById("main-section");
const authSection = document.getElementById("auth-section");
const logoutBtn = document.getElementById("logout-btn");
const nicknameSpan = document.getElementById("user-nickname");
const statusIndicator = document.getElementById("status-indicator");

const addGameBtn = document.getElementById("add-game-btn");
const addGameModal = document.getElementById("add-game-modal");
const saveGameBtn = document.getElementById("save-game-btn");
const closeModalBtn = document.getElementById("close-modal-btn");

const newTitle = document.getElementById("new-title");
const newImage = document.getElementById("new-image");
const newDesc = document.getElementById("new-desc");
const newGenre = document.getElementById("new-genre");

const searchInput = document.getElementById("search-input");
const filterGenre = document.getElementById("filter-genre");

let loadedGames = [];
let currentUid = null;

// Заполняем жанры в выпадающих списках
allGenres.forEach(g => {
  const opt1 = document.createElement("option");
  opt1.value = g;
  opt1.textContent = g;
  newGenre.appendChild(opt1);

  const opt2 = document.createElement("option");
  opt2.value = g;
  opt2.textContent = g;
  filterGenre.appendChild(opt2);
});

// Онлайн/офлайн индикатор
function updateOnlineStatus() {
  if (navigator.onLine) {
    statusIndicator.textContent = "🟢 Онлайн";
    statusIndicator.style.color = "green";
  } else {
    statusIndicator.textContent = "🔴 Оффлайн";
    statusIndicator.style.color = "red";
  }
}
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    nicknameSpan.textContent = user.displayName || user.email;
    currentUid = user.uid;
    authSection.style.display = "none";
    mainSection.style.display = "block";

    if (user.email === "boreko.ivan@gmail.com") {
      addGameBtn.style.display = "inline-block";
    }
    loadGames();
  } else {
    authSection.style.display = "block";
    mainSection.style.display = "none";
  }
});

async function loadGames() {
  gamesListEl.innerHTML = "<p>Загрузка...</p>";
  const snapshot = await getDocs(collection(db, "soloGames"));
  loadedGames = snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
  renderGames();
}

function renderGames() {
  gamesListEl.innerHTML = "";
  const searchText = searchInput.value.toLowerCase();
  const genreFilter = filterGenre.value;

  loadedGames
    .filter(game => 
      game.title.toLowerCase().includes(searchText) &&
      (genreFilter === "" || game.category === genreFilter)
    )
    .forEach(async game => {
      const statusRef = doc(db, "userSoloStatuses", `${currentUid}_${game.id}`);
      const statusDoc = await getDoc(statusRef);
      const statusData = statusDoc.exists() ? statusDoc.data() : { status: "Не пройдена", rating: null };

      renderGameCard(game, statusData);
    });
}

function renderGameCard(game, statusData) {
  const card = document.createElement("div");
  card.classList.add("game-card");
  card.innerHTML = `
    <img src="${game.image || 'assets/default-game.png'}" alt="${game.title}">
    <h3>${game.title}</h3>
    <p><strong>Жанр:</strong> ${game.category || "Не указан"}</p>
    <p>${game.description || ""}</p>

    <label>Статус:
      <select class="status-select">
        <option value="Не пройдена">Не пройдена</option>
        <option value="Прохожу">Прохожу</option>
        <option value="Перепрохожу">Перепрохожу</option>
        <option value="Пройдена">Пройдена</option>
      </select>
    </label>

    <div class="rating-container" style="margin-top:8px;">
      <label>Оценка:
        <input type="number" min="1" max="10" step="0.1" class="rating-input">
      </label>
      <button class="save-rating-btn">Сохранить</button>
    </div>
  `;

  const statusSelect = card.querySelector(".status-select");
  statusSelect.value = statusData.status;

  const ratingInput = card.querySelector(".rating-input");
  const saveRatingBtn = card.querySelector(".save-rating-btn");
  ratingInput.value = statusData.rating ?? "";

  toggleRating(statusData.status, ratingInput, saveRatingBtn);

  statusSelect.addEventListener("change", async () => {
    const newStatus = statusSelect.value;
    await setDoc(doc(db, "userSoloStatuses", `${currentUid}_${game.id}`), {
      status: newStatus,
      rating: newStatus === "Пройдена" ? (statusData.rating ?? null) : null
    });
    toggleRating(newStatus, ratingInput, saveRatingBtn);
  });

  saveRatingBtn.addEventListener("click", async () => {
    if (statusSelect.value !== "Пройдена") return alert("Оценивать можно только пройденные игры.");
    const newRating = parseFloat(ratingInput.value);
    if (!newRating || newRating < 1 || newRating > 10) return alert("Введите корректную оценку от 1 до 10.");
    await setDoc(doc(db, "userSoloStatuses", `${currentUid}_${game.id}`), {
      status: "Пройдена",
      rating: newRating
    });
    alert("Оценка сохранена!");
  });

  gamesListEl.appendChild(card);
}

function toggleRating(status, ratingInput, saveRatingBtn) {
  const enabled = status === "Пройдена";
  ratingInput.disabled = !enabled;
  saveRatingBtn.disabled = !enabled;
}

// Фильтрация
searchInput.addEventListener("input", renderGames);
filterGenre.addEventListener("change", renderGames);

// Админ: добавление игры
addGameBtn.addEventListener("click", () => {
  addGameModal.style.display = "flex";
});

closeModalBtn.addEventListener("click", () => {
  addGameModal.style.display = "none";
});

saveGameBtn.addEventListener("click", async () => {
  if (!newTitle.value.trim()) return alert("Введите название игры.");
  await addDoc(collection(db, "soloGames"), {
    title: newTitle.value.trim(),
    image: newImage.value.trim(),
    description: newDesc.value.trim(),
    category: newGenre.value
  });
  addGameModal.style.display = "none";
  newTitle.value = "";
  newImage.value = "";
  newDesc.value = "";
  newGenre.value = allGenres[0];
  loadGames();
});
