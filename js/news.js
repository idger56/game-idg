// ============================================================
//  news.js — лента новостей, ивентов и голосований
// ============================================================
import { db, ADMIN_EMAIL } from "./firebase.js";
import { watchAuth } from "./auth.js";
import { esc } from "./utils.js";
import { renderHeader, toast, showSpinner, showEmpty } from "./ui.js";
import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, where, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

renderHeader({ activePage: "news" });

const $ = id => document.getElementById(id);

let currentUser = null;
let currentUserData = null;
let allPosts = [];

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
    loadFeed();
  }
});

// -------- Переключение полей по типу --------
$("f-type")?.addEventListener("change", () => updateFormFields());

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
  updateFormFields();
  wrap.classList.remove("hidden");
  wrap.scrollIntoView({ behavior: "smooth", block: "start" });
}

$("btn-cancel-post")?.addEventListener("click", () => {
  $("create-form-wrap").classList.add("hidden");
});

$("btn-submit-post")?.addEventListener("click", async () => {
  const id    = $("edit-post-id").value;
  const type  = $("f-type").value;
  const title = $("f-post-title").value.trim();
  const body  = $("f-post-body").value.trim();

  if (!title) { toast("Укажи заголовок", "error"); return; }

  const data = {
    type, title, body,
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
async function loadFeed() {
  showSpinner($("news-feed"));
  try {
    const snap = await getDocs(query(collection(db, "newsPosts"), orderBy("createdAt", "desc")));
    allPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFeed();
  } catch (err) {
    showEmpty($("news-feed"), "Ошибка загрузки: " + err.message);
  }
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

  card.innerHTML = `
    <div class="news-card-header">
      <span class="news-type-badge ${typeClass}">${typeLabel}</span>
      <span class="news-date">${date}</span>
    </div>
    <h3 class="news-title">${esc(post.title)}</h3>
    ${post.body ? `<p class="news-body">${esc(post.body)}</p>` : ""}
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
    toast("Ивент завершён", "success");
    loadFeed();
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
    toast("Удалено", "success");
    loadFeed();
  });

  // Сбросить голоса
  card.querySelector(".js-reset-poll")?.addEventListener("click", async () => {
    if (!confirm("Сбросить все голоса?")) return;
    await updateDoc(doc(db, "newsPosts", post.id), { pollVotes: {} });
    toast("Голоса сброшены", "success");
    loadFeed();
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
  renderFeed();
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
