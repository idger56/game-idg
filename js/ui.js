// ============================================================
//  ui.js — шапка, тема, тост (без циклических зависимостей)
// ============================================================
import { auth, db }   from "./firebase.js";
import { initTheme, setTheme } from "./utils.js";
import { THEMES }     from "./constants.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";
import {
  getDoc, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

// ---------- Темы ----------
const THEME_META = {
  dark:      { label: "🌑 Тёмная",     dot: "#4f8ef7" },
  light:     { label: "☀️ Светлая",    dot: "#3b72e8" },
  cyberpunk: { label: "⚡ Киберпанк",  dot: "#00f5ff" },
  retro:     { label: "🕹 Ретро",      dot: "#ff6ac1" },
  forest:    { label: "🌿 Лес",        dot: "#4ec96e" },
  ocean:     { label: "🌊 Океан",      dot: "#00c6ff" },
  blood:     { label: "🩸 Кровь",      dot: "#e83030" },
  synthwave: { label: "🌆 Синтвейв",   dot: "#f72585" },
  matrix:    { label: "💚 Матрица",    dot: "#00ff41" },
  golden:    { label: "🏆 Золото",     dot: "#f0b429" },
};

export function buildThemeMenu() {
  let current = initTheme();

  const wrap = document.createElement("div");
  wrap.style.position = "relative";
  wrap.innerHTML = `
    <button class="theme-btn" id="theme-toggle-btn" title="Сменить тему">
      🎨 <span id="theme-label">${THEME_META[current]?.label ?? current}</span>
    </button>
    <div class="theme-dropdown" id="theme-dropdown">
      ${THEMES.map(t => `
        <div class="theme-option ${t === current ? "current" : ""}" data-theme="${t}">
          <span class="dot" style="background:${THEME_META[t].dot}"></span>
          ${THEME_META[t].label}
        </div>
      `).join("")}
    </div>`;

  const btn      = wrap.querySelector("#theme-toggle-btn");
  const dropdown = wrap.querySelector("#theme-dropdown");
  const label    = wrap.querySelector("#theme-label");

  btn.addEventListener("click", e => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });
  document.addEventListener("click", () => dropdown.classList.remove("open"));

  wrap.querySelectorAll(".theme-option").forEach(opt => {
    opt.addEventListener("click", () => {
      const t = opt.dataset.theme;
      setTheme(t);
      current = t;
      label.textContent = THEME_META[t].label;
      wrap.querySelectorAll(".theme-option").forEach(o =>
        o.classList.toggle("current", o.dataset.theme === t)
      );
      dropdown.classList.remove("open");
    });
  });

  return wrap;
}

// ---------- Рендер шапки ----------
export function renderHeader({ activePage = "" } = {}) {
  initTheme();

  const pages = [
    { href: "index.html",    label: "🎮 Игры",        id: "index"    },
    { href: "solo.html",     label: "🕹 Соло",         id: "solo"     },
    { href: "top.html",      label: "🏆 Топ",          id: "top"      },
    { href: "users.html",    label: "👥 Пользователи", id: "users"    },
    { href: "news.html",     label: "📰 Новости",      id: "news"     },
    { href: "feedback.html", label: "💬 Обратная связь", id: "feedback" },
  ];

  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <nav class="nav-inner">
      <a class="nav-logo" href="index.html">
        <span class="logo-icon">🎮</span>
        <span>GameIDG</span>
      </a>
      <div class="nav-links" id="nav-links-desktop">
        ${pages.map(p => `
          <a href="${p.href}" class="nav-link ${p.id === activePage ? "active" : ""}">${p.label}</a>
        `).join("")}
      </div>
      <div class="nav-right">
        <div id="theme-menu-slot"></div>
        <span id="nav-user-info" class="nav-user hidden"></span>
        <button id="nav-auth-btn" class="btn btn-ghost btn-sm">Вход</button>
        <button class="burger-btn" id="burger-btn" aria-label="Меню">
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>
    <!-- Мобильное меню -->
    <div class="mobile-menu" id="mobile-menu">
      ${pages.map(p => `
        <a href="${p.href}" class="mobile-nav-link ${p.id === activePage ? "active" : ""}">${p.label}</a>
      `).join("")}
    </div>`;

  document.body.prepend(header);
  document.getElementById("theme-menu-slot").appendChild(buildThemeMenu());

  const authBtn  = document.getElementById("nav-auth-btn");
  const userInfo = document.getElementById("nav-user-info");
  let   nickClickBound = false;

  // Кнопка Вход/Выход
  authBtn.addEventListener("click", async () => {
    if (auth.currentUser) {
      try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          status: "offline", lastSeen: Date.now()
        });
      } catch (_) {}
      await signOut(auth);
      window.location.href = "index.html";
    } else {
      document.getElementById("auth-section")?.classList.remove("hidden");
    }
  });

  // Слежение за состоянием авторизации в шапке
  onAuthStateChanged(auth, async user => {
    if (user) {
      authBtn.textContent = "Выход";
      authBtn.className   = "btn btn-danger btn-sm";

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const nick = snap.exists() ? snap.data().nickname : user.email;
        userInfo.innerHTML = `<span class="nav-user-dot"></span>${nick}`;
        userInfo.classList.remove("hidden");
        if (!nickClickBound) {
          nickClickBound = true;
          userInfo.style.cursor = "pointer";
          userInfo.addEventListener("click", () => {
            window.location.href = `profile.html?uid=${user.uid}`;
          });
        }
      } catch (_) {}
    } else {
      authBtn.textContent = "Вход";
      authBtn.className   = "btn btn-ghost btn-sm";
      userInfo.classList.add("hidden");
    }
  });

  // Бургер-меню
  const burger = header.querySelector("#burger-btn");
  const mobileMenu = header.querySelector("#mobile-menu");
  burger?.addEventListener("click", () => {
    burger.classList.toggle("open");
    mobileMenu.classList.toggle("open");
    document.body.classList.toggle("menu-open");
  });
  // Закрываем при клике на ссылку
  mobileMenu?.querySelectorAll(".mobile-nav-link").forEach(link => {
    link.addEventListener("click", () => {
      burger.classList.remove("open");
      mobileMenu.classList.remove("open");
      document.body.classList.remove("menu-open");
    });
  });
  // Закрываем при клике вне меню
  document.addEventListener("click", e => {
    if (!header.contains(e.target)) {
      burger?.classList.remove("open");
      mobileMenu?.classList.remove("open");
      document.body.classList.remove("menu-open");
    }
  });

  return header;
}

// ---------- Toast ----------
let toastContainer = null;

export function toast(message, type = "info") {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }
  const el = document.createElement("div");
  el.className   = `toast toast-${type}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ---------- Spinner / Empty ----------
export function showSpinner(container) {
  if (container) container.innerHTML = `<div class="spinner"></div>`;
}

export function showEmpty(container, text = "Ничего не найдено") {
  if (container) container.innerHTML = `
    <div class="empty-state">
      <div class="icon">🎮</div>
      <p>${text}</p>
    </div>`;
}
