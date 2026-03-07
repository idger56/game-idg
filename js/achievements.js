// ============================================================
//  achievements.js — рендер достижений (медалей)
// ============================================================
import { getMedalLevel, getMedalIconPath, getMedalLabel } from "./utils.js";
import { MEDAL_THRESHOLDS, MEDAL_NAMES, MEDAL_DESCS } from "./constants.js";

const KEYS = ["master","critic","genres","favgenre"];
const UNITS = { master:"%", critic:"", genres:"", favgenre:"%" };

/** Рендер подробного списка достижений */
export function renderAchievements(container, stats) {
  const items = KEYS.map(key => {
    const t = MEDAL_THRESHOLDS[key];
    const val   = stats[key] ?? 0;
    const level = getMedalLevel(val, key);
    const icon  = getMedalIconPath(key, level);
    const label = getMedalLabel(level);

    const nextTarget = level === "gold" ? null
      : level === "silver" ? t.gold
      : level === "bronze" ? t.silver : t.bronze;

    const pct  = nextTarget ? Math.min(100, Math.round((val / nextTarget) * 100)) : 100;
    const prog = nextTarget
      ? `${val}${UNITS[key]} из ${nextTarget}${UNITS[key]}`
      : `${val}${UNITS[key]} (максимум)`;

    const colorMap = { gold:"#f5c542", silver:"#b0b8c8", bronze:"#cd7f32", none:"#505870" };
    const barColor = colorMap[level] ?? "var(--accent)";

    return `
      <div class="achievement-item">
        <img class="achievement-icon" src="${icon}" alt="${MEDAL_NAMES[key]}"
             onerror="this.src='assets/medals/${key}/locked.png'">
        <div class="achievement-info">
          <h4>${MEDAL_NAMES[key]}
            <span style="color:${barColor}; font-size:0.78rem; margin-left:6px;">${label}</span>
          </h4>
          <p class="desc">${MEDAL_DESCS[key]}</p>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${pct}%; background:${barColor}"></div>
          </div>
          <span class="progress-text">${prog}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = `<div class="achievement-list">${items.join("")}</div>`;
}

/** Рендер маленьких иконок-бейджей */
export function renderBadges(container, stats) {
  const html = KEYS.map(key => {
    const val   = stats[key] ?? 0;
    const level = getMedalLevel(val, key);
    const icon  = getMedalIconPath(key, level);
    const label = getMedalLabel(level);
    return `<img class="badge-icon" src="${icon}" alt="${MEDAL_NAMES[key]}"
                 title="${MEDAL_NAMES[key]} — ${label}"
                 onerror="this.src='assets/medals/${key}/locked.png'">`;
  }).join("");

  container.innerHTML = `<div class="badge-row">${html}</div>`;
}

/** Компактные иконки (для карточек пользователей) */
export function medalIcons(stats, limit = 4) {
  return KEYS
    .map(key => {
      const level = getMedalLevel(stats[key] ?? 0, key);
      if (level === "none") return null;
      return { key, level };
    })
    .filter(Boolean)
    .sort((a,b) => {
      const order = {gold:0,silver:1,bronze:2};
      return (order[a.level]??3) - (order[b.level]??3);
    })
    .slice(0, limit)
    .map(({ key, level }) => {
      const icon  = getMedalIconPath(key, level);
      const label = getMedalLabel(level);
      return `<img src="${icon}" alt="${MEDAL_NAMES[key]}"
                   title="${MEDAL_NAMES[key]} — ${label}"
                   style="width:28px;height:28px;border-radius:4px;"
                   onerror="this.src='assets/medals/${key}/locked.png'">`;
    })
    .join("");
}

/** Считает нужные ключи для stats из объекта { percentComplete, ratingsCount, genresCount, favGenrePercent } */
export function statsToAchievementInput(s) {
  return {
    master:   s.percentComplete ?? 0,
    critic:   s.ratingsCount    ?? 0,
    genres:   s.genresCount     ?? 0,
    favgenre: s.favGenrePercent ?? 0,
  };
}
