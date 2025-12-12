"use strict";

/* =========================
   0) 設定
========================= */
const API = {
  today: "/api/today",
  state: "/api/state",
  importFile: "/api/import_state",
  importPasted: "/api/import_state_pasted",
  done: "/api/tasks/done",
};

/* =========================
   1) 便利関数（DOM/表示）
========================= */
function $(id) {
  return document.getElementById(id);
}

function nowIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function setText(id, text) {
  const el = $(id);
  if (!el) return;
  el.textContent = (text ?? "").toString();
}

function setList(id, items) {
  const ul = $(id);
  if (!ul) return;
  ul.innerHTML = "";

  if (!items) return;
  const arr = Array.isArray(items) ? items : [items];

  arr.filter(Boolean).forEach((v) => {
    const li = document.createElement("li");
    li.textContent = v.toString();
    ul.appendChild(li);
  });
}

function showNotice(msg, type = "info") {
  const box = $("notice");
  if (!box) return;
  box.hidden = false;
  box.className = `notice notice--${type}`;
  box.textContent = msg;
}

function hideNotice() {
  const box = $("notice");
  if (!box) return;
  box.hidden = true;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* =========================
   2) 千紗：吹き出し
========================= */
const CHISA_LINES = {
  on_app_start: ["おかえり、小鳥遊。今日もよろしくね。"],
  on_today_loaded: ["今日のおすすめ、出したよ。", "今の状態でいけそうなやつからいこう。"],
  on_task_done: ["完了にしておいたよ。いいペース。"],
  on_import_ok: ["日誌、読んで反映したよ。"],
  on_import_ng: ["うまくいかなかったみたい。ログを見てみよ。"],
  on_error: ["エラーっぽい。落ち着いて1個ずつ直そ。"],
};

function pick(arr) {
  if (!arr || arr.length === 0) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}

let bubbleTimer = null;

function chisaSay(text, ms = 2200) {
  const bubble = $("chisa-bubble");
  const bubbleText = $("chisa-bubble-text");
  if (!bubble || !bubbleText) return;

  bubbleText.textContent = text;
  bubble.classList.remove("chisa-bubble-hidden");

  if (bubbleTimer) clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => {
    bubble.classList.add("chisa-bubble-hidden");
  }, ms);
}

function chisaSayFromKey(key) {
  const line = pick(CHISA_LINES[key]);
  if (line) chisaSay(line);
}

/* =========================
   3) 画面（タブ切り替え）
========================= */
function activateView(viewId, tabId, title) {
  document.querySelectorAll(".vg-view").forEach((v) => v.classList.remove("vg-view-active"));
  const view = $(viewId);
  if (view) view.classList.add("vg-view-active");

  document.querySelectorAll(".vg-tab").forEach((t) => t.classList.remove("vg-tab-active"));
  const tab = $(tabId);
  if (tab) tab.classList.add("vg-tab-active");

  if (title) setText("page-title", title);
}

/* =========================
   4) API 通信
========================= */
async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  // Flask側が JSON を返す想定
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = (data && data.error) ? data.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/* =========================
   5) 今日のおすすめ：表示
========================= */
let todayTasks = []; // /api/today の配列を保持

function calcDaysLeft(dueDateStr) {
  // due_date が無いなら null
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr + "T00:00:00");
  const today = new Date();
  // 今日の 00:00 に揃える
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = due - t0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function renderTodayTable(tasks) {
  const tbody = $("task-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!tasks || tasks.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" class="muted">タスクがありません。</td>`;
    tbody.appendChild(tr);
    return;
  }

  tasks.forEach((t) => {
    const daysLeft = calcDaysLeft(t.due_date);
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${t.id ?? ""}</td>
      <td>
        <div class="task-text">${escapeHtml(t.text ?? "")}</div>
        <div class="task-reason muted">${escapeHtml(t.reason ?? "")}</div>
        <div class="task-tags">${(t.tags ?? []).map(tagPill).join("")}</div>
      </td>
      <td>${escapeHtml(t.project ?? "")}</td>
      <td>${escapeHtml(t.due_date ?? "")}</td>
      <td>${daysLeft === null ? "-" : `${daysLeft}日`}</td>
      <td>${t.score ?? ""}</td>
      <td>
        <button class="btn btn--mini" data-done-id="${t.id}">完了</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // 完了ボタン（イベント委任）
  tbody.querySelectorAll("button[data-done-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.getAttribute("data-done-id"));
      await markTaskDone(id);
    });
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function tagPill(tag) {
  return `<span class="pill">${escapeHtml(tag)}</span>`;
}

async function loadTodaySafe() {
  hideNotice();
  setText("last-updated", `Last: ${nowIso()}`);

  try {
    const arr = await fetchJson(API.today);

    // /api/today は「配列そのもの」を返す仕様
    if (!Array.isArray(arr)) throw new Error("APIの形式が想定と違う（配列じゃない）");

    todayTasks = arr;
    renderTodayTable(todayTasks);

    chisaSayFromKey("on_today_loaded");
    setText("footer-msg", "今日のおすすめを更新しました。");
  } catch (e) {
    console.error(e);
    showNotice(`今日の取得に失敗: ${e.message}`, "error");
    chisaSayFromKey("on_error");
  }
}

/* =========================
   6) タスク完了
========================= */
async function markTaskDone(id) {
  if (!Number.isFinite(id)) return;

  try {
    const res = await fetchJson(API.done, {
      method: "POST",
      body: JSON.stringify({ id }),
    });

    if (!res || res.success !== true) throw new Error("完了処理に失敗");

    // 戻りの data は recs（配列）想定
    const recs = res.data;
    if (Array.isArray(recs)) {
      todayTasks = recs;
      renderTodayTable(todayTasks);
    }

    chisaSayFromKey("on_task_done");
    setText("footer-msg", `Task ${id} を完了にしました。`);
  } catch (e) {
    console.error(e);
    showNotice(`完了に失敗: ${e.message}`, "error");
    chisaSayFromKey("on_error");
  }
}

/* =========================
   7) state 表示
========================= */
async function loadState() {
  hideNotice();
  try {
    const res = await fetchJson(API.state);
    if (!res || res.success !== true) throw new Error(res?.error ?? "state取得失敗");

    const s = res.data || {};
    setText("state-date", s.date ?? "--");
    setText("state-physical", s.physical_energy ?? "--");
    setText("state-mental", s.mental_energy ?? "--");
    setText("state-focus", s.focus_level ?? "--");

    setList("state-constraints", s.constraints ?? []);
    setList("state-focus-plan", s.focus_plan ?? []);
    setList("state-tomorrow", s.tomorrow_suggestions ?? []);

    // 左下ミニ表示（超ざっくり）
    const mini = [
      s.physical_energy ? `体調:${s.physical_energy}` : null,
      s.focus_level ? `集中:${s.focus_level}` : null,
    ].filter(Boolean).join(" / ");
    setText("status-mini", mini || "取得OK");

    setText("footer-msg", "state を更新しました。");
  } catch (e) {
    console.error(e);
    showNotice(`state取得に失敗: ${e.message}`, "error");
    chisaSayFromKey("on_error");
  }
}

/* =========================
   8) 日誌インポート
========================= */
function addImportHistoryLine(text) {
  const ul = $("import-history");
  if (!ul) return;

  const li = document.createElement("li");
  li.textContent = `[${nowIso()}] ${text}`;
  ul.prepend(li);
}

async function importStateFile() {
  const input = $("input-state-file");
  if (!input || !input.files || input.files.length === 0) {
    showNotice("ファイルを選んでね。", "warn");
    return;
  }

  const file = input.files[0];
  try {
    const raw = await file.text();
    const parsed = JSON.parse(raw);

    // /api/import_state は dict をそのまま受け取る仕様
    const res = await fetchJson(API.importFile, {
      method: "POST",
      body: JSON.stringify(parsed),
    });

    if (!res || res.success !== true) throw new Error(res?.error ?? "インポート失敗");

    addImportHistoryLine(`ファイルインポート成功（${file.name}）`);
    chisaSayFromKey("on_import_ok");

    // 今日のおすすめも更新（返ってくる）
    if (Array.isArray(res.data)) {
      todayTasks = res.data;
      renderTodayTable(todayTasks);
    }

    setText("footer-msg", "日誌を反映しました。");
  } catch (e) {
    console.error(e);
    addImportHistoryLine(`ファイルインポート失敗（${file.name}）`);
    showNotice(`インポートに失敗: ${e.message}`, "error");
    chisaSayFromKey("on_import_ng");
  }
}

async function importStatePasted() {
  const ta = $("input-state-raw");
  if (!ta) return;

  const raw = (ta.value ?? "").trim();
  if (!raw) {
    showNotice("JSONを貼ってね。", "warn");
    return;
  }

  try {
    // サーバ側でも json.loads するけど、クライアント側でも早めに弾く
    JSON.parse(raw);

    const res = await fetchJson(API.importPasted, {
      method: "POST",
      body: JSON.stringify({ raw }),
    });

    if (!res || res.success !== true) throw new Error(res?.error ?? "インポート失敗");

    addImportHistoryLine("ペーストJSONインポート成功");
    chisaSayFromKey("on_import_ok");

    if (Array.isArray(res.data)) {
      todayTasks = res.data;
      renderTodayTable(todayTasks);
    }

    setText("footer-msg", "日誌を反映しました。");
  } catch (e) {
    console.error(e);
    addImportHistoryLine("ペーストJSONインポート失敗");
    showNotice(`インポートに失敗: ${e.message}`, "error");
    chisaSayFromKey("on_import_ng");
  }
}

/* =========================
   9) 仮ビュー（全タスク/プロジェクト）
========================= */
function renderAllTasksMock() {
  const area = $("all-tasks-area");
  if (!area) return;

  // 今は今日のおすすめをそのまま流用
  if (!todayTasks || todayTasks.length === 0) {
    area.innerHTML = `<div class="muted">表示するタスクがありません。</div>`;
    return;
  }

  area.innerHTML = `
    <ul class="list">
      ${todayTasks.map(t => `<li>#${t.id} ${escapeHtml(t.text ?? "")}</li>`).join("")}
    </ul>
  `;
}

function renderProjectsMock() {
  const area = $("projects-area");
  if (!area) return;

  const map = new Map();
  (todayTasks ?? []).forEach(t => {
    const p = t.project || "default";
    map.set(p, (map.get(p) || 0) + 1);
  });

  if (map.size === 0) {
    area.innerHTML = `<div class="muted">プロジェクト情報がありません。</div>`;
    return;
  }

  const rows = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([p, c]) => `<li><b>${escapeHtml(p)}</b>：${c}件</li>`)
    .join("");

  area.innerHTML = `<ul class="list">${rows}</ul>`;
}

/* =========================
   10) 初期化（イベント登録はここ1か所）
========================= */
document.addEventListener("DOMContentLoaded", () => {
  // 今日の日付
  setText("today-date", `Today: ${nowIso().slice(0, 10)}`);
  setText("last-updated", "Last: --");

  // ボタン
  const btnToday = $("btn-refresh-today");
  if (btnToday) btnToday.addEventListener("click", loadTodaySafe);

  const btnState = $("btn-refresh-state");
  if (btnState) btnState.addEventListener("click", loadState);

  const btnImportFile = $("btn-import");
  if (btnImportFile) btnImportFile.addEventListener("click", importStateFile);

  const btnImportText = $("btn-import-text");
  if (btnImportText) btnImportText.addEventListener("click", importStatePasted);

  // ナビ
  const navToday = $("nav-today");
  if (navToday) navToday.addEventListener("click", () => {
    activateView("view-today", "nav-today", "今日のおすすめ");
    loadTodaySafe();
  });

  const navState = $("nav-state");
  if (navState) navState.addEventListener("click", () => {
    activateView("view-state", "nav-state", "今日のステータス");
    loadState();
  });

  const navImport = $("nav-import");
  if (navImport) navImport.addEventListener("click", () => {
    activateView("view-import", "nav-import", "日誌インポート");
    // ここでは何もしない（操作待ち）
  });

  const navAll = $("nav-all");
  if (navAll) navAll.addEventListener("click", () => {
    activateView("view-all", "nav-all", "全タスク（仮）");
    renderAllTasksMock();
  });

  const navProjects = $("nav-projects");
  if (navProjects) navProjects.addEventListener("click", () => {
    activateView("view-projects", "nav-projects", "プロジェクト（仮）");
    renderProjectsMock();
  });

  // 初回
  activateView("view-today", "nav-today", "今日のおすすめ");
  chisaSayFromKey("on_app_start");
  loadTodaySafe();
});
