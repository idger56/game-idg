// ============================================================
//  utils.js — утилиты, переиспользуемые во всех страницах
// ============================================================
import { MEDAL_THRESHOLDS, MEDAL_NAMES, MEDAL_DESCS, GENRES, THEMES } from "./constants.js";

// ---------- Медали ----------
export function getMedalLevel(value, key) {
  const t = MEDAL_THRESHOLDS[key];
  if (!t) return "none";
  if (value >= t.gold)   return "gold";
  if (value >= t.silver) return "silver";
  if (value >= t.bronze) return "bronze";
  return "none";
}

export function getMedalIconPath(key, level) {
  if (level === "none") return `assets/medals/${key}/locked.png`;
  return `assets/medals/${key}/${level}.png`;
}

export function getMedalLabel(level) {
  return { gold:"Золото", silver:"Серебро", bronze:"Бронза", none:"Нет" }[level] ?? "Нет";
}

/** Считает статистику для медалей по массивам ratings и games */
export function calcUserStats(ratings, gamesArr, totalGames, favoriteGenre) {
  const percentComplete = totalGames ? Math.round((ratings.length / totalGames) * 100) : 0;
  const avgRating = ratings.length
    ? (ratings.reduce((a, b) => a + b.rating, 0) / ratings.length).toFixed(1)
    : null;

  const genresSet  = new Set();
  const genreCount = {};
  ratings.forEach(r => {
    const g = gamesArr.find(x => x.id === r.gameId);
    if (!g?.category) return;
    const cats = Array.isArray(g.category) ? g.category : [g.category];
    cats.forEach(c => {
      genresSet.add(c);
      genreCount[c] = (genreCount[c] || 0) + 1;
    });
  });

  const favGenrePercent = (favoriteGenre && ratings.length)
    ? Math.round(((genreCount[favoriteGenre] || 0) / ratings.length) * 100)
    : 0;

  return {
    percentComplete,
    avgRating,
    ratingsCount: ratings.length,
    genresCount: genresSet.size,
    favGenrePercent,
  };
}

// ---------- Время онлайн ----------
export function ruPlural(n, forms) {
  n = Math.abs(n) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1)          return forms[0];
  return forms[2];
}

export function formatLastSeen(lastMillis) {
  if (!lastMillis) return "Никогда";
  const diff = Date.now() - lastMillis;
  if (diff < 0) return "Онлайн";
  if (diff < 90_000) return "Онлайн";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60)  return `${mins} ${ruPlural(mins,["минута","минуты","минут"])} назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs} ${ruPlural(hrs,["час","часа","часов"])} назад`;
  const days = Math.floor(hrs / 24);
  return `${days} ${ruPlural(days,["день","дня","дней"])} назад`;
}

export function isOnline(lastMillis) {
  return lastMillis && (Date.now() - lastMillis) < 90_000;
}

// ---------- HTML-экранирование ----------
export function esc(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, s =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[s]
  );
}

// ---------- Slug ----------
export function toSlug(str) {
  return str.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^\w_]/g, "");
}

// ---------- Жанры: рендер <option> ----------
export function genreOptions(selected = []) {
  return GENRES.map(g =>
    `<option value="${g}" ${selected.includes(g) ? "selected" : ""}>${g}</option>`
  ).join("");
}

// ---------- Статусы: рендер <option> ----------
export function statusOptions(current, list = ["Пройдена","В процессе","В планах"]) {
  return list.map(s =>
    `<option value="${s}" ${s === current ? "selected" : ""}>${s}</option>`
  ).join("");
}

// ---------- Смена темы ----------
export function initTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  return saved;
}

export function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}
