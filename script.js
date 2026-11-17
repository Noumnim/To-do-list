// ---------- State ----------
const STORAGE_KEY = "taskflow.tasks";
const THEME_KEY = "taskflow.theme";

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

let tasks = store.get(STORAGE_KEY, null) ?? [
  { id: uid(), title: "Welcome to Taskflow 👋 — click the circle to complete a task", priority: "medium", due: todayISO(), done: false, created: Date.now() - 3000 },
  { id: uid(), title: "Double-click a task to edit it", priority: "low", due: "", done: false, created: Date.now() - 2000 },
  { id: uid(), title: "Drag the handle to reorder tasks", priority: "high", due: "", done: false, created: Date.now() - 1000 },
];

let view = "all";
let sortBy = "created";
let query = "";
let lastDeleted = null;

// ---------- Elements ----------
const $ = (s) => document.querySelector(s);
const list = $("#task-list");
const empty = $("#empty");
const form = $("#composer");
const input = $("#task-input");
const dateInput = $("#task-date");
const prioInput = $("#task-priority");
const toast = $("#toast");

const VIEW_TITLES = { all: "All tasks", today: "Today", upcoming: "Upcoming", important: "High priority", completed: "Completed" };
const PRIO_RANK = { high: 0, medium: 1, low: 2 };

const icons = {
  check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
  grip: '<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>',
};

// ---------- Helpers ----------
const save = () => store.set(STORAGE_KEY, tasks);

const escapeHTML = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function formatDue(due) {
  if (!due) return null;
  const t = todayISO();
  const d = new Date(due + "T00:00");
  const diff = Math.round((d - new Date(t + "T00:00")) / 86400000);
  if (diff === 0) return { label: "Today", cls: "today" };
  if (diff === 1) return { label: "Tomorrow", cls: "" };
  if (diff < 0) return { label: `Overdue · ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`, cls: "overdue" };
  return { label: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }), cls: "" };
}

const filters = {
  all: (t) => true,
  today: (t) => !t.done && t.due && t.due <= todayISO(),
  upcoming: (t) => !t.done && t.due && t.due > todayISO(),
  important: (t) => !t.done && t.priority === "high",
  completed: (t) => t.done,
};

function visibleTasks() {
  let out = tasks.filter(filters[view]);
  if (query) out = out.filter((t) => t.title.toLowerCase().includes(query));
  if (sortBy === "due") out = [...out].sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  if (sortBy === "priority") out = [...out].sort((a, b) => PRIO_RANK[a.priority] - PRIO_RANK[b.priority]);
  // Keep completed at the bottom (except in Completed view)
  if (view !== "completed") out = [...out].sort((a, b) => a.done - b.done);
  return out;
}

// ---------- Render ----------
function render() {
  const items = visibleTasks();
  list.innerHTML = items.map(taskHTML).join("");
  empty.classList.toggle("show", items.length === 0);
  empty.querySelector("h3").textContent = query ? "No matching tasks" : view === "completed" ? "No completed tasks" : "You're all caught up";
  empty.querySelector("p").textContent = query ? "Try a different search term." : "Add a task above to get started.";
  updateCounts();
}

function taskHTML(t) {
  const due = formatDue(t.due);
  return `
    <li class="task ${t.done ? "done" : ""}" data-id="${t.id}" data-priority="${t.priority}" draggable="${sortBy === "created" && !query}">
      <span class="drag" title="Drag to reorder">${icons.grip}</span>
      <button class="check" data-action="toggle" aria-label="Toggle complete">${icons.check}</button>
      <div class="task-body">
        <div class="task-title" data-action="edit-text">${escapeHTML(t.title)}</div>
        <div class="task-meta">
          <span class="badge prio">${t.priority}</span>
          ${due ? `<span class="badge ${t.done ? "" : due.cls}">${icons.cal}${due.label}</span>` : ""}
        </div>
      </div>
      <div class="actions">
        <button class="icon-btn" data-action="edit" title="Edit">${icons.edit}</button>
        <button class="icon-btn delete" data-action="delete" title="Delete">${icons.trash}</button>
      </div>
    </li>`;
}

function updateCounts() {
  for (const key of Object.keys(filters)) {
    $(`#count-${key}`).textContent = tasks.filter(filters[key]).length;
  }
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  $("#ring").style.strokeDashoffset = 100 - pct;
  $("#ring-label").textContent = pct + "%";
  $("#progress-sub").textContent = `${done} of ${total} done`;
}

function showToast(msg, undo) {
  toast.innerHTML = `<span>${msg}</span>${undo ? '<button id="undo">Undo</button>' : ""}`;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 4000);
  if (undo) $("#undo").onclick = () => { undo(); toast.classList.remove("show"); };
}

// ---------- Actions ----------
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = input.value.trim();
  if (!title) return;
  tasks.unshift({ id: uid(), title, priority: prioInput.value, due: dateInput.value, done: false, created: Date.now() });
  save(); render();
  input.value = ""; dateInput.value = ""; prioInput.value = "medium";
  input.focus();
});

list.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const li = btn.closest(".task");
  const task = tasks.find((t) => t.id === li.dataset.id);
  const action = btn.dataset.action;

  if (action === "toggle") {
    task.done = !task.done;
    save(); render();
  } else if (action === "delete") {
    li.classList.add("removing");
    setTimeout(() => {
      const idx = tasks.indexOf(task);
      tasks.splice(idx, 1);
      lastDeleted = { task, idx };
      save(); render();
      showToast("Task deleted", () => { tasks.splice(lastDeleted.idx, 0, lastDeleted.task); save(); render(); });
    }, 180);
  } else if (action === "edit") {
    startEdit(li, task);
  }
});

list.addEventListener("dblclick", (e) => {
  const li = e.target.closest(".task");
  if (li && e.target.closest(".task-body")) startEdit(li, tasks.find((t) => t.id === li.dataset.id));
});

function startEdit(li, task) {
  const el = li.querySelector(".task-title");
  el.contentEditable = "true";
  el.focus();
  document.getSelection().selectAllChildren(el);
  document.getSelection().collapseToEnd();

  const finish = (commit) => {
    el.onblur = null; 
    el.contentEditable = "false";
    const text = el.textContent.trim();
    if (commit && text) task.title = text;
    save(); render();
  };
  el.onkeydown = (ev) => {
    if (ev.key === "Enter") { ev.preventDefault(); finish(true); }
    if (ev.key === "Escape") finish(false);
  };
  el.onblur = () => finish(true);
}

// Navigation
$("#nav").addEventListener("click", (e) => {
  const item = e.target.closest(".nav-item");
  if (!item) return;
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n === item));
  view = item.dataset.view;
  $("#view-title").textContent = VIEW_TITLES[view];
  render();
});

// Sorting
$("#sort-tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
  sortBy = tab.dataset.sort;
  render();
});

// Search
$("#search").addEventListener("input", (e) => { query = e.target.value.trim().toLowerCase(); render(); });

// Clear completed
$("#clear-completed").addEventListener("click", () => {
  const removed = tasks.filter((t) => t.done);
  if (!removed.length) return showToast("No completed tasks to clear");
  const snapshot = [...tasks];
  tasks = tasks.filter((t) => !t.done);
  save(); render();
  showToast(`Cleared ${removed.length} task${removed.length > 1 ? "s" : ""}`, () => { tasks = snapshot; save(); render(); });
});

// Drag & drop reorder
let dragId = null;
list.addEventListener("dragstart", (e) => {
  const li = e.target.closest(".task");
  dragId = li.dataset.id;
  li.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
});
list.addEventListener("dragend", (e) => e.target.closest(".task")?.classList.remove("dragging"));
list.addEventListener("dragover", (e) => {
  e.preventDefault();
  const over = e.target.closest(".task");
  const dragging = list.querySelector(".dragging");
  if (!over || over === dragging) return;
  const rect = over.getBoundingClientRect();
  const after = e.clientY > rect.top + rect.height / 2;
  list.insertBefore(dragging, after ? over.nextSibling : over);
});
list.addEventListener("drop", () => {
  const order = [...list.children].map((li) => li.dataset.id);
  const visible = new Set(order);
  const reordered = order.map((id) => tasks.find((t) => t.id === id));
  let i = 0;
  tasks = tasks.map((t) => (visible.has(t.id) ? reordered[i++] : t));
  save(); render();
});

// Theme
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("#theme-label").textContent = theme === "dark" ? "Light mode" : "Dark mode";
  store.set(THEME_KEY, theme);
}
$("#theme-toggle").addEventListener("click", () =>
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

// Keyboard shortcut: "/" to focus the input
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement.tagName !== "INPUT" && !document.activeElement.isContentEditable) {
    e.preventDefault(); input.focus();
  }
});

// ---------- Init ----------
$("#today-date").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
applyTheme(store.get(THEME_KEY, window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
render();