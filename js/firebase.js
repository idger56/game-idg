// ============================================================
//  firebase.js — единственное место с конфигом и экспортами
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBNuHz-OPbVWHoc7gtuxHU21-CC5TbYKbw",
  authDomain:        "game-idg.firebaseapp.com",
  projectId:         "game-idg",
  storageBucket:     "game-idg.firebasestorage.app",
  messagingSenderId: "987199066254",
  appId:             "1:987199066254:web:ed82cea15f4a7b7a4279df",
  measurementId:     "G-QLLFXDHX51"
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

export const ADMIN_EMAIL = "boreko.ivan@gmail.com";
