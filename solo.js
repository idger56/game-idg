// solo.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc, setDoc, getDoc, addDoc, updateDoc, serverTimestamp, query, where
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

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

let currentUser = null;
let myStatuses = {}; // { gameId: "Пройдена" }
let userNickname = "";

const mainSection = document.getElementById("main-section");
const gamesListEl = document.getElementById("games-list"); // <-- должен быть в HTML
const addGameBtn = document.getElementById("add-game-btn");
const logoutBtn = document.getElementById("logout-btn");
const addGameForm = document.getElementById("add-game-form");

const searchInput = document.getElementById("search-input");
const filterCategory = document.getElementById("filter-category");
const filterStatus = document.getElementById("filter-status");

let loadedGames = [];

// safety: if container missing, create one
if (!gamesListEl) {
  console.warn("#games-list not found in DOM — creating fallback");
  const fallback = document.createElement("div");
  fallback.id = "games-list";
  fallback.className = "games-grid";
  mainSection.appendChild(fallback);
}

// logout
logoutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    location.href = "index.html";
  } catch (e) {
    console.error("Sign out error:", e);
  }
});

// Загружаем статусы текущего пользователя
async function loadMyStatuses() {
  myStatuses = {};
  if (!currentUser) return;
  try {
    const q = query(
      collection(db, "soloStatuses"),
      where("userId", "==", currentUser.uid)
    );
    const snap = await getDocs(q);
    snap.forEach(d => {
      const data = d.data();
      if (data && data.gameId) myStatuses[data.gameId] = data.status;
    });
  } catch (e) {
    console.error("loadMyStatuses error", e);
  }
}

// auth
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;

    // Показываем основную секцию
    if (mainSection) mainSection.style.display = "block";

    // Загружаем ник из Firestore
    try {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      let nicknameFromDb = "";
      if (snap.exists()) {
        nicknameFromDb = snap.data().nickname || user.email.split("@")[0];
      } else {
        nicknameFromDb = user.email.split("@")[0];
      }
      const nicknameEl = document.getElementById("user-nickname");
if (nicknameEl) {
  nicknameEl.textContent = `👤 ${nicknameFromDb}`;
}
    } catch (err) {
      console.error("Ошибка загрузки ника:", err);
    }

    // Админские элементы
    if (user.email === "boreko.ivan@gmail.com") {
      const toggleAddGameBtn = document.getElementById("toggle-add-game-btn");
      if (toggleAddGameBtn) {
        toggleAddGameBtn.style.display = "inline-block";
        toggleAddGameBtn.addEventListener("click", () => {
          const addFormContainer = document.getElementById("add-form-container");
          if (addFormContainer) {
            if (addFormContainer.style.display === "none" || !addFormContainer.style.display) {
              addFormContainer.style.display = "block";
            } else {
              addFormContainer.style.display = "none";
            }
          }
        });
      }
      // Скрываем форму по умолчанию
      const addFormContainer = document.getElementById("add-form-container");
      if (addFormContainer) addFormContainer.style.display = "none";
    }

    // Загружаем статусы и игры
    await loadMyStatuses();
    await loadGames();

  } else {
    currentUser = null;
    if (mainSection) {
      mainSection.innerHTML = `<p style="text-align:center;">Войдите, чтобы увидеть список игр.</p>`;
    }
  }
});


// Добавление игры (только админ)
addGameForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser || currentUser.email !== "boreko.ivan@gmail.com") {
    alert("Только админ может добавлять игры.");
    return;
  }

  try {
    const title = document.getElementById("title").value.trim();
    const category = Array.from(document.getElementById("category").selectedOptions).map(o => o.value);
    const link = document.getElementById("link").value.trim();
    const image = document.getElementById("image").value.trim();

    if (!title) { 
      alert("Введите название"); 
      return; 
    }

    // Генерация ID из названия
    const gameId = title
      .toLowerCase()
      .replace(/[^a-z0-9а-яё\s]/gi, "") // убираем лишние символы
      .replace(/\s+/g, "_");            // пробелы -> _

    await setDoc(doc(db, "soloGames", gameId), {
      title,
      category,
      link,
      image,
      createdAt: serverTimestamp()
    });

    addGameForm.reset();
    alert("Игра добавлена");
    await loadGames();
  } catch (err) {
    console.error("add game error", err);
    alert("Ошибка добавления игры. Проверьте консоль.");
  }
});


// load all games
async function loadGames() {
  try {
    const snap = await getDocs(collection(db, "soloGames"));
    loadedGames = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGames();
  } catch (e) {
    console.error("loadGames error", e);
    gamesListEl.innerHTML = "<p style='padding:12px;'>Ошибка загрузки игр.</p>";
  }
}

// render with filters (including status filter based on myStatuses)
function renderGames() {
  if (!gamesListEl) return;
  gamesListEl.innerHTML = "";
  const searchText = (searchInput?.value || "").toLowerCase();
  const genreFilter = filterCategory?.value || "";
  const statusFilter = filterStatus?.value || "";

  const filtered = loadedGames.filter(game => {
    if (searchText && !game.title.toLowerCase().includes(searchText)) return false;
    if (genreFilter) {
      if (Array.isArray(game.category)) {
        if (!game.category.includes(genreFilter)) return false;
      } else {
        if (game.category !== genreFilter) return false;
      }
    }
    // filter by user's status: if statusFilter set, show only games where myStatuses[game.id] === statusFilter
    if (statusFilter) {
      const s = myStatuses[game.id] || "Не пройдена";
      if (s !== statusFilter) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    gamesListEl.innerHTML = `<p style="padding:12px;">Игры не найдены.</p>`;
    return;
  }

  // render each
  filtered.forEach(game => createGameCard(game).then(card => gamesListEl.appendChild(card)));
}

// create card DOM (includes status select, rating select, admin edit)
async function createGameCard(game) {
  const card = document.createElement("div");
  card.className = "game-card";

  const img = game.image || "assets/default-game.png";
  const genres = Array.isArray(game.category) ? game.category.join(", ") : (game.category || "Не указан");
  const link = game.link || "#";

  card.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%">
      <img src="${img}" alt="${escapeHtml(game.title)}" style="width:100%;height:220px;object-fit:cover;">
      <div class="game-content" style="padding:16px;display:flex;flex-direction:column;flex:1;">
        <h3 style="margin:0 0 8px 0;">${escapeHtml(game.title)}</h3>
        <p style="margin:0 0 8px 0;"><strong>Жанр:</strong> ${escapeHtml(genres)}</p>
        <p style="margin:0 0 12px 0;">${escapeHtml(game.description || "")}</p>

        <!-- Блок выбора статуса -->
        <div class="user-status-block" style="margin-bottom:8px;"></div>

        <!-- Блок выбора своей оценки -->
        <div class="user-rating-block" style="margin-bottom:12px;">
          <label><strong>Ваша оценка:</strong>
            <select class="rating-select">
              ${Array.from({length: 11}, (_, i) => `<option value="${i}">${i}</option>`).join("")}
            </select>
          </label>
        </div>

        <div style="margin-top:auto; display:flex; gap:8px; align-items:center;">
          <a class="download-btn" href="${link}" target="_blank" style="margin-right:auto;">Перейти</a>
          <button class="open-profile-btn">📄 Профиль</button>
          ${currentUser && currentUser.email === "boreko.ivan@gmail.com" ? '<button class="edit-game-btn">✏️ Редактировать</button>' : ''}
        </div>
      </div>
    </div>
  `;

  // === СТАТУС ИГРЫ ===
  const statusBlock = card.querySelector(".user-status-block");
  const select = document.createElement("select");
  select.className = "status-select";
  ["Не пройдена", "В процессе", "Пройдена"].forEach(s => {
    const o = document.createElement("option");
    o.value = s;
    o.textContent = s;
    select.appendChild(o);
  });
  const currentStatus = myStatuses[game.id] || "Не пройдена";
  select.value = currentStatus;
  statusBlock.appendChild(select);

  select.addEventListener("change", async () => {
    try {
      const ref = doc(db, "soloStatuses", `${currentUser.uid}_${game.id}`);
      await setDoc(ref, {
        userId: currentUser.uid,
        gameId: game.id,
        status: select.value,
        updatedAt: serverTimestamp()
      });
      myStatuses[game.id] = select.value;
      if (filterStatus?.value) renderGames();
    } catch (e) {
      console.error("set status error", e);
    }
  });

  // === ЛИЧНАЯ ОЦЕНКА ===
  const ratingSelect = card.querySelector(".rating-select");
  try {
    const ratingRef = doc(db, "soloRatings", `${currentUser.uid}_${game.id}`);
    const snap = await getDoc(ratingRef);
    if (snap.exists()) {
      ratingSelect.value = snap.data().rating ?? 0;
    }
  } catch (e) {
    console.error("Ошибка загрузки оценки:", e);
  }

  ratingSelect.addEventListener("change", async () => {
    try {
      const ratingValue = parseInt(ratingSelect.value);
      const ratingRef = doc(db, "soloRatings", `${currentUser.uid}_${game.id}`);
      await setDoc(ratingRef, {
        userId: currentUser.uid,
        gameId: game.id,
        rating: ratingValue,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Ошибка сохранения оценки:", e);
    }
  });

  // кнопка мини-профиля
  const profileBtn = card.querySelector(".open-profile-btn");
  if (profileBtn) {
    profileBtn.addEventListener("click", () => openMiniProfile(game));
  }

  // admin edit
  const editBtn = card.querySelector(".edit-game-btn");
  if (editBtn) {
    editBtn.addEventListener("click", () => openEditModal(game));
  }

  return card;
}

// load comments for a given game
async function loadComments(gameId, container) {
  container.innerHTML = ""; // clear

  // my comment doc id
  const myDocId = currentUser ? `${currentUser.uid}_${gameId}` : null;

  // form to create / edit own comment
  const myArea = document.createElement("div");
  myArea.style.marginBottom = "12px";

  const textarea = document.createElement("textarea");
  textarea.placeholder = "Ваш комментарий...";
  textarea.style.width = "100%";
  textarea.style.minHeight = "60px";

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Сохранить";

  // load my comment if exists
  let myCommentData = null;
  if (myDocId) {
    const myRef = doc(db, "soloComments", myDocId);
    try {
      const snap = await getDoc(myRef);
      if (snap.exists()) myCommentData = snap.data();
    } catch (e) {
      console.error("load my comment error", e);
    }
  }
  if (myCommentData) textarea.value = myCommentData.text || "";

  saveBtn.addEventListener("click", async () => {
    if (!currentUser) { alert("Войдите чтобы комментировать."); return; }
    const text = textarea.value.trim();
    try {
      await setDoc(doc(db, "soloComments", myDocId), {
        userId: currentUser.uid,
        gameId,
        text,
        likesCount: myCommentData?.likesCount || 0,
        dislikesCount: myCommentData?.dislikesCount || 0,
        votes: myCommentData?.votes || {}
      });
      await loadComments(gameId, container); // refresh
    } catch (e) {
      console.error("save comment error", e);
      alert("Ошибка сохранения комментария.");
    }
  });

  myArea.appendChild(textarea);
  myArea.appendChild(saveBtn);
  container.appendChild(myArea);

  // load all comments for this game (query)
  try {
    const q = query(collection(db, "soloComments"), where("gameId", "==", gameId));
    const snap = await getDocs(q);
    const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // sort by likes - optional
    comments.sort((a,b) => (b.likesCount || 0) - (a.likesCount || 0));

    for (const c of comments) {
      const row = document.createElement("div");
      row.style.borderTop = "1px solid #eee";
      row.style.padding = "8px 0";

      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.justifyContent = "space-between";
      header.style.alignItems = "center";

      const who = document.createElement("div");
      who.textContent = (c.userId === currentUser?.uid) ? "Вы" : c.userId; // you can replace userId with nickname if available
      who.style.fontWeight = "700";

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "8px";
      // like button
const likeBtn = document.createElement("button");
likeBtn.className = "like-btn";
likeBtn.textContent = `👍 ${c.likesCount || 0}`;

const dislikeBtn = document.createElement("button");
dislikeBtn.className = "dislike-btn";
dislikeBtn.textContent = `👎 ${c.dislikesCount || 0}`;

// Подсветка активной
const myVote = c.votes?.[currentUser?.uid];
if (myVote === "like") likeBtn.classList.add("active");
if (myVote === "dislike") dislikeBtn.classList.add("active");


      likeBtn.addEventListener("click", () => voteComment(c, "like", gameId, container));
      dislikeBtn.addEventListener("click", () => voteComment(c, "dislike", gameId, container));

      actions.appendChild(likeBtn);
      actions.appendChild(dislikeBtn);

      // if this is my comment, allow quick edit button to put text into textarea above
      if (c.userId === currentUser?.uid) {
        const editOwn = document.createElement("button");
        editOwn.textContent = "Редактировать";
        editOwn.addEventListener("click", () => {
          textarea.value = c.text || "";
          // set myCommentData for proper saving of likes counts etc
          myCommentData = c;
        });
        actions.appendChild(editOwn);
      }

      header.appendChild(who);
      header.appendChild(actions);

      const textNode = document.createElement("div");
      textNode.style.marginTop = "6px";
      textNode.textContent = c.text || "";

      row.appendChild(header);
      row.appendChild(textNode);
      container.appendChild(row);
    }
  } catch (e) {
    console.error("loadComments error", e);
    container.appendChild(document.createElement("div")).textContent = "Ошибка загрузки комментариев.";
  }
}

// vote logic
async function voteComment(comment, type, gameId, container) {
  try {
    const ref = doc(db, "soloComments", comment.id);
    // copy local to mutate
    const votes = { ...(comment.votes || {}) };
    const prev = votes[currentUser.uid];

    if (prev === type) {
      // undo
      delete votes[currentUser.uid];
      if (type === "like") comment.likesCount = (comment.likesCount || 1) - 1;
      else comment.dislikesCount = (comment.dislikesCount || 1) - 1;
    } else {
      // switch or add
      votes[currentUser.uid] = type;
      if (type === "like") {
        comment.likesCount = (comment.likesCount || 0) + 1;
        if (prev === "dislike") comment.dislikesCount = (comment.dislikesCount || 0) - 1;
      } else {
        comment.dislikesCount = (comment.dislikesCount || 0) + 1;
        if (prev === "like") comment.likesCount = (comment.likesCount || 0) - 1;
      }
    }

    await updateDoc(ref, {
      likesCount: comment.likesCount,
      dislikesCount: comment.dislikesCount,
      votes
    });

    // reload comments block
    await loadComments(gameId, container);
  } catch (e) {
    console.error("voteComment error", e);
  }
}

// admin edit modal (simple)
function openEditModal(game) {
  // create modal elements
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.left = 0;
  overlay.style.top = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.5)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = 9999;

  const box = document.createElement("div");
  box.style.background = "#fff";
  box.style.padding = "16px";
  box.style.borderRadius = "8px";
  box.style.width = "420px";
  box.style.maxHeight = "90vh";
  box.style.overflow = "auto";

  box.innerHTML = `
    <h3>Редактировать игру</h3>
    <label>Название<br><input id="e-title" type="text" value="${escapeHtmlAttr(game.title)}" style="width:100%"></label><br><br>
    <label>Картинка URL<br><input id="e-image" type="text" value="${escapeHtmlAttr(game.image||'')}" style="width:100%"></label><br><br>
    <label>Ссылка<br><input id="e-link" type="text" value="${escapeHtmlAttr(game.link||'')}" style="width:100%"></label><br><br>
    <label>Жанры (через запятую)<br><input id="e-cats" type="text" value="${escapeHtmlAttr((game.category||[]).join(', '))}" style="width:100%"></label><br><br>
    <label>Описание<br><textarea id="e-desc" style="width:100%">${escapeHtmlAttr(game.description||'')}</textarea></label><br><br>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button id="e-save">Сохранить</button>
      <button id="e-cancel">Отмена</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById("e-cancel").addEventListener("click", () => {
    overlay.remove();
  });

  document.getElementById("e-save").addEventListener("click", async () => {
    const t = document.getElementById("e-title").value.trim();
    const img = document.getElementById("e-image").value.trim();
    const l = document.getElementById("e-link").value.trim();
    const cats = document.getElementById("e-cats").value.split(",").map(s => s.trim()).filter(Boolean);
    const desc = document.getElementById("e-desc").value.trim();

    if (!t) { alert("Название обязательно"); return; }

    try {
      await updateDoc(doc(db, "soloGames", game.id), {
        title: t,
        image: img,
        link: l,
        category: cats,
        description: desc,
        updatedAt: serverTimestamp()
      });
      overlay.remove();
      await loadGames();
    } catch (e) {
      console.error("save edit error", e);
      alert("Ошибка при сохранении");
    }
  });
}

// small helpers
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function escapeHtmlAttr(str) {
  if (!str) return "";
  return String(str).replaceAll('"', "&quot;");
}

// wire filters/search
searchInput?.addEventListener("input", () => renderGames());
filterCategory?.addEventListener("change", () => renderGames());
filterStatus?.addEventListener("change", () => renderGames());

function openMiniProfile(game) {
  const overlay = document.getElementById("mini-profile-overlay");
  const content = overlay.querySelector(".mini-profile-content");

  content.innerHTML = `
    <img src="${game.image}" alt="${escapeHtml(game.title)}">
    <h2>${escapeHtml(game.title)}</h2>
    <div class="genres"><strong>Жанры:</strong> ${escapeHtml(Array.isArray(game.category) ? game.category.join(", ") : game.category)}</div>
    <div class="avg-rating">Средняя оценка: ${game.avgRating || "—"}</div>
    <p>${escapeHtml(game.description || "Описание отсутствует.")}</p>
    <div id="mini-comments"></div>
  `;

  overlay.style.display = "flex";
  
  // Загрузим комментарии в мини-профиль
  const commentsContainer = content.querySelector("#mini-comments");
  loadComments(game.id, commentsContainer);
}

document.querySelector("#mini-profile-overlay").addEventListener("click", (e) => {
  if (e.target.id === "mini-profile-overlay" || e.target.classList.contains("close-mini-profile")) {
    e.currentTarget.style.display = "none";
  }
});
