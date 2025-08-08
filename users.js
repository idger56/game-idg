import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-storage.js";

const storage = getStorage(app);

const firebaseConfig = {
  // вставь свою конфигурацию
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const myProfileDiv = document.getElementById("my-profile");
const usersList = document.getElementById("users-list");

onAuthStateChanged(auth, async (user) => {
  
  const nicknameSpan = document.getElementById("user-nickname");

  if (!snapshot.empty) {
  const userData = snapshot.docs[0].data();
  nicknameSpan.textContent = `👤 ${userData.nickname}`;
  nicknameSpan.style.display = "inline-block";
}

  if (!user) {
    myProfileDiv.innerHTML = "<p>Войдите, чтобы увидеть свой профиль.</p>";
    return;
  }

  const userSnapshot = await getDocs(query(collection(db, "users"), where("uid", "==", user.uid)));
  const userData = userSnapshot.empty ? null : userSnapshot.docs[0].data();

  if (!userData) return;

  const allGames = await getDocs(collection(db, "games"));
  const totalGames = allGames.size;

  const userRatingsSnapshot = await getDocs(query(collection(db, "ratings"), where("userId", "==", user.uid)));
  const userRatings = userRatingsSnapshot.docs.map(d => d.data());
  const avgRating = userRatings.length ? (userRatings.reduce((a, b) => a + b.rating, 0) / userRatings.length).toFixed(1) : "—";
  const percentComplete = totalGames ? Math.round((userRatings.length / totalGames) * 100) : 0;

  myProfileDiv.innerHTML = `
    <div class="game-card">
      <img src="${userData.avatar || 'https://via.placeholder.com/300x300?text=Аватар'}" alt="Аватар">
      <div class="game-content">
        <h3>${userData.nickname}</h3>
        <p><strong>Средняя оценка:</strong> ${avgRating}</p>
        <p><strong>Пройдено:</strong> ${percentComplete}%</p>
        <p><strong>Любимый жанр:</strong> ${userData.favoriteGenre || 'Не выбран'}</p>
        <p><em>${userData.quote || 'Нет цитаты'}</em></p>
        <input type="file" id="avatar-upload" />
        <input type="text" id="quote-input" placeholder="Цитата" value="${userData.quote || ''}" />
        <input type="text" id="genre-input" placeholder="Любимый жанр" value="${userData.favoriteGenre || ''}" />
        <button id="save-profile">Сохранить профиль</button>
      </div>
    </div>
  `;

  document.getElementById("avatar-upload").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const avatarRef = ref(storage, `avatars/${auth.currentUser.uid}`);
  await uploadBytes(avatarRef, file);

  const url = await getDownloadURL(avatarRef);
  await updateDoc(doc(db, "users", userData.nickname.toLowerCase().replace(/\s+/g, "_")), {
    avatar: url
  });

  alert("Аватар обновлён!");
  location.reload();
});


  document.getElementById("save-profile").addEventListener("click", async () => {
    const quote = document.getElementById("quote-input").value.trim();
    const genre = document.getElementById("genre-input").value.trim();

    await updateDoc(doc(db, "users", userData.nickname.toLowerCase().replace(/\s+/g, "_")), {
      quote,
      favoriteGenre: genre
    });

    alert("Профиль обновлён!");
    location.reload();
  });

  // 👉 загрузка других пользователей
  loadOtherUsers(user.uid, totalGames);
});

async function loadOtherUsers(currentUserId, totalGames) {
  const usersSnapshot = await getDocs(collection(db, "users"));
  const ratingsSnapshot = await getDocs(collection(db, "ratings"));

  const ratingMap = {};
  for (const doc of ratingsSnapshot.docs) {
    const r = doc.data();
    if (!ratingMap[r.userId]) ratingMap[r.userId] = [];
    ratingMap[r.userId].push(r.rating);
  }

  for (const docSnap of usersSnapshot.docs) {
    const user = docSnap.data();
    if (user.uid === currentUserId) continue;

    const ratings = ratingMap[user.uid] || [];
    const percentComplete = totalGames ? Math.round((ratings.length / totalGames) * 100) : 0;

    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <img src="${user.avatar || 'https://via.placeholder.com/300x300?text=Аватар'}" alt="Аватар">
      <div class="game-content">
        <h3>${user.nickname}</h3>
        <p><strong>Пройдено:</strong> ${percentComplete}%</p>
        <p><em>${user.quote || 'Нет цитаты'}</em></p>
      </div>
    `;

    usersList.appendChild(card);
  }
}
