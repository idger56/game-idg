// Обновлённый solo.js — работа с коллекцией `soloGames`, персональные статусы/оценки/комментарии,
// и мини-профиль с возможностью оставить 1 комментарий (и редактировать свой).
// Важно: я вношу изменения аккуратно, не удаляя существующую логику, а расширяя.

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
  setDoc,
  deleteDoc,
  orderBy
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

// Элементы — безопасно получаем (возможно некоторые элементы находятся в другом файле HTML)
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
let currentUserUid = null;

function clearAuthMessage() {
  if (authMessage) authMessage.textContent = "";
}

// Обновление lastSeen/status — сохраняем, но бережно если пользователей нет
async function updateUserLastSeen(uid) {
  if (!uid) return;
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { lastSeen: Date.now() });
  } catch (e) {
    console.error("Ошибка обновления lastSeen:", e);
  }
}

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

let lastSeenIntervalId = null;
let userStatusIntervalId = null;

// ====== Помощники для персональных данных (статус/оценка/комментарий) ======
// Используем коллекции: soloStatuses, soloRatings, soloComments
// Для удобства документ статуса/рейтинга имеет id `${userId}_${gameId}`

function statusDocId(userId, gameId) {
  return `${userId}_${gameId}`;
}

function ratingDocId(userId, gameId) {
  return `${userId}_${gameId}`;
}

// Получить статус текущего пользователя для конкретной игры
async function getUserStatusForGame(userId, gameId) {
  try {
    const d = await getDoc(doc(db, "soloStatuses", statusDocId(userId, gameId)));
    if (d.exists()) return d.data().status;
  } catch (e) { console.error(e); }
  return null;
}

// Установить/обновить статус
async function setUserStatusForGame(userId, gameId, status) {
  try {
    await setDoc(doc(db, "soloStatuses", statusDocId(userId, gameId)), {
      userId,
      gameId,
      status,
      updatedAt: Date.now()
    });
  } catch (e) { console.error("setUserStatusForGame:", e); }
}

// Получить рейтинг пользователя для игры
async function getUserRatingForGame(userId, gameId) {
  try {
    const d = await getDoc(doc(db, "soloRatings", ratingDocId(userId, gameId)));
    if (d.exists()) return d.data().rating;
  } catch (e) { console.error(e); }
  return null;
}

async function setUserRatingForGame(userId, gameId, rating) {
  try {
    await setDoc(doc(db, "soloRatings", ratingDocId(userId, gameId)), {
      userId,
      gameId,
      rating,
      updatedAt: Date.now()
    });
  } catch (e) { console.error("setUserRatingForGame:", e); }
}

// Комментарии: каждый пользователь может иметь один комментарий на игру.
// Документ можно хранить с id `${userId}_${gameId}` в коллекции soloComments
async function getCommentsForGame(gameId) {
  try {
    const q = query(collection(db, "soloComments"), where("gameId", "==", gameId), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error(e); return []; }
}

async function getUserCommentForGame(userId, gameId) {
  try {
    const d = await getDoc(doc(db, "soloComments", `${userId}_${gameId}`));
    if (d.exists()) return { id: d.id, ...d.data() };
  } catch (e) { console.error(e); }
  return null;
}

async function setUserCommentForGame(userId, gameId, nickname, text) {
  try {
    await setDoc(doc(db, "soloComments", `${userId}_${gameId}`), {
      userId,
      gameId,
      nickname,
      text,
      createdAt: Date.now()
    });
  } catch (e) { console.error(e); }
}

// Удалить комментарий (если надо)
async function deleteUserComment(userId, gameId) {
  try {
    await deleteDoc(doc(db, "soloComments", `${userId}_${gameId}`));
  } catch (e) { console.error(e); }
}

// ====== Авторизация и UI поведение ======

onAuthStateChanged(auth, async (user) => {
  clearAuthMessage();

  if (user) {
    currentUserUid = user.uid;

    await updateUserStatus(user.uid, "online");
    await updateUserLastSeen(user.uid);

    if (lastSeenIntervalId) clearInterval(lastSeenIntervalId);
    lastSeenIntervalId = setInterval(() => updateUserLastSeen(user.uid), 60000);

    if (userStatusIntervalId) clearInterval(userStatusIntervalId);
    userStatusIntervalId = setInterval(() => updateUserStatus(user.uid, "online"), 60000);

    if (authSection) authSection.style.display = "none";
    if (mainSection) mainSection.style.display = "block";
    if (authBtn) authBtn.textContent = "Выход";
    if (nicknameSpan) { nicknameSpan.style.display = "inline"; nicknameSpan.textContent = user.displayName || user.email; }

    window.addEventListener("beforeunload", async () => { await updateUserStatus(user.uid, "offline"); });

    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "hidden") {
        await updateUserStatus(user.uid, "offline");
      } else if (document.visibilityState === "visible") {
        await updateUserStatus(user.uid, "online");
      }
    });

    // Загружаем игры и отображаем
    await loadGames();
  } else {
    // пользователь вышел
    if (lastSeenIntervalId) { clearInterval(lastSeenIntervalId); lastSeenIntervalId = null; }
    if (userStatusIntervalId) { clearInterval(userStatusIntervalId); userStatusIntervalId = null; }

    if (currentUserUid) {
      await updateUserStatus(currentUserUid, "offline");
      currentUserUid = null;
    }

    if (authSection) authSection.style.display = "block";
    if (mainSection) mainSection.style.display = "none";
    if (authBtn) authBtn.textContent = "Вход";
    if (nicknameSpan) { nicknameSpan.style.display = "none"; nicknameSpan.textContent = ""; }
  }
});

if (authBtn) {
  authBtn.addEventListener("click", async () => {
    if (auth.currentUser) {
      if (lastSeenIntervalId) { clearInterval(lastSeenIntervalId); lastSeenIntervalId = null; }
      if (userStatusIntervalId) { clearInterval(userStatusIntervalId); userStatusIntervalId = null; }

      await updateUserStatus(auth.currentUser.uid, "offline");
      await signOut(auth);
      window.location.href = "index.html"; // можно изменить поведение
    }
  });
}

// Фильтры
if (searchInput) searchInput.addEventListener("input", applyFilters);
if (filterCategory) filterCategory.addEventListener("change", applyFilters);
if (filterStatus) filterStatus.addEventListener("change", applyFilters);

// Обработчик формы добавления (админ). Отличие: коллекция soloGames
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || user.email !== adminEmail) return;

    const title = document.getElementById("title").value.trim();
    const category = Array.from(document.getElementById("category").selectedOptions).map(o => o.value);
    const link = document.getElementById("link").value.trim();
    const image = document.getElementById("image").value.trim();
    const status = document.getElementById("status").value;
    const description = document.getElementById("description")?.value?.trim() || ""; // если админ добавит поле description в форму

    if (!title || category.length === 0 || !link || !image || !status) {
      alert("Пожалуйста, заполните все поля.");
      return;
    }

    const customId = title.toLowerCase().replace(/\s+/g, "_");
    const gameRef = doc(db, "soloGames", customId);

    await setDoc(gameRef, { title, category, link, image, status, description });
    form.reset();
    loadGames();
  });
}

// Загрузка игр из коллекции soloGames
async function loadGames() {
  try {
    const snap = await getDocs(collection(db, "soloGames"));
    allGames = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    applyFilters();
  } catch (e) { console.error("loadGames:", e); }
}

// При фильтрации по статус — учитываем статус текущего пользователя
async function applyFilters() {
  const user = auth.currentUser;
  const title = (searchInput?.value || "").toLowerCase();
  const category = filterCategory?.value || "";
  const statusFilter = filterStatus?.value || "";

  // Если фильтруем по статус — загрузим все статусы текущего пользователя
  let userStatuses = {};
  if (statusFilter && user) {
    try {
      const q = query(collection(db, "soloStatuses"), where("userId", "==", user.uid));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const data = d.data();
        userStatuses[data.gameId] = data.status;
      }
    } catch (e) { console.error(e); }
  }

  const filtered = allGames.filter(game => {
    const matchesTitle = game.title.toLowerCase().includes(title);
    const matchesCategory = category
      ? (Array.isArray(game.category) ? game.category.includes(category) : game.category === category)
      : true;

    let matchesStatus = true;
    if (statusFilter) {
      if (!user) return false; // если фильтр по статусу, но нет юзера — ничего не показываем
      const myStatus = userStatuses[game.id] || null;
      // В UI фильтрStatus содержит значения "Пройдена", "Прохожу" (видимо), "Не прошел" — в нашем сохранении статус должны быть согласованы
      // Везде используем статусы: "Пройдена", "В процессе", "В планах"
      if (statusFilter === "Пройдена") matchesStatus = myStatus === "Пройдена";
      else if (statusFilter === "В процессе") matchesStatus = myStatus === "В процессе";
      else if (statusFilter === "В планах") matchesStatus = myStatus === "В планах";
      else matchesStatus = myStatus === statusFilter;
    }

    return matchesTitle && matchesCategory && matchesStatus;
  });

  const renderToken = ++currentRenderToken;
  await renderGames(filtered, auth.currentUser, renderToken);
}

// Рендер карточек — добавляем: кнопка мини-профиля, персональный статус, комменты, рейтинги хранятся в soloRatings
async function renderGames(games, user, renderToken = currentRenderToken) {
  if (!gamesList) return;
  gamesList.innerHTML = "";

  // Предзагрузим все средние оценки для этих игр (чтобы не делать много запросов в цикле)
  const gameIds = games.map(g => g.id);
  const avgRatings = {};
  try {
    const ratingsSnap = await getDocs(collection(db, "soloRatings"));
    for (const r of ratingsSnap.docs) {
      const d = r.data();
      if (!gameIds.includes(d.gameId)) continue;
      avgRatings[d.gameId] = avgRatings[d.gameId] || { sum: 0, count: 0 };
      avgRatings[d.gameId].sum += d.rating;
      avgRatings[d.gameId].count += 1;
    }
  } catch (e) { console.error(e); }

  // Предзагрузим статусы текущего пользователя для всех игровых id (если есть пользователь)
  let myStatuses = {};
  if (user) {
    try {
      const q = query(collection(db, "soloStatuses"), where("userId", "==", user.uid));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const data = d.data(); myStatuses[data.gameId] = data.status;
      }
    } catch (e) { console.error(e); }
  }

  for (const game of games) {
    if (renderToken !== currentRenderToken) return;
    const gameId = game.id;

    const avgInfo = avgRatings[gameId];
    const avgRating = avgInfo ? (avgInfo.sum / avgInfo.count).toFixed(1) : null;

    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <img src="${game.image}" alt="${game.title}" />
      <div class="game-content">
        <h3>${game.title}</h3>
        <p>Категория: ${Array.isArray(game.category) ? game.category.join(", ") : game.category}</p>
        <p>Статус: ${game.status || "—"}</p>
<div class="rating-summary">
  <span class="rating-label"><strong>Средняя:</strong> ${avgRating ?? "—"} ⭐</span>
  <span class="rating-label"><strong>Ваша:</strong> — ⭐</span>
</div>
        <div class="download-btn-wrapper">
  <a class="download-btn" href="${game.link}" target="_blank">Скачать / Перейти</a>
</div>

      </div>
    `;

    const content = card.querySelector(".game-content");

    // Блок выбора персонального статуса
    if (user) {
      const myStatus = myStatuses[gameId] || "";
      const statusWrapper = document.createElement("div");
      statusWrapper.className = "status-wrapper";
      statusWrapper.style.marginTop = "10px";
      statusWrapper.innerHTML = `
        <label>Ваш статус: 
          <select data-game-id="${gameId}" class="styled-select user-status-select">
            <option value="">—</option>
            <option value="Пройдена" ${myStatus === "Пройдена" ? "selected" : ""}>Пройдена</option>
            <option value="В процессе" ${myStatus === "В процессе" ? "selected" : ""}>В процессе</option>
            <option value="В планах" ${myStatus === "В планах" ? "selected" : ""}>В планах</option>
          </select>
        </label>
      `;
      content.appendChild(statusWrapper);

      statusWrapper.querySelector("select").addEventListener("change", async (e) => {
        const newStatus = e.target.value;
        await setUserStatusForGame(user.uid, gameId, newStatus);
        // Если пользователь снял статус с "Пройдена", то удаляем его рейтинг (по требованию: оценивать можно только если пройдено)
        if (newStatus !== "Пройдена") {
          try {
            await deleteDoc(doc(db, "soloRatings", ratingDocId(user.uid, gameId)));
          } catch (err) { /* ignore */ }
        }
        // Перерисовка фильтров/карточек
        await applyFilters();
      });

      // Если пользователь уже пометил как "Пройдена", покажем блок рейтинга (его персональную оценку можно редактировать)
      if (myStatus === "Пройдена") {
        const userRating = await getUserRatingForGame(user.uid, gameId);
        const ratingWrapper = document.createElement("div");
        ratingWrapper.className = "rating-form";
        ratingWrapper.innerHTML = `
          <div class="rating-block">
            <label class="rating-label">
              Ваша оценка:
              <select data-game-id="${gameId}" class="rating-select styled-select user-rating-select">
                <option value="">Выберите</option>
                ${Array.from({ length: 10 }, (_, i) => {
                  const val = i + 1; const selected = userRating === val ? "selected" : ""; return `<option value="${val}" ${selected}>${val} ⭐</option>`;
                }).join('')}
              </select>
            </label>
          </div>
        `;
        content.appendChild(ratingWrapper);

        ratingWrapper.querySelector("select").addEventListener("change", async (e) => {
          const rating = parseInt(e.target.value);
          if (!user || isNaN(rating)) return;
          await setUserRatingForGame(user.uid, gameId, rating);
          // Перерисуем
          await applyFilters();
        });
      }
    }

    // Кнопка мини-профиля — всегда доступна
    const miniBtn = document.createElement("button");
    miniBtn.textContent = "ℹ Мини-профиль";
    miniBtn.className = "mt-10";
    miniBtn.style.marginLeft = "8px";
    miniBtn.addEventListener("click", async () => {
      await openMiniProfile(game, user);
    });
    content.appendChild(miniBtn);

    // Если пользователь — админ, добавить редактирование (как было)
    if (user && user.email === adminEmail) {
      const editBtn = document.createElement("button");
      editBtn.textContent = "✏️ Редактировать";
      editBtn.className = "edit-button mt-10";
      editBtn.style.marginBottom = "10px";

      editBtn.addEventListener("click", () => addEditForm(card, game));
      content.appendChild(editBtn);
    }

    if (renderToken !== currentRenderToken) return;
    gamesList.appendChild(card);
  }
}

// Вспомогательная функция для админ-редактирования (минимально трогает существующую логику)
function addEditForm(card, game) {
  const allGenres = [
    "Экшен","Шутер от первого лица","Шутер от третьего лица","Battle Royale","RPG","MMORPG","Выживание","Песочница","Приключения","Хоррор","Открытый мир","Souls-like",
    "Файтинг","Гонки","Платформер","Стратегия","Пошаговая стратегия","Тактический шутер","МОБА","Симулятор","Карточная игра","Спорт","Кооператив","Онлайн PvP",
    "Головоломка","Зомби","Тактическая стратегия","Roguelike","Roguelite","Метроидвания","Визуальная новелла","Музыкальная","Квест","Киберпанк","Фэнтези","Историческая","Менеджмент","Стелс","Хакерство","Космос"
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
    <option value="${genre}" ${game.category && game.category.includes && game.category.includes(genre) ? "selected" : ""}>${genre}</option>
  `).join('')}
</select>
    <input type="text" name="description" value="${(game.description||"").replace(/\"/g,'\"')}" class="form-input" />
    <button type="submit" class="save-button">Сохранить</button>
  </form>
`;

  card.querySelector('.game-content').innerHTML += formHtml;
  const editForm = card.querySelector('.edit-form');
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedTitle = editForm.title.value.trim();
    const updatedImage = editForm.image.value.trim();
    const updatedLink = editForm.link.value.trim();
    const updatedStatus = editForm.status.value;
    const updatedCategory = Array.from(editForm.category.selectedOptions).map(o => o.value);
    const updatedDescription = editForm.description.value.trim();

    try {
      const gameRef = doc(db, 'soloGames', game.id);
      await updateDoc(gameRef, {
        title: updatedTitle,
        image: updatedImage,
        link: updatedLink,
        status: updatedStatus,
        category: updatedCategory,
        description: updatedDescription
      });
      alert('Игра обновлена!');
      await loadGames();
    } catch (error) {
      alert('Ошибка при обновлении: ' + error.message);
    }
  });
}

// Открыть мини-профиль (модалка) с описанием и комментариями
async function openMiniProfile(game, user) {
  // Создаем оверлей
  const overlay = document.createElement('div');
  overlay.className = 'mini-profile-overlay';

  const box = document.createElement('div');
  box.className = 'mini-profile';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-mini-profile';
  closeBtn.textContent = '✖';
  closeBtn.addEventListener('click', () => document.body.removeChild(overlay));

  box.appendChild(closeBtn);

  const img = document.createElement('img');
  img.src = game.image;
  box.appendChild(img);

  const title = document.createElement('h2');
  title.textContent = game.title;
  box.appendChild(title);

  const desc = document.createElement('p');
  desc.textContent = game.description || 'Описание отсутствует.';
  box.appendChild(desc);

  // Комментарии
  const commentsCont = document.createElement('div');
  commentsCont.className = 'comment-section';
  commentsCont.innerHTML = '<h3>Комментарии</h3>';
  box.appendChild(commentsCont);

  // Загрузка и рендер комментариев
  async function refreshComments() {
    commentsCont.querySelectorAll('.comment').forEach(n => n.remove());
    const comments = await getCommentsForGame(game.id);
    for (const c of comments) {
      const com = document.createElement('div');
      com.className = 'comment';
      com.innerHTML = `
        <div class="comment-author">${c.nickname || 'Аноним'}</div>
        <p class="comment-text">${escapeHtml(c.text || '')}</p>
      `;
      // Кнопки редактирования/удаления только для автора
      if (user && c.userId === user.uid) {
        const actions = document.createElement('div');
        actions.className = 'comment-actions';
        const editBtn = document.createElement('button'); editBtn.textContent = 'Редактировать';
        const delBtn = document.createElement('button'); delBtn.textContent = 'Удалить';
        editBtn.addEventListener('click', () => showEditForm(c));
        delBtn.addEventListener('click', async () => {
          if (!confirm('Удалить комментарий?')) return;
          await deleteUserComment(user.uid, game.id);
          await refreshComments();
        });
        actions.appendChild(editBtn); actions.appendChild(delBtn); com.appendChild(actions);
      }
      commentsCont.appendChild(com);
    }
  }

  // Форма добавления/редактирования комментария (для текущего юзера)
  async function showEditForm(existing) {
    // Удаляем старую форму если есть
    const old = box.querySelector('.comment-form'); if (old) old.remove();

    const form = document.createElement('form'); form.className = 'comment-form';
    form.innerHTML = `
      <textarea name="text" rows="4" style="width:100%;padding:8px;border-radius:8px;border:1px solid #ccc;">${existing ? escapeHtml(existing.text) : ''}</textarea>
      <div style="margin-top:8px;display:flex;gap:8px;">
        <button type="submit" class="submit-button">Сохранить</button>
        <button type="button" class="submit-button cancel">Отмена</button>
      </div>
    `;
    box.appendChild(form);

    form.querySelector('.cancel').addEventListener('click', () => { form.remove(); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!user) { alert('Нужно войти'); return; }
      const text = form.text.value.trim();
      if (!text) { alert('Введите текст'); return; }
      await setUserCommentForGame(user.uid, game.id, user.displayName || user.email || 'Пользователь', text);
      form.remove();
      await refreshComments();
    });
  }

  // Если пользователь залогинен — покажем кнопку добавить/редактировать
  if (user) {
    const userComment = await getUserCommentForGame(user.uid, game.id);
    const btn = document.createElement('button');
    btn.className = 'mt-10';
    btn.textContent = userComment ? 'Редактировать ваш комментарий' : 'Оставить комментарий';
    btn.addEventListener('click', () => showEditForm(userComment));
    box.appendChild(btn);
  } else {
    const hint = document.createElement('p'); hint.style.color = '#666'; hint.textContent = 'Войдите, чтобы оставлять комментарии.'; box.appendChild(hint);
  }

  await refreshComments();

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// Простая экранировка html в тексте комментариев
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>\"']/g, function (s) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s];
  });
}

// Экспорт / сделать доступным — нет (скрипт подключается как module в HTML)

// Конец файла
