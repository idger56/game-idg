// ============================================================
//  items.js — константы системы кейсов, предметов, экономики
// ============================================================

export const CURRENCY = {
  name:   "PixelShard",
  short:  "PS",
  icon:   "💎",
  start:  100,         // стартовый баланс
};

// Редкости предметов
export const RARITIES = {
  common:    { label: "Обычный",      color: "#8892a4", glow: "rgba(136,146,164,.3)", weight: 60 },
  rare:      { label: "Редкий",       color: "#4f8ef7", glow: "rgba(79,142,247,.4)",  weight: 25 },
  epic:      { label: "Эпический",    color: "#a855f7", glow: "rgba(168,85,247,.5)",  weight: 10 },
  legendary: { label: "Легендарный",  color: "#f5c542", glow: "rgba(245,197,66,.5)",  weight:  4 },
  exclusive: { label: "Эксклюзив",    color: "#ff2d78", glow: "rgba(255,45,120,.6)",  weight:  1 },
};

// Базовая цена продажи по редкости
export const RARITY_SELL_PRICE = {
  common:    5,
  rare:      20,
  epic:      75,
  legendary: 250,
  exclusive: 1000,
};

// Типы предметов
export const ITEM_TYPES = {
  frame:      { label: "Рамка профиля",  icon: "🖼" },
  background: { label: "Фон профиля",    icon: "🌌" },
  icon:       { label: "Иконка",         icon: "⭐" },
};

// Награды за действия
export const EARN_REWARDS = {
  daily:      25,  // ежедневный бонус
  rating:      5,  // за оценку игры
  comment:     3,  // за комментарий
  medal_bronze: 10,
  medal_silver: 25,
  medal_gold:   50,
};

// Контракт: 5 предметов → 1 более высокой редкости
export const CONTRACT_COUNT = 5;

// Порядок редкостей (для апгрейда)
export const RARITY_ORDER = ["common","rare","epic","legendary","exclusive"];

/** Получить следующую редкость */
export function nextRarity(rarity) {
  const i = RARITY_ORDER.indexOf(rarity);
  return i < RARITY_ORDER.length - 1 ? RARITY_ORDER[i + 1] : null;
}

/** Взвешенный случайный выбор редкости */
export function rollRarity(weights = null) {
  const pool = weights || Object.fromEntries(
    Object.entries(RARITIES).map(([k, v]) => [k, v.weight])
  );
  const total = Object.values(pool).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [key, w] of Object.entries(pool)) {
    r -= w;
    if (r <= 0) return key;
  }
  return "common";
}
