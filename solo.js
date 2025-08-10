import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc, setDoc, getDoc, addDoc, updateDoc, serverTimestamp
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
const mainSection = document.getElementById("main-section");
const gamesListEl = document.createElement("div");
gamesListEl.classList.add("games-list");
mainSection.appendChild(gamesListEl);

const addGameBtn = document.getElementById("add-game-btn");
const logoutBtn = document.getElementById("logout-btn");
const addGameForm = document.getElementById("add-game-form");

// Выход
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  location.href = "index.html";
});

// Авторизация
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    mainSection.style.display = "block";
    if (user.email === "boreko.ivan@gmail.com") {
      addGameBtn.style.display = "inline-block";
      document.getElementById("add-form-container").style.display = "block";
    }
    await loadGames();
  } else {
    mainSection.innerHTML = `<p style="text-align:center;">Войдите, чтобы увидеть список игр.</p>`;
  }
});

// Добавление игры (только админ)
addGameForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("title").value.trim();
  const category = Array.from(document.getElementById("category").selectedOptions).map(o => o.value);
  const link = document.getElementById("link").value.trim();
  const image = document.getElementById("image").value.trim();

  await addDoc(collection(db, "soloGames"), {
    title, category, link, image,
    createdAt: serverTimestamp()
  });
  alert("Игра добавлена!");
  loadGames();
});

// Загрузка игр
async function loadGames() {
  const snapshot = await getDocs(collection(db, "soloGames"));
  const games = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  gamesListEl.innerHTML = "";
  for (const game of games) {
    const card = await createGameCard(game);
    gamesListEl.appendChild(card);
  }
}

// Создание карточки
async function createGameCard(game) {
  const card = document.createElement("div");
  card.classList.add("game-card");

  // Получаем статус игрока
  const statusRef = doc(db, "soloStatuses", `${currentUser.uid}_${game.id}`);
  const statusSnap = await getDoc(statusRef);
  let status = statusSnap.exists() ? statusSnap.data().status : "В планах";

  card.innerHTML = `
    <img src="${game.image}" alt="${game.title}">
    <h3>${game.title}</h3>
    <p><strong>Жанры:</strong> ${(game.category || []).join(", ")}</p>
    <a href="${game.link}" target="_blank">Скачать</a>
    <label>Статус:
      <select class="status-select">
        <option value="Пройдена">Пройдена</option>
        <option value="В процессе">В процессе</option>
        <option value="В планах">В планах</option>
      </select>
    </label>
    <button class="comments-btn">💬 Комментарии</button>
    <div class="comments-section" style="display:none;"></div>
  `;

  // Статус
  const select = card.querySelector(".status-select");
  select.value = status;
  select.addEventListener("change", async () => {
    await setDoc(statusRef, {
      userId: currentUser.uid,
      gameId: game.id,
      status: select.value
    });
  });

  // Кнопка комментариев
  const commentsBtn = card.querySelector(".comments-btn");
  const commentsSection = card.querySelector(".comments-section");

  commentsBtn.addEventListener("click", async () => {
    if (commentsSection.style.display === "none") {
      await loadComments(game.id, commentsSection);
      commentsSection.style.display = "block";
    } else {
      commentsSection.style.display = "none";
    }
  });

  return card;
}

// Загрузка комментариев
async function loadComments(gameId, container) {
  container.innerHTML = "";

  const snapshot = await getDocs(collection(db, "soloComments"));
  const comments = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => c.gameId === gameId);

  // Добавляем форму своего комментария
  let myComment = comments.find(c => c.userId === currentUser.uid);
  const textarea = document.createElement("textarea");
  textarea.placeholder = "Ваш комментарий...";
  textarea.value = myComment ? myComment.text : "";
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Сохранить";
  saveBtn.onclick = async () => {
    await setDoc(doc(db, "soloComments", `${currentUser.uid}_${gameId}`), {
      userId: currentUser.uid,
      gameId,
      text: textarea.value,
      likesCount: myComment?.likesCount || 0,
      dislikesCount: myComment?.dislikesCount || 0,
      votes: myComment?.votes || {}
    });
    loadComments(gameId, container);
  };

  container.appendChild(textarea);
  container.appendChild(saveBtn);

  // Список комментариев
  comments.forEach(comment => {
    const div = document.createElement("div");
    const likeBtn = document.createElement("button");
    const dislikeBtn = document.createElement("button");
    likeBtn.textContent = `👍 ${comment.likesCount || 0}`;
    dislikeBtn.textContent = `👎 ${comment.dislikesCount || 0}`;

    // Подсветка выбора
    const myVote = comment.votes?.[currentUser.uid];
    if (myVote === "like") likeBtn.style.background = "#cfc";
    if (myVote === "dislike") dislikeBtn.style.background = "#fcc";

    likeBtn.onclick = () => voteComment(comment, "like", gameId, container);
    dislikeBtn.onclick = () => voteComment(comment, "dislike", gameId, container);

    div.innerHTML = `<p>${comment.text}</p>`;
    div.appendChild(likeBtn);
    div.appendChild(dislikeBtn);
    container.appendChild(div);
  });
}

// Голосование
async function voteComment(comment, type, gameId, container) {
  const ref = doc(db, "soloComments", comment.id);
  const newVotes = { ...comment.votes };
  const prevVote = newVotes[currentUser.uid];

  if (prevVote === type) {
    delete newVotes[currentUser.uid];
    if (type === "like") comment.likesCount--;
    if (type === "dislike") comment.dislikesCount--;
  } else {
    newVotes[currentUser.uid] = type;
    if (type === "like") {
      comment.likesCount++;
      if (prevVote === "dislike") comment.dislikesCount--;
    }
    if (type === "dislike") {
      comment.dislikesCount++;
      if (prevVote === "like") comment.likesCount--;
    }
  }

  await updateDoc(ref, {
    likesCount: comment.likesCount,
    dislikesCount: comment.dislikesCount,
    votes: newVotes
  });
  loadComments(gameId, container);
}
