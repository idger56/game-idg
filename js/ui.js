// ============================================================
//  ui.js — общие UI-компоненты: шапка, тема, тост
// ============================================================
import { auth, ADMIN_EMAIL } from "./auth.js";
import { logout } from "./auth.js";
import { initTheme, setTheme } from "./utils.js";
import { THEMES } from "./constants.js";

// ---------- Тема ----------
const THEME_META = {
  dark:      { label: "🌑 Тёмная",    dot: "#4f8ef7" },
  light:     { label: "☀️ Светлая",   dot: "#3b72e8" },
  cyberpunk: { label: "⚡ Киберпанк", dot: "#00f5ff" },
  retro:     { label: "🎮 Ретро",     dot: "#ff6ac1" },
  forest:    { label: "🌿 Лес",       dot: "#5bbf7a" },
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
    </div>
  `;

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
    { href: "index.html",   label: "🎮 Игры",         id: "index" },
    { href: "solo.html",    label: "🕹 Соло",          id: "solo" },
    { href: "top.html",     label: "🏆 Топ",           id: "top" },
    { href: "users.html",   label: "👥 Пользователи",  id: "users" },
  ];

  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <nav class="nav-inner">
      <a class="nav-logo" href="index.html">
        <span class="logo-icon">🎮</span>
        <span>GameIDG</span>
      </a>
      <div class="nav-links" id="nav-links">
        ${pages.map(p => `
          <a href="${p.href}" class="nav-link ${p.id === activePage ? "active" : ""}">${p.label}</a>
        `).join("")}
      </div>
      <div class="nav-right">
        <div id="theme-menu-slot"></div>
        <span id="nav-user-info" class="nav-user hidden"></span>
        <button id="nav-auth-btn" class="btn btn-ghost btn-sm">Вход</button>
      </div>
    </nav>
  `;

  document.body.prepend(header);

  // Вставляем меню тем
  document.getElementById("theme-menu-slot").appendChild(buildThemeMenu());

  // Авторизация
  const authBtn = document.getElementById("nav-auth-btn");
  const userInfo = document.getElementById("nav-user-info");

  auth.onAuthStateChanged ? null : null; // handled by page

  authBtn.addEventListener("click", async () => {
    if (auth.currentUser) {
      await logout(auth.currentUser.uid);
      window.location.href = "index.html";
    } else {
      // Показываем форму входа — страница сама обрабатывает
      document.getElementById("auth-section")?.classList.remove("hidden");
    }
  });

  // Подписка на изменение авторизации для кнопки
  import("https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js").then(({ onAuthStateChanged }) => {
    onAuthStateChanged(auth, async user => {
      if (user) {
        authBtn.textContent = "Выход";
        authBtn.classList.remove("btn-ghost");
        authBtn.classList.add("btn-danger", "btn-sm");

        // Получаем ник
        import("https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js").then(async ({ getDoc, doc }) => {
          const { db } = await import("./firebase.js");
          const snap = await getDoc(doc(db, "users", user.uid));
          const nick = snap.exists() ? snap.data().nickname : user.email;
          userInfo.innerHTML = `<span class="nav-user-dot"></span>${nick}`;
          userInfo.classList.remove("hidden");

          // Ссылка на профиль
          userInfo.style.cursor = "pointer";
          userInfo.addEventListener("click", () => {
            window.location.href = `profile.html?uid=${user.uid}`;
          });
        });
      } else {
        authBtn.textContent = "Вход";
        authBtn.classList.add("btn-ghost");
        authBtn.classList.remove("btn-danger");
        userInfo.classList.add("hidden");
      }
    });
  });

  return header;
}

// ---------- Toast уведомления ----------
let toastContainer = null;

export function toast(message, type = "info") {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }

  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = message;
  toastContainer.appendChild(el);

  setTimeout(() => el.remove(), 3200);
}

// ---------- Spinner ----------
export function showSpinner(container) {
  container.innerHTML = `<div class="spinner"></div>`;
}

export function showEmpty(container, text = "Ничего не найдено") {
  container.innerHTML = `
    <div class="empty-state">
      <div class="icon">🎮</div>
      <p>${text}</p>
    </div>`;
}
