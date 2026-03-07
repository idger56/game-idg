// ============================================================
//  news.js — лента новостей, ивентов и голосований
// ============================================================
import { db, ADMIN_EMAIL } from "./firebase.js";
import { watchAuth } from "./auth.js";
import { esc } from "./utils.js";
import { renderHeader, toast, showSpinner, showEmpty } from "./ui.js";
import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, where, serverTimestamp, Timestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

renderHeader({ activePage: "news" });

const $ = id => document.getElementById(id);

// -------- Кэш игр (загружаем один раз) --------
let _allGames = null; // { id, title, image, source: "multi"|"solo" }[]

async function getAllGames() {
  if (_allGames) return _allGames;
  try {
    const [multiSnap, soloSnap] = await Promise.all([
      getDocs(collection(db, "games")),
      getDocs(collection(db, "soloGames")),
    ]);
    _allGames = [
      ...multiSnap.docs.map(d => ({ id: d.id, ...d.data(), source: "multi" })),
      ...soloSnap.docs.map(d => ({ id: d.id, ...d.data(), source: "solo"  })),
    ];
  } catch(e) {
    _allGames = [];
  }
  return _allGames;
}

// Прикреплённые к текущей форме игры
let attachedGames = []; // { id, title, image, source }

let currentUser = null;
let currentUserData = null;
let allPosts = [];
let _unsubFeed = null; // отписка от realtime

// -------- Auth --------
watchAuth({
  onLogin: (user, userData) => {
    currentUser = user;
    currentUserData = userData;
    if (user.email === ADMIN_EMAIL) {
      $("btn-create-post")?.classList.remove("hidden");
    }
    loadFeed();
  },
  onLogout: () => {
    currentUser = null;
    currentUserData = null;
    $("btn-create-post")?.classList.add("hidden");
    // Переподписываемся — без авторизации onSnapshot всё равно работает (read разрешён)
    loadFeed();
  }
});

// -------- Единый список ссылок+игр --------
// Каждый элемент: { type: "link"|"game", label, url } или { type:"game", id, title, image, source }
let linkItems = [];

function renderLinkItems() {
  const wrap = $("links-list");
  if (!wrap) return;
  wrap.innerHTML = "";
  linkItems.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "link-row";
    row.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap";
    if (item.type === "game") {
      row.innerHTML = `
        <div class="attached-game-chip" style="flex:1">
          ${item.image ? `<img src="${esc(item.image)}" alt="" onerror="this.style.display='none'" />` : ""}
          <span>${esc(item.title)}</span>
          <span style="font-size:.72rem;color:var(--text-secondary);margin-left:2px">${item.source==="solo"?"🕹":"🎮"}</span>
        </div>
        <button type="button" class="btn btn-ghost btn-sm js-remove-link" data-idx="${idx}" style="color:var(--danger,#e83030)">✕</button>`;
    } else {
      row.innerHTML = `
        <input type="text" class="link-label" placeholder="Название" value="${esc(item.label||"")}" style="flex:1;min-width:80px" data-idx="${idx}" />
        <input type="url"  class="link-url"   placeholder="https://..." value="${esc(item.url||"")}" style="flex:2;min-width:120px" data-idx="${idx}" />
        <button type="button" class="btn btn-ghost btn-sm js-remove-link" data-idx="${idx}" style="color:var(--danger,#e83030)">✕</button>`;
      row.querySelector(".link-label").addEventListener("input", e => { linkItems[idx].label = e.target.value; });
      row.querySelector(".link-url").addEventListener("input",  e => { linkItems[idx].url   = e.target.value; });
    }
    wrap.appendChild(row);
  });
}

// Кнопка добавить ссылку
document.addEventListener("click", e => {
  if (e.target.id === "btn-add-link") {
    linkItems.push({ type: "link", label: "", url: "" });
    renderLinkItems();
  }
  if (e.target.classList.contains("js-remove-link")) {
    const idx = parseInt(e.target.dataset.idx);
    linkItems.splice(idx, 1);
    renderLinkItems();
  }
  if (e.target.id === "btn-add-game") openGamePicker();
});

// -------- Модалка выбора игры --------
function openGamePicker() {
  const overlay = $("game-picker-overlay");
  overlay.classList.remove("hidden");
  $("game-picker-search").value = "";
  renderPickerList("");

  $("game-picker-search").focus();
}

$("game-picker-close")?.addEventListener("click", () => {
  $("game-picker-overlay").classList.add("hidden");
});
$("game-picker-overlay")?.addEventListener("click", e => {
  if (e.target === $("game-picker-overlay")) $("game-picker-overlay").classList.add("hidden");
});

$("game-picker-search")?.addEventListener("input", e => {
  renderPickerList(e.target.value.trim().toLowerCase());
});

async function renderPickerList(search) {
  const list = $("game-picker-list");
  list.innerHTML = `<div class="spinner" style="width:24px;height:24px;margin:16px auto"></div>`;
  const games = await getAllGames();
  const found = search
    ? games.filter(g => g.title?.toLowerCase().includes(search))
    : games;

  if (!found.length) {
    list.innerHTML = `<p style="color:var(--text-secondary);padding:12px">Ничего не найдено</p>`;
    return;
  }
  list.innerHTML = "";
  found.forEach(g => {
    const row = document.createElement("div");
    row.className = "game-search-item";
    row.innerHTML = `
      <img src="${esc(g.image||"")}" alt="" onerror="this.style.display='none'" />
      <div style="flex:1;min-width:0">
        <span class="gsi-title">${esc(g.title)}</span>
        <span class="gsi-type">${g.source === "solo" ? "🕹 Соло" : "🎮 Мульти"}</span>
      </div>
      <button class="btn btn-primary btn-sm" style="flex-shrink:0">Добавить</button>`;
    row.querySelector("button").addEventListener("click", () => {
      if (!linkItems.find(i => i.type === "game" && i.id === g.id)) {
        linkItems.push({ type: "game", id: g.id, title: g.title, image: g.image ?? null, source: g.source });
        renderLinkItems();
        toast(`Игра «${g.title}» добавлена`, "success");
      } else {
        toast("Эта игра уже добавлена", "error");
      }
      $("game-picker-overlay").classList.add("hidden");
    });
    list.appendChild(row);
  });
}

// -------- Переключение полей по типу --------
$("f-type")?.addEventListener("change", () => updateFormFields());

// -------- Превью картинки --------
$("f-post-image")?.addEventListener("input", () => {
  const val = $("f-post-image").value.trim();
  const preview = $("f-image-preview");
  const img = $("f-image-preview-img");
  if (val) {
    img.src = val;
    preview.style.display = "block";
    img.onerror = () => { preview.style.display = "none"; };
  } else {
    preview.style.display = "none";
  }
});

// -------- Динамические ссылки --------
function addLinkRow(label = "", url = "") {
  const row = document.createElement("div");
  row.className = "link-row";
  row.style.cssText = "display:flex;gap:8px;align-items:center";
  row.innerHTML = `
    <input type="text"  class="link-label" placeholder="Название (напр. Скачать)" value="${label}" style="flex:1;min-width:80px" />
    <input type="url"   class="link-url"   placeholder="https://..." value="${url}" style="flex:2;min-width:120px" />
    <button type="button" class="btn btn-ghost btn-sm js-remove-link" style="color:var(--danger);flex-shrink:0">✕</button>`;
  $("links-list").appendChild(row);
}

// Кнопка добавить ссылку — вешаем через делегирование на document
document.addEventListener("click", e => {
  if (e.target.id === "btn-add-link") addLinkRow();
  if (e.target.classList.contains("js-remove-link")) e.target.closest(".link-row")?.remove();
});

function updateFormFields() {
  const type = $("f-type").value;
  $("event-fields").classList.toggle("hidden", type !== "event");
  $("poll-fields").classList.toggle("hidden", type !== "poll");
}

// -------- Открыть форму создания --------
$("btn-create-post")?.addEventListener("click", () => {
  openCreateForm();
});

function openCreateForm(post = null) {
  const wrap = $("create-form-wrap");
  $("edit-post-id").value = post?.id ?? "";
  $("create-form-title").textContent = post ? "✏️ Редактировать запись" : "➕ Новая запись";
  $("f-type").value          = post?.type ?? "news";
  $("f-post-title").value    = post?.title ?? "";
  $("f-post-body").value     = post?.body ?? "";
  $("f-event-start").value   = post?.eventStart ? toDatetimeLocal(post.eventStart) : "";
  $("f-event-end").value     = post?.eventEnd   ? toDatetimeLocal(post.eventEnd)   : "";
  $("f-poll-options").value  = (post?.pollOptions ?? []).join("\n");
  $("f-poll-deadline").value = post?.pollDeadline ? toDatetimeLocal(post.pollDeadline) : "";
  $("f-post-image").value    = post?.image ?? "";
  // Ссылки и игры
  linkItems = (post?.linkItems ?? []).map(i => ({ ...i }));
  renderLinkItems();
  // Превью
  const previewImg = $("f-image-preview-img");
  const preview    = $("f-image-preview");
  if (post?.image) { previewImg.src = post.image; preview.style.display = "block"; }
  else             { preview.style.display = "none"; }
  // Ссылки
  $("links-list").innerHTML = "";
  (post?.links ?? []).forEach(l => addLinkRow(l.label, l.url));
  updateFormFields();
  wrap.classList.remove("hidden");
  wrap.scrollIntoView({ behavior: "smooth", block: "start" });
}

$("btn-cancel-post")?.addEventListener("click", () => {
  $("create-form-wrap").classList.add("hidden");
  linkItems = [];
  renderLinkItems();
});

$("btn-submit-post")?.addEventListener("click", async () => {
  const id    = $("edit-post-id").value;
  const type  = $("f-type").value;
  const title = $("f-post-title").value.trim();
  const body  = $("f-post-body").value.trim();

  if (!title) { toast("Укажи заголовок", "error"); return; }

  const image = $("f-post-image").value.trim();

  const data = {
    type, title, body,
    image: image || null,
    linkItems: linkItems.filter(i => i.type === "game" || (i.type === "link" && i.url)),
    authorId:    currentUser.uid,
    authorNick:  currentUserData?.nickname ?? currentUser.email,
    updatedAt:   Date.now(),
  };

  if (type === "event") {
    const s = $("f-event-start").value;
    const e = $("f-event-end").value;
    if (!s || !e) { toast("Укажи даты ивента", "error"); return; }
    data.eventStart = new Date(s).getTime();
    data.eventEnd   = new Date(e).getTime();
    data.status     = Date.now() < data.eventEnd ? "active" : "finished";
  }

  if (type === "poll") {
    const opts = $("f-poll-options").value.split("\n").map(s => s.trim()).filter(Boolean);
    if (opts.length < 2) { toast("Минимум 2 варианта ответа", "error"); return; }
    const dl = $("f-poll-deadline").value;
    data.pollOptions  = opts;
    data.pollDeadline = dl ? new Date(dl).getTime() : null;
    data.pollVotes    = {}; // всегда инициализируем
  }

  try {
    if (id) {
      await updateDoc(doc(db, "newsPosts", id), data);
      toast("Обновлено!", "success");
    } else {
      data.createdAt = Date.now();
      data.likes = [];
      data.comments = [];
      await addDoc(collection(db, "newsPosts"), data);
      toast("Опубликовано!", "success");
    }
    $("create-form-wrap").classList.add("hidden");
    loadFeed();
  } catch (err) {
    toast("Ошибка: " + err.message, "error");
  }
});

// -------- Фильтр --------
$("filter-type")?.addEventListener("change", renderFeed);

// -------- Загрузка --------
function loadFeed() {
  // Отписываемся от предыдущей подписки если есть
  if (_unsubFeed) { _unsubFeed(); _unsubFeed = null; }

  showSpinner($("news-feed"));

  const q = query(collection(db, "newsPosts"), orderBy("createdAt", "desc"));

  _unsubFeed = onSnapshot(q, snap => {
    allPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFeed();

    // Показываем тост при новой записи (не при первой загрузке)
    snap.docChanges().forEach(change => {
      if (change.type === "added" && !snap.metadata.hasPendingWrites) {
        const post = change.doc.data();
        // Не показываем тост если это наша собственная запись
        if (post.authorId !== currentUser?.uid) {
          toast(`📢 Новая запись: ${post.title}`, "info");
        }
      }
    });
  }, err => {
    showEmpty($("news-feed"), "Ошибка загрузки: " + err.message);
  });
}

function renderFeed() {
  const typeFilter = $("filter-type")?.value ?? "";
  const posts = typeFilter ? allPosts.filter(p => p.type === typeFilter) : allPosts;

  const feed = $("news-feed");
  if (!posts.length) {
    showEmpty(feed, "Записей пока нет");
    return;
  }

  feed.innerHTML = "";
  for (const post of posts) {
    feed.appendChild(buildPostCard(post));
  }
}

// -------- Карточка поста --------
function buildPostCard(post) {
  const isAdmin = currentUser?.email === ADMIN_EMAIL;
  const liked   = (post.likes ?? []).includes(currentUser?.uid);
  const typeLabel = { news: "📢 Новость", event: "🎯 Ивент", poll: "🗳 Голосование" }[post.type] ?? "";
  const typeClass = { news: "badge-news", event: "badge-event", poll: "badge-poll" }[post.type] ?? "";
  const date = post.createdAt ? new Date(post.createdAt).toLocaleString("ru-RU", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "";

  const card = document.createElement("div");
  card.className = "news-card";
  card.dataset.postId = post.id;

  let extraHtml = "";

  // ---- Ивент ----
  if (post.type === "event" && post.eventStart && post.eventEnd) {
    const now   = Date.now();
    const start = post.eventStart;
    const end   = post.eventEnd;
    let statusBadge = "";
    if (now < start)      statusBadge = `<span class="event-status upcoming">⏳ Скоро</span>`;
    else if (now <= end)  statusBadge = `<span class="event-status active">🟢 Идёт сейчас</span>`;
    else                  statusBadge = `<span class="event-status finished">🏁 Завершён</span>`;

    extraHtml = `
      <div class="event-dates">
        ${statusBadge}
        <span>🗓 ${fmtDate(start)} — ${fmtDate(end)}</span>
      </div>`;

    // Если ивент идёт — показываем countdown
    if (now >= start && now <= end) {
      const remaining = end - now;
      extraHtml += `<div class="event-countdown js-countdown" data-end="${end}">⏱ ${fmtCountdown(remaining)}</div>`;
    }

    // Кнопка завершить (для админа, если ещё активен)
    if (isAdmin && now <= end) {
      extraHtml += `<button class="btn btn-ghost btn-sm js-finish-event" style="margin-top:8px">🏁 Завершить ивент</button>`;
    }
  }

  // ---- Голосование ----
  if (post.type === "poll" && post.pollOptions?.length) {
    const votes     = post.pollVotes ?? {};
    const myVote    = currentUser ? votes[currentUser.uid] : undefined;
    const hasVoted  = myVote !== undefined && myVote !== null;
    const totalVotes = Object.keys(votes).length;
    const isPollOpen = !post.pollDeadline || Date.now() < post.pollDeadline;
    const canVote    = currentUser && isPollOpen;

    const optionsHtml = post.pollOptions.map((opt, i) => {
      const count  = Object.values(votes).filter(v => v === i).length;
      const pct    = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
      const isMine = hasVoted && myVote === i;
      const clickable = canVote && !hasVoted;

      return `
        <div class="poll-option ${isMine ? "poll-option--voted" : ""} ${clickable ? "poll-option--clickable js-vote" : ""}" data-idx="${i}">
          <div class="poll-option-label">
            <span class="poll-opt-text">${esc(opt)}</span>
            ${isMine ? `<span class="my-vote-badge">\u2713 мой голос</span>` : ""}
          </div>
          ${(hasVoted || !canVote) ? `
            <div class="poll-bar">
              <div class="poll-fill" style="width:${pct}%"></div>
            </div>
            <span class="poll-pct">${pct}% (${count})</span>
          ` : ""}
        </div>`;
    }).join("");

    const deadlineHtml = post.pollDeadline
      ? `<p class="poll-deadline">📅 До: ${fmtDate(post.pollDeadline)}</p>`
      : "";
    const closedBadge  = !isPollOpen ? `<span class="event-status finished">🔒 Закрыто</span>` : "";

    extraHtml = `
      <div class="poll-wrap">
        ${closedBadge}
        ${deadlineHtml}
        <div class="poll-options-list">${optionsHtml}</div>
        <p class="poll-total">Всего голосов: ${totalVotes}</p>
      </div>`;
  }

  // Ссылки и прикреплённые игры (единый список)
  const items = post.linkItems ?? [];
  const itemsHtml = items.length
    ? `<div class="post-games-list">${items.map(item => {
        if (item.type === "game") {
          const href = item.source === "solo" ? "solo.html" : "index.html";
          return `<a class="post-game-chip" href="${esc(href)}" title="Открыть страницу игры">
            ${item.image ? `<img src="${esc(item.image)}" alt="" onerror="this.style.display='none'" />` : ""}
            <div class="pgc-info">
              <span class="pgc-title">${esc(item.title)}</span>
              <span class="pgc-type">${item.source === "solo" ? "🕹 Соло" : "🎮 Мульти"}</span>
            </div>
            <span class="pgc-arrow">→</span>
          </a>`;
        } else {
          return `<a class="news-link-btn" href="${esc(item.url)}" target="_blank" rel="noopener">
            🔗 ${esc(item.label || item.url)}
          </a>`;
        }
      }).join("")}</div>`
    : "";

  // Картинка
  const imageHtml = post.image
    ? `<img class="news-card-image" src="${esc(post.image)}" alt="" onerror="this.style.display='none'">`
    : "";

  // Ссылки
  const linksHtml = (post.links ?? []).length
    ? `<div class="news-links">${(post.links).map(l =>
        `<a class="news-link-btn" href="${esc(l.url)}" target="_blank" rel="noopener">🔗 ${esc(l.label || l.url)}</a>`
      ).join("")}</div>`
    : "";

  card.innerHTML = `
    <div class="news-card-header">
      <span class="news-type-badge ${typeClass}">${typeLabel}</span>
      <span class="news-date">${date}</span>
    </div>
    ${imageHtml}
    <h3 class="news-title">${esc(post.title)}</h3>
    ${post.body ? `<p class="news-body">${esc(post.body)}</p>` : ""}
    ${itemsHtml}
    ${extraHtml}
    <div class="news-actions">
      <button class="btn btn-ghost btn-sm js-like ${liked ? "liked" : ""}">
        ${liked ? "❤️" : "🤍"} ${(post.likes ?? []).length}
      </button>
      <button class="btn btn-ghost btn-sm js-toggle-comments">
        💬 ${(post.comments ?? []).length} комментариев
      </button>
      ${isAdmin ? `
        <button class="btn btn-ghost btn-sm js-edit-post">✏️</button>
        <button class="btn btn-ghost btn-sm js-delete-post" style="color:var(--danger)">🗑</button>
        ${post.type === "poll" && post.pollOptions?.length ? `<button class="btn btn-ghost btn-sm js-reset-poll">🔄 Сбросить голоса</button>` : ""}
      ` : ""}
    </div>
    <div class="news-comments hidden"></div>`;

  // Лайк
  card.querySelector(".js-like")?.addEventListener("click", () => toggleLike(post));

  // Голосование — кликабельные div-ы
  card.querySelectorAll(".js-vote").forEach(el => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.idx);
      if (!currentUser) { toast("Войдите, чтобы голосовать", "error"); return; }
      votePoll(post, idx);
    });
  });

  // Завершить ивент
  card.querySelector(".js-finish-event")?.addEventListener("click", async () => {
    await updateDoc(doc(db, "newsPosts", post.id), {
      eventEnd: Date.now() - 1,
      status: "finished"
    });
    toast("Ивент завершён", "success"); // onSnapshot обновит автоматически
  });

  // Комментарии
  const commWrap = card.querySelector(".news-comments");
  card.querySelector(".js-toggle-comments")?.addEventListener("click", () => {
    const hidden = commWrap.classList.toggle("hidden");
    if (!hidden) loadComments(post.id, commWrap);
  });

  // Редактировать / удалить
  card.querySelector(".js-edit-post")?.addEventListener("click", () => openCreateForm(post));
  card.querySelector(".js-delete-post")?.addEventListener("click", async () => {
    if (!confirm("Удалить запись?")) return;
    await deleteDoc(doc(db, "newsPosts", post.id));
    toast("Удалено", "success"); // onSnapshot обновит автоматически
  });

  // Сбросить голоса
  card.querySelector(".js-reset-poll")?.addEventListener("click", async () => {
    if (!confirm("Сбросить все голоса?")) return;
    await updateDoc(doc(db, "newsPosts", post.id), { pollVotes: {} });
    toast("Голоса сброшены", "success"); // onSnapshot обновит автоматически
  });

  // Countdown timer
  const countdownEl = card.querySelector(".js-countdown");
  if (countdownEl) {
    const endMs = parseInt(countdownEl.dataset.end);
    const timer = setInterval(() => {
      const left = endMs - Date.now();
      if (left <= 0) { clearInterval(timer); countdownEl.textContent = "🏁 Завершён"; return; }
      countdownEl.textContent = "⏱ " + fmtCountdown(left);
    }, 1000);
  }

  return card;
}

// -------- Лайк --------
async function toggleLike(post) {
  if (!currentUser) { toast("Войдите, чтобы лайкать", "error"); return; }
  const ref    = doc(db, "newsPosts", post.id);
  const likes  = post.likes ?? [];
  const uid    = currentUser.uid;
  const newLikes = likes.includes(uid) ? likes.filter(id => id !== uid) : [...likes, uid];
  await updateDoc(ref, { likes: newLikes });
  post.likes = newLikes;
  // onSnapshot обновит ленту автоматически
}

// -------- Голосование --------
async function votePoll(post, idx) {
  if (!currentUser) { toast("Войдите, чтобы голосовать", "error"); return; }
  // Используем точечную нотацию чтобы не перезаписывать чужие голоса
  const updateData = {};
  updateData[`pollVotes.${currentUser.uid}`] = idx;
  await updateDoc(doc(db, "newsPosts", post.id), updateData);
  if (!post.pollVotes) post.pollVotes = {};
  post.pollVotes[currentUser.uid] = idx;
  renderFeed();
}

// -------- Комментарии --------
async function loadComments(postId, wrap) {
  wrap.innerHTML = `<div class="spinner" style="width:24px;height:24px;margin:8px auto"></div>`;
  const snap = await getDocs(query(
    collection(db, "newsComments"),
    where("postId", "==", postId),
    orderBy("createdAt", "asc")
  ));
  const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  wrap.innerHTML = `<div class="comments-section"></div>`;
  const sec = wrap.querySelector(".comments-section");

  if (!comments.length) {
    sec.innerHTML = `<p class="text-muted" style="margin:8px 0">Нет комментариев. Будь первым!</p>`;
  } else {
    for (const c of comments) {
      const isMe    = currentUser?.uid === c.authorId;
      const isAdmin = currentUser?.email === ADMIN_EMAIL;
      const el = document.createElement("div");
      el.className = "comment-item";
      el.innerHTML = `
        <div class="comment-header">
          <span class="comment-author">${esc(c.authorNick ?? "Аноним")}</span>
          <span style="font-size:.75rem;color:var(--text-secondary)">${c.createdAt ? new Date(c.createdAt).toLocaleString("ru-RU") : ""}</span>
        </div>
        <p class="comment-text">${esc(c.text)}</p>
        ${(isMe || isAdmin) ? `
          <div class="comment-actions">
            ${isMe ? `<button class="comment-vote js-edit-nc">✏️</button>` : ""}
            <button class="comment-vote js-del-nc">🗑</button>
          </div>` : ""}`;
      el.querySelector(".js-del-nc")?.addEventListener("click", async () => {
        await deleteDoc(doc(db, "newsComments", c.id));
        loadComments(postId, wrap);
      });
      el.querySelector(".js-edit-nc")?.addEventListener("click", () => {
        const ta = el.querySelector(".comment-text");
        const old = c.text;
        ta.contentEditable = "true";
        ta.focus();
        ta.addEventListener("blur", async () => {
          ta.contentEditable = "false";
          const newText = ta.textContent.trim();
          if (newText && newText !== old) {
            await updateDoc(doc(db, "newsComments", c.id), { text: newText });
            c.text = newText;
          }
        }, { once: true });
      });
      sec.appendChild(el);
    }
  }

  // Форма комментария
  if (currentUser) {
    const form = document.createElement("div");
    form.className = "comment-form";
    form.innerHTML = `
      <textarea placeholder="Напишите комментарий..." style="width:100%;min-height:60px;resize:vertical"></textarea>
      <button class="btn btn-primary btn-sm" style="margin-top:6px">Отправить</button>`;
    form.querySelector("button").addEventListener("click", async () => {
      const text = form.querySelector("textarea").value.trim();
      if (!text) return;
      await addDoc(collection(db, "newsComments"), {
        postId,
        authorId:   currentUser.uid,
        authorNick: currentUserData?.nickname ?? currentUser.email,
        text,
        createdAt:  Date.now(),
      });
      // Обновляем счётчик в посте
      const postRef = doc(db, "newsPosts", postId);
      const postSnap = await getDoc(postRef);
      if (postSnap.exists()) {
        const cur = postSnap.data().comments ?? [];
        await updateDoc(postRef, { comments: [...cur, currentUser.uid] });
      }
      loadComments(postId, wrap);
    });
    sec.appendChild(form);
  }
}

// -------- Утилиты дат --------
function fmtDate(ms) {
  return new Date(ms).toLocaleString("ru-RU", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });
}
function fmtCountdown(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}
function toDatetimeLocal(ms) {
  const d = new Date(ms);
  return d.getFullYear() + "-" +
    String(d.getMonth()+1).padStart(2,"0") + "-" +
    String(d.getDate()).padStart(2,"0") + "T" +
    String(d.getHours()).padStart(2,"0") + ":" +
    String(d.getMinutes()).padStart(2,"0");
}

// Отписка при закрытии страницы
window.addEventListener("beforeunload", () => {
  if (_unsubFeed) _unsubFeed();
});
