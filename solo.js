import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";

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
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;

// ==== Получение ника пользователя ====
async function getUserNickname(userId) {
  const userDoc = await getDoc(doc(db, "users", userId));
  if (userDoc.exists()) {
    return userDoc.data().nickname || userId;
  }
  return userId;
}

// ==== Рендер средней оценки ====
async function renderAverageRating(gameId) {
  const ratingsRef = collection(db, "soloRatings");
  const q = query(ratingsRef, where("gameId", "==", gameId));
  const snap = await getDocs(q);

  const avgEl = document.querySelector(`#avg-rating-${gameId}`);
  if (snap.empty) {
    avgEl.textContent = "Средняя оценка: —";
    return;
  }
  const avg = snap.docs.reduce((sum, d) => sum + d.data().rating, 0) / snap.docs.length;
  avgEl.textContent = `Средняя оценка: ${avg.toFixed(1)}`;
}

// ==== Сохранение рейтинга ====
async function saveRating(gameId, value) {
  const ratingsRef = collection(db, "soloRatings");
  const q = query(ratingsRef, where("gameId", "==", gameId), where("userId", "==", currentUser.uid));
  const snap = await getDocs(q);

  if (!snap.empty) {
    await updateDoc(doc(db, "soloRatings", snap.docs[0].id), { rating: Number(value) });
  } else {
    await addDoc(ratingsRef, {
      gameId,
      userId: currentUser.uid,
      rating: Number(value)
    });
  }
  renderAverageRating(gameId);
}

// ==== Рендер комментариев ====
async function renderComments(gameId) {
  const commentsRef = collection(db, "comments");
  const q = query(commentsRef, where("gameId", "==", gameId), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  const commentList = document.querySelector(`#comments-${gameId}`);
  commentList.innerHTML = "";

  for (const docSnap of snapshot.docs) {
    const comment = docSnap.data();
    const authorName = await getUserNickname(comment.userId);

    const commentEl = document.createElement("div");
    commentEl.classList.add("comment");

    const authorEl = document.createElement("div");
    authorEl.classList.add("comment-author");
    authorEl.textContent = authorName;

    const textEl = document.createElement("p");
    textEl.classList.add("comment-text");
    textEl.textContent = comment.text;

    const actionsEl = document.createElement("div");
    actionsEl.classList.add("comment-actions");

    if (currentUser && currentUser.uid === comment.userId) {
      const editBtn = document.createElement("button");
      editBtn.textContent = "✏️ Редактировать";
      editBtn.addEventListener("click", () => {
        const textarea = document.querySelector(`#comment-input-${gameId}`);
        textarea.value = comment.text;
        textarea.dataset.editId = docSnap.id;
      });
      actionsEl.appendChild(editBtn);
    }

    commentEl.appendChild(authorEl);
    commentEl.appendChild(textEl);
    commentEl.appendChild(actionsEl);
    commentList.appendChild(commentEl);
  }
}

// ==== Сохранение комментария ====
async function saveComment(gameId) {
  const textarea = document.querySelector(`#comment-input-${gameId}`);
  const text = textarea.value.trim();
  if (!text) return;

  if (textarea.dataset.editId) {
    await updateDoc(doc(db, "comments", textarea.dataset.editId), { text });
    delete textarea.dataset.editId;
  } else {
    await addDoc(collection(db, "comments"), {
      gameId,
      userId: currentUser.uid,
      text,
      createdAt: serverTimestamp()
    });
  }
  textarea.value = "";
  renderComments(gameId);
}

// ==== Рендер карточки игры ====
async function createGameCard(game) {
  const container = document.getElementById("games-container");

  const card = document.createElement("div");
  card.classList.add("game-card");

  const title = document.createElement("h3");
  title.textContent = game.title;
  card.appendChild(title);

  const avgRating = document.createElement("div");
  avgRating.id = `avg-rating-${game.id}`;
  avgRating.classList.add("avg-rating");
  card.appendChild(avgRating);
  renderAverageRating(game.id);

  // Комментарии
  const commentSection = document.createElement("div");
  commentSection.classList.add("comment-section");

  const commentList = document.createElement("div");
  commentList.id = `comments-${game.id}`;
  commentSection.appendChild(commentList);

  const textarea = document.createElement("textarea");
  textarea.id = `comment-input-${game.id}`;
  textarea.placeholder = "Напишите комментарий...";
  commentSection.appendChild(textarea);

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "💬 Отправить";
  saveBtn.addEventListener("click", () => saveComment(game.id));
  commentSection.appendChild(saveBtn);

  card.appendChild(commentSection);
  renderComments(game.id);

  // Рейтинг при "Пройдена"
  if (game.status === "Пройдена") {
    const ratingSelect = document.createElement("select");
    ratingSelect.classList.add("rating-select");
    for (let i = 1; i <= 10; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = i;
      ratingSelect.appendChild(opt);
    }
    ratingSelect.addEventListener("change", () => saveRating(game.id, ratingSelect.value));
    card.appendChild(ratingSelect);
  }

  container.appendChild(card);
}

// ==== Авторизация и запуск ====
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) return;

  const gamesSnap = await getDocs(collection(db, "games"));
  gamesSnap.forEach(docSnap => {
    const game = { id: docSnap.id, ...docSnap.data() };
    createGameCard(game);
  });
});
