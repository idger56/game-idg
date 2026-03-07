// ============================================================
//  feedback.js — обратная связь (предложения, баги, идеи)
// ============================================================
import { db, ADMIN_EMAIL } from "./firebase.js";
import { watchAuth } from "./auth.js";
import { esc } from "./utils.js";
import { renderHeader, toast, showSpinner, showEmpty } from "./ui.js";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

renderHeader({ activePage: "feedback" });

const $ = id => document.getElementById(id);

let currentUser = null;
let currentUserData = null;
let isAdmin = false;

const TYPE_LABELS = {
  suggestion: "💡 Предложение",
  bug:        "🐛 Проблема",
  game:       "🎮 По игре",
  other:      "📌 Другое",
};
const STATUS_LABELS = {
  open:        "🟡 Открыто",
  in_progress: "🔵 В работе",
  done:        "✅ Закрыто",
};

// -------- Auth --------
watchAuth({
  onLogin: (user, userData) => {
    currentUser = user;
    currentUserData = userData;
    isAdmin = user.email === ADMIN_EMAIL;
    $("feedback-form-wrap")?.classList.remove("hidden");
    $("auth-wall-fb")?.classList.add("hidden");
    if (isAdmin) {
      $("fb-list-title").textContent = "📋 Все обращения";
      $("filter-fb-status")?.classList.remove("hidden");
      $("filter-fb-type")?.classList.remove("hidden");
    }
    loadFeedback();
  },
  onLogout: () => {
    currentUser = null;
    isAdmin = false;
    $("feedback-form-wrap")?.classList.add("hidden");
    $("auth-wall-fb")?.classList.remove("hidden");
    showEmpty($("feedback-list"), "Войдите, чтобы видеть обращения");
  }
});

// -------- Отправка --------
$("btn-send-feedback")?.addEventListener("click", async () => {
  const type    = $("f-fb-type").value;
  const subject = $("f-fb-subject").value.trim();
  const body    = $("f-fb-body").value.trim();

  if (!subject) { toast("Укажи тему", "error"); return; }

  try {
    await addDoc(collection(db, "feedbackItems"), {
      type,
      subject,
      body,
      authorId:   currentUser.uid,
      authorNick: currentUserData?.nickname ?? currentUser.email,
      status:     "open",
      createdAt:  Date.now(),
      adminNote:  "",
    });
    $("f-fb-subject").value = "";
    $("f-fb-body").value    = "";
    toast("Обращение отправлено!", "success");
    loadFeedback();
  } catch (err) {
    toast("Ошибка: " + err.message, "error");
  }
});

// -------- Фильтры (только для админа) --------
$("filter-fb-status")?.addEventListener("change", loadFeedback);
$("filter-fb-type")?.addEventListener("change",   loadFeedback);

// -------- Загрузка --------
async function loadFeedback() {
  showSpinner($("feedback-list"));
  try {
    let q;
    if (isAdmin) {
      q = query(collection(db, "feedbackItems"), orderBy("createdAt", "desc"));
    } else {
      q = query(collection(db, "feedbackItems"),
        where("authorId", "==", currentUser.uid),
        orderBy("createdAt", "desc"));
    }
    const snap = await getDocs(q);
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Фильтры для админа (клиентски, т.к. нет составных индексов)
    if (isAdmin) {
      const fStatus = $("filter-fb-status")?.value ?? "";
      const fType   = $("filter-fb-type")?.value   ?? "";
      if (fStatus) items = items.filter(i => i.status === fStatus);
      if (fType)   items = items.filter(i => i.type === fType);
    }

    renderFeedback(items);
  } catch (err) {
    showEmpty($("feedback-list"), "Ошибка: " + err.message);
  }
}

// -------- Рендер --------
function renderFeedback(items) {
  const list = $("feedback-list");
  if (!items.length) {
    showEmpty(list, "Обращений пока нет");
    return;
  }
  list.innerHTML = "";
  for (const item of items) {
    list.appendChild(buildFeedbackCard(item));
  }
}

function buildFeedbackCard(item) {
  const card = document.createElement("div");
  card.className = "feedback-card";
  const date = item.createdAt
    ? new Date(item.createdAt).toLocaleString("ru-RU", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
    : "";
  const statusClass = { open: "status-open", in_progress: "status-progress", done: "status-done" }[item.status] ?? "";

  card.innerHTML = `
    <div class="fb-card-header">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="news-type-badge badge-fb-${item.type}">${TYPE_LABELS[item.type] ?? item.type}</span>
        <span class="fb-status ${statusClass}">${STATUS_LABELS[item.status] ?? item.status}</span>
      </div>
      <span class="news-date">${date}</span>
    </div>
    <h3 class="news-title" style="margin:10px 0 6px">${esc(item.subject)}</h3>
    ${item.body ? `<p class="news-body">${esc(item.body)}</p>` : ""}
    ${item.authorNick && isAdmin ? `<p style="font-size:.8rem;color:var(--text-secondary);margin-top:4px">👤 ${esc(item.authorNick)}</p>` : ""}
    ${item.adminNote ? `
      <div class="admin-note">
        <strong>📝 Ответ администратора:</strong>
        <p>${esc(item.adminNote)}</p>
      </div>` : ""}
    ${isAdmin ? `
      <div class="fb-admin-panel">
        <select class="js-status-sel card-select" style="width:auto">
          <option value="open"        ${item.status==="open"        ?"selected":""}>🟡 Открыто</option>
          <option value="in_progress" ${item.status==="in_progress" ?"selected":""}>🔵 В работе</option>
          <option value="done"        ${item.status==="done"        ?"selected":""}>✅ Закрыто</option>
        </select>
        <div style="display:flex;gap:6px;flex:1;min-width:200px">
          <input class="js-admin-note" type="text" placeholder="Ответить пользователю..." value="${esc(item.adminNote??'')}" style="flex:1" />
          <button class="btn btn-primary btn-sm js-save-note">💾</button>
        </div>
        <button class="btn btn-ghost btn-sm js-delete-fb" style="color:var(--danger)">🗑</button>
      </div>` : ""}`;

  // Смена статуса
  card.querySelector(".js-status-sel")?.addEventListener("change", async e => {
    await updateDoc(doc(db, "feedbackItems", item.id), { status: e.target.value });
    item.status = e.target.value;
    toast("Статус обновлён", "success");
  });

  // Сохранить заметку
  card.querySelector(".js-save-note")?.addEventListener("click", async () => {
    const note = card.querySelector(".js-admin-note").value.trim();
    await updateDoc(doc(db, "feedbackItems", item.id), { adminNote: note });
    toast("Ответ сохранён", "success");
    loadFeedback();
  });

  // Удалить
  card.querySelector(".js-delete-fb")?.addEventListener("click", async () => {
    if (!confirm("Удалить обращение?")) return;
    await deleteDoc(doc(db, "feedbackItems", item.id));
    toast("Удалено", "success");
    loadFeedback();
  });

  return card;
}
