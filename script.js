
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

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

const authSection = document.getElementById("auth-section");
const mainSection = document.getElementById("main-section");
const authMessage = document.getElementById("auth-message");
const form = document.getElementById("add-game-form");

onAuthStateChanged(auth, user => {
  if (user) {
    authSection.style.display = "none";
    mainSection.style.display = "block";
    const isAdmin = user.email === "boreko.ivan@gmail.com";
    if (!isAdmin) {
      form.style.display = "none";
    }
    loadGames();
  } else {
    authSection.style.display = "block";
    mainSection.style.display = "none";
  }
});

window.register = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    authMessage.textContent = error.message;
  }
}

window.login = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    authMessage.textContent = error.message;
  }
}

window.logout = function () {
  signOut(auth);
}

async function loadGames() {
  const gamesList = document.getElementById("games-list");
  gamesList.innerHTML = "";
  const querySnapshot = await getDocs(collection(db, "games"));
  querySnapshot.forEach(doc => {
    const game = doc.data();
    gamesList.innerHTML += `
      <div class="game-card">
        <h3>${game.title}</h3>
        <p>Категория: ${game.category}</p>
        <p>Статус: ${game.status}</p>
        <a href="${game.link}" target="_blank">Скачать</a>
        <img src="${game.image}" alt="preview">
      </div>`;
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (user.email !== "boreko.ivan@gmail.com") return;

  const title = document.getElementById("title").value;
  const category = document.getElementById("category").value;
  const link = document.getElementById("link").value;
  const image = document.getElementById("image").value;
  const status = document.getElementById("status").value;

  await addDoc(collection(db, "games"), { title, category, link, image, status });
  e.target.reset();
  loadGames();
});
