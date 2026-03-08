// ============================================================
//  items.js — константы системы кейсов, предметов, экономики
// ============================================================

export const CURRENCY = {
  name:   "PixelShard",
  short:  "PS",
  icon:   "💎",
  start:  100,
};

export const RARITIES = {
  common:    { label: "Обычный",     color: "#8892a4", glow: "rgba(136,146,164,.3)", weight: 60 },
  rare:      { label: "Редкий",      color: "#4f8ef7", glow: "rgba(79,142,247,.4)",  weight: 25 },
  epic:      { label: "Эпический",   color: "#a855f7", glow: "rgba(168,85,247,.5)",  weight: 10 },
  legendary: { label: "Легендарный", color: "#f5c542", glow: "rgba(245,197,66,.5)",  weight:  4 },
  exclusive: { label: "Эксклюзив",   color: "#ff2d78", glow: "rgba(255,45,120,.6)",  weight:  1 },
};

export const RARITY_SELL_PRICE = {
  common:    5,
  rare:      20,
  epic:      75,
  legendary: 250,
  exclusive: 1000,
};

export const ITEM_TYPES = {
  avatar_frame: { label: "Рамка аватара", icon: "🖼" },
  profile_bg:   { label: "Фон профиля",   icon: "🌌" },
  card_skin:    { label: "Скин карточки", icon: "🃏" },
};

export const EARN_REWARDS = {
  daily:        25,
  rating:        5,
  comment:       3,
  medal_bronze: 10,
  medal_silver: 25,
  medal_gold:   50,
};

export const CONTRACT_COUNT = 5;
export const RARITY_ORDER = ["common","rare","epic","legendary","exclusive"];

export function nextRarity(rarity) {
  const i = RARITY_ORDER.indexOf(rarity);
  return i < RARITY_ORDER.length - 1 ? RARITY_ORDER[i + 1] : null;
}

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

// ════════════════════════════════════════════════════════════
//  КАТАЛОГ ПРЕДМЕТОВ ПО УМОЛЧАНИЮ (25 штук)
// ════════════════════════════════════════════════════════════
export const DEFAULT_ITEMS = [
  // РАМКИ АВАТАРА
  { id:"frame_steel",    name:"Стальная рамка",      type:"avatar_frame", rarity:"common",    cssEffect:"border:3px solid #8892a4;border-radius:50%;",                                                                                    previewColor:"#8892a4" },
  { id:"frame_bronze",   name:"Бронзовая рамка",     type:"avatar_frame", rarity:"common",    cssEffect:"border:3px solid #cd7f32;border-radius:50%;",                                                                                    previewColor:"#cd7f32" },
  { id:"frame_ocean",    name:"Океанская рамка",     type:"avatar_frame", rarity:"rare",      cssEffect:"border:3px solid #4f8ef7;border-radius:50%;box-shadow:0 0 12px #4f8ef7;",                                                        previewColor:"#4f8ef7" },
  { id:"frame_violet",   name:"Фиолетовая рамка",    type:"avatar_frame", rarity:"rare",      cssEffect:"border:3px solid #a855f7;border-radius:50%;box-shadow:0 0 14px #a855f7;",                                                        previewColor:"#a855f7" },
  { id:"frame_plasma",   name:"Плазменная рамка",    type:"avatar_frame", rarity:"epic",      cssEffect:"border:3px solid #a855f7;border-radius:50%;box-shadow:0 0 20px #a855f7,0 0 40px rgba(168,85,247,.4);animation:frameGlow 2s ease-in-out infinite alternate;", previewColor:"#a855f7", isAnimated:true },
  { id:"frame_fire",     name:"Огненная рамка",      type:"avatar_frame", rarity:"epic",      cssEffect:"border:3px solid #ff6b35;border-radius:50%;box-shadow:0 0 15px #ff6b35,0 0 30px rgba(255,107,53,.5);animation:framePulse 1.5s ease-in-out infinite;", previewColor:"#ff6b35", isAnimated:true },
  { id:"frame_gold",     name:"Золотая рамка",       type:"avatar_frame", rarity:"legendary", cssEffect:"border:3px solid #f5c542;border-radius:50%;box-shadow:0 0 20px #f5c542,0 0 40px rgba(245,197,66,.6);animation:frameRotate 3s linear infinite;", previewColor:"#f5c542", isAnimated:true },
  { id:"frame_rainbow",  name:"Радужная рамка",      type:"avatar_frame", rarity:"exclusive", cssEffect:"border:4px solid transparent;border-radius:50%;background:linear-gradient(var(--bg-card),var(--bg-card)) padding-box,linear-gradient(var(--rainbow-angle,0deg),#ff2d78,#f5c542,#4bff91,#4f8ef7,#a855f7,#ff2d78) border-box;animation:rainbowSpin 2s linear infinite;box-shadow:0 0 30px rgba(255,45,120,.5);", previewColor:"linear-gradient(135deg,#ff2d78,#f5c542,#4f8ef7)", isAnimated:true },

  // ФОНЫ ПРОФИЛЯ
  { id:"bg_night",    name:"Ночное небо",        type:"profile_bg", rarity:"common",    cssEffect:"background:linear-gradient(135deg,#0f0c29,#302b63);",                                                                    previewColor:"#302b63" },
  { id:"bg_forest",   name:"Лесной фон",          type:"profile_bg", rarity:"common",    cssEffect:"background:linear-gradient(135deg,#134e5e,#71b280);",                                                                    previewColor:"#134e5e" },
  { id:"bg_ocean",    name:"Океанский закат",     type:"profile_bg", rarity:"rare",      cssEffect:"background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460,#533483);",                                                    previewColor:"#0f3460" },
  { id:"bg_fire",     name:"Огненный фон",        type:"profile_bg", rarity:"rare",      cssEffect:"background:linear-gradient(135deg,#200122,#6f0000);",                                                                    previewColor:"#6f0000" },
  { id:"bg_cyber",    name:"Кибер-сеть",          type:"profile_bg", rarity:"epic",      cssEffect:"background:linear-gradient(135deg,#0d0221,#1a0533,#0a1628);animation:cyberPulse 4s ease infinite;",                     previewColor:"#1a0533", isAnimated:true },
  { id:"bg_aurora",   name:"Северное сияние",     type:"profile_bg", rarity:"epic",      cssEffect:"background:linear-gradient(-45deg,#0d1117,#1a3a2e,#0d2438,#1a1a3e);background-size:400% 400%;animation:auroraShift 6s ease infinite;", previewColor:"#1a3a2e", isAnimated:true },
  { id:"bg_galaxy",   name:"Галактика",           type:"profile_bg", rarity:"legendary", cssEffect:"background:radial-gradient(ellipse at top,#1b2735 0%,#090a0f 100%);animation:starsTwinkle 4s ease-in-out infinite;",    previewColor:"#1b2735", isAnimated:true },
  { id:"bg_vortex",   name:"Нексус",              type:"profile_bg", rarity:"exclusive", cssEffect:"background:conic-gradient(from var(--vortex-angle,0deg) at 50% 50%,#ff2d78,#a855f7,#4f8ef7,#4bff91,#f5c542,#ff2d78);animation:vortexSpin 4s linear infinite;", previewColor:"linear-gradient(135deg,#ff2d78,#a855f7,#4f8ef7)", isAnimated:true },

  // СКИНЫ КАРТОЧЕК
  { id:"card_steel",    name:"Стальная карточка",       type:"card_skin", rarity:"common",    cssEffect:"border:2px solid #8892a4;",                                                                                          previewColor:"#8892a4" },
  { id:"card_emerald",  name:"Изумрудная карточка",     type:"card_skin", rarity:"common",    cssEffect:"border:2px solid #4bff91;",                                                                                          previewColor:"#4bff91" },
  { id:"card_sapphire", name:"Сапфировая карточка",     type:"card_skin", rarity:"rare",      cssEffect:"border:2px solid #4f8ef7;box-shadow:0 0 12px rgba(79,142,247,.4);",                                                  previewColor:"#4f8ef7" },
  { id:"card_amethyst", name:"Аметистовая карточка",    type:"card_skin", rarity:"rare",      cssEffect:"border:2px solid #a855f7;box-shadow:0 0 14px rgba(168,85,247,.4);",                                                  previewColor:"#a855f7" },
  { id:"card_prism",    name:"Призматическая карточка", type:"card_skin", rarity:"epic",      cssEffect:"border:2px solid #a855f7;box-shadow:0 0 20px #a855f7;animation:cardPrism 3s ease-in-out infinite;",                  previewColor:"#a855f7", isAnimated:true },
  { id:"card_inferno",  name:"Инферно карточка",        type:"card_skin", rarity:"epic",      cssEffect:"border:2px solid #ff6b35;box-shadow:0 0 20px #ff6b35,0 0 40px rgba(255,107,53,.3);animation:cardInferno 2s ease-in-out infinite alternate;", previewColor:"#ff6b35", isAnimated:true },
  { id:"card_divine",   name:"Божественная карточка",   type:"card_skin", rarity:"legendary", cssEffect:"border:2px solid #f5c542;box-shadow:0 0 25px #f5c542,0 0 50px rgba(245,197,66,.4);animation:cardDivine 2s ease-in-out infinite alternate;", previewColor:"#f5c542", isAnimated:true },
  { id:"card_nexus",    name:"Нексус карточка",         type:"card_skin", rarity:"exclusive", cssEffect:"border:2px solid transparent;animation:nexusCard 2s linear infinite;box-shadow:0 0 30px rgba(255,45,120,.6);",       previewColor:"linear-gradient(135deg,#ff2d78,#4f8ef7)", isAnimated:true },

  // БОНУС — 25-й предмет
  { id:"frame_cyber",   name:"Киберпанк рамка",   type:"avatar_frame", rarity:"legendary", cssEffect:"border:3px solid #4bff91;border-radius:50%;box-shadow:0 0 20px #4bff91,0 0 40px rgba(75,255,145,.4);animation:cyberFrame 2s ease-in-out infinite alternate;", previewColor:"#4bff91", isAnimated:true },
];

// CSS анимации для всех скинов — вставить в <style> на каждой странице
export const SKIN_CSS = `
@property --rainbow-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@property --vortex-angle   { syntax: '<angle>'; initial-value: 0deg; inherits: false; }

@keyframes frameGlow {
  from { box-shadow: 0 0 15px #a855f7, 0 0 30px rgba(168,85,247,.3); }
  to   { box-shadow: 0 0 30px #a855f7, 0 0 60px rgba(168,85,247,.6); }
}
@keyframes framePulse {
  0%,100% { box-shadow: 0 0 10px #ff6b35, 0 0 20px rgba(255,107,53,.4); }
  50%      { box-shadow: 0 0 25px #ff6b35, 0 0 50px rgba(255,107,53,.7); }
}
@keyframes frameRotate {
  from { filter: hue-rotate(0deg) brightness(1); }
  to   { filter: hue-rotate(30deg) brightness(1.3); }
}
@keyframes rainbowSpin  { to { --rainbow-angle: 360deg; } }
@keyframes vortexSpin   { to { --vortex-angle: 360deg; } }
@keyframes auroraShift {
  0%,100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}
@keyframes starsTwinkle {
  0%,100% { filter: brightness(1); }
  50%      { filter: brightness(1.4); }
}
@keyframes cyberPulse {
  0%,100% { filter: brightness(1); }
  50%      { filter: brightness(1.2) hue-rotate(10deg); }
}
@keyframes cardPrism {
  0%,100% { border-color:#a855f7; box-shadow:0 0 20px #a855f7; }
  33%      { border-color:#4f8ef7; box-shadow:0 0 20px #4f8ef7; }
  66%      { border-color:#ff2d78; box-shadow:0 0 20px #ff2d78; }
}
@keyframes cardInferno {
  from { box-shadow: 0 0 15px #ff6b35, 0 0 30px rgba(255,107,53,.3); }
  to   { box-shadow: 0 0 30px #ff4500, 0 0 60px rgba(255,69,0,.5); }
}
@keyframes cardDivine {
  from { box-shadow: 0 0 20px #f5c542, 0 0 40px rgba(245,197,66,.3); }
  to   { box-shadow: 0 0 40px #f5c542, 0 0 80px rgba(245,197,66,.6); }
}
@keyframes nexusCard {
  0%  { border-color:#ff2d78; box-shadow:0 0 30px #ff2d78; }
  25% { border-color:#f5c542; box-shadow:0 0 30px #f5c542; }
  50% { border-color:#4f8ef7; box-shadow:0 0 30px #4f8ef7; }
  75% { border-color:#a855f7; box-shadow:0 0 30px #a855f7; }
  100%{ border-color:#ff2d78; box-shadow:0 0 30px #ff2d78; }
}
@keyframes cyberFrame {
  from { box-shadow: 0 0 15px #4bff91, 0 0 30px rgba(75,255,145,.3); }
  to   { box-shadow: 0 0 30px #4bff91, 0 0 60px rgba(75,255,145,.6); }
}
`;

export function getItemCss(item) {
  return item?.cssEffect || "";
}

export function getItemPreviewStyle(item) {
  if (!item) return "";
  const color = item.previewColor || RARITIES[item.rarity]?.color || "#888";
  if (color.startsWith("linear") || color.startsWith("radial") || color.startsWith("conic")) {
    return `background:${color};`;
  }
  return `background:${color}22;border-color:${color};`;
}
