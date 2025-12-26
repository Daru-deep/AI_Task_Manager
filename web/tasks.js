// ========================================
// tasks.js - タスクの表示と操作
// ========================================
// このファイルの役割：
// - 今日のおすすめタスクを取得
// - タスクをテーブルに表示
// - タスクを完了にする
// ========================================

// 全タスクデータを保存しておく変数
let allTasks = [];

// レート制限対策：前回の取得時刻を記録
let lastTodayFetchTime = 0;

// tasks.js の loadTodaySafe() を修正
// web/tasks.js
async function loadTodaySafe(force = false) {
  const now = Date.now();
  const timeSinceLastFetch = now - lastTodayFetchTime;
  const cooldownMs = 60000;

  if (!force && timeSinceLastFetch < cooldownMs) {
    // クールダウン中は何もしない
    return [];
  }

  lastTodayFetchTime = now;
  await loadToday();
  return allTasks;
}


// web/tasks.js
async function loadToday() {
  try {
    const response = await fetch("/api/today", { cache: "no-store" });

    // 失敗時：X-Error-Code を拾ってログ、配列互換のまま空で描画して終了
    if (!response.ok) {
      const code = response.headers.get("X-Error-Code");
      if (code) console.warn("X-Error-Code:", code);

      allTasks = [];
      renderTasks(allTasks);
      return;
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      console.error("APIエラー: データが配列ではありません", data);
      allTasks = [];
    } else {
      allTasks = data;
      console.log(`タスクを${data.length}件取得しました`);
    }

    renderTasks(allTasks);

  } catch (error) {
    console.error("タスク取得エラー:", error);
    allTasks = [];
    renderTasks(allTasks);
  }
}


/**
 * タスクをテーブルに表示する
 * @param {Array} tasks - 表示するタスクの配列
 */
function renderTasks(tasks) {
  const tbody = document.getElementById("task-body");
  if (!tbody) {
    console.error("タスク表示エリア（#task-body）が見つかりません");
    return;
  }

  // テーブルを空にする
  tbody.innerHTML = "";
const displayLimit = 5;
  // ===== 上位5件に制限 =====
  const displayTasks = tasks.slice(0, 5);

  // 全件数が5件超えている場合は情報を表示
  if (tasks.length > 5) {
    const infoRow = document.createElement("tr");
    infoRow.innerHTML = `
      <td colspan="8" style="text-align:center; background:rgba(255,105,180,0.15); padding:10px; font-size:12px; color:#ffccff;">
        💫 全${tasks.length}件中、上位5件を表示しています
      </td>
    `;
    tbody.appendChild(infoRow);
  }
  // =======================

  // タスクが0件なら「タスクなし」と表示
  if (displayTasks.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="8" style="text-align:center; padding:20px;">タスクがありません</td>';
    tbody.appendChild(tr);
    return;
  }

  // 各タスクを1行ずつ追加（3件まで）
  displayTasks.forEach(task => {
    const row = createTaskRow(task);
    tbody.appendChild(row);
  });

  // 完了ボタンにイベントを設定
  setupCompleteButtons(tbody);
}

/**
 * タスク1件分の行（tr要素）を作る
 * @param {Object} task - タスクのデータ
 * @returns {HTMLElement} 作成した行要素
 */

function createTaskRow(task) {
  const tr = document.createElement("tr");

  const dueText = formatDueDate(task.due_date);

  tr.innerHTML = `
    <td>${task.id || "-"}</td>
    <td>
      <div>${task.text || "（タスク名なし）"}</div>
    </td>
    <td>${task.project || "-"}</td>
    <td>${dueText}</td>
    <td>${task.score ?? "-"}</td>
    <td>${task.reason || "-"}</td>
    <td>${task.status || "todo"}</td>
    <td><button class="complete-btn" data-id="${task.id}">完了</button></td>
  `;

  return tr;
}


/**
 * 締切日付をわかりやすい文字列に変換
 * @param {string} dueDate - 締切日（YYYY-MM-DD形式）
 * @returns {string} 表示用の文字列
 */
function formatDueDate(dueDate) {
  if (!dueDate) return "-";

  // 日付オブジェクトに変換
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) {
    return dueDate; // パースできなければそのまま返す
  }

  // 今日の日付（時刻は0:00にする）
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 締切までの日数を計算
  const diffMs = due - today;
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // 日数に応じたラベルを付ける
  let label;
  if (daysLeft > 0) {
    label = `残り${daysLeft}日`;
  } else if (daysLeft === 0) {
    label = "今日が締切";
  } else {
    label = `締切から${Math.abs(daysLeft)}日経過`;
  }

  return `${dueDate}（${label}）`;
}

/**
 * 完了ボタンにクリックイベントを設定
 * @param {HTMLElement} tbody - テーブルのbody要素
 */
function setupCompleteButtons(tbody) {
  const buttons = tbody.querySelectorAll("button[data-id]");

  buttons.forEach(button => {
    button.addEventListener("click", async (event) => {
      const taskId = event.target.dataset.id;
      await completeTask(taskId);
    });
  });
}

/**
 * タスクを完了状態にする
 * @param {string|number} taskId - タスクのID
 */
async function completeTask(taskId) {
  try {
    const response = await fetch("/api/tasks/done", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: parseInt(taskId) })
    });

    if (response.ok) {
      console.log(`タスク${taskId}を完了にしました`);
      // タスクリストを再読み込み
      await loadTodaySafe(true);
      // 千紗にセリフを喋らせる
      chisaSayFromKey("on_task_complete");
    } else {
      console.error("タスク完了に失敗しました");
    }
  } catch (error) {
    console.error("タスク完了エラー:", error);
  }
}

async function loadAllTodo(force = false) {
  // いったん /api/tasks で全部取って、todoだけに絞る（B）
  const res = await fetch("/api/tasks");
  const json = await res.json();
  if (!json.success) return;

  const tasks = json.tasks || [];
  const todo = tasks.filter(t => t.status !== "done");

  // ① options更新（未完了に存在するprojectだけ出す）
  updateAllProjectFilterOptions(todo);

  // ② 選択中projectで絞って描画
  const filtered = filterAllTodoByProject(todo);
  renderAllTodo(filtered);

}

function renderAllTodo(tasks) {
  const tbody = document.getElementById("all-task-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  for (const t of tasks) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${t.id}</td>
      <td>${escapeHtml(t.text ?? t.title ?? "")}</td>
      <td>${escapeHtml(t.project ?? "")}</td>
      <td>${escapeHtml(t.due_date ?? "")}</td>
      <td>${t.score ?? ""}</td>
      <td>${escapeHtml(t.status ?? "")}</td>
      <td><button class="vg-btn" data-done-id="${t.id}">完了</button></td>
    `;

    tbody.appendChild(tr);
  }

  // 完了ボタン（未完了だけだから「完了」固定でOK）
  tbody.querySelectorAll("[data-done-id]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.getAttribute("data-done-id"));
      await completeTask(id);
      await loadAllTodo(true);
    });
  });
}

// 既にあるなら不要（無ければ追加）
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


document.addEventListener("DOMContentLoaded", async () => {
  const projectSel = document.getElementById("all-project-filter");
if (projectSel) {
  projectSel.addEventListener("change", () => loadAllTodo(true));
}

  const navAll = document.getElementById("nav-all");
  if (navAll) {
    navAll.addEventListener("click", () => loadAllTodo(true));
  }

  await loadTodaySafe(true);
  await loadAllTodo(true);
});


function updateAllProjectFilterOptions(tasks) {
  const sel = document.getElementById("all-project-filter");
  if (!sel) return;

  const current = sel.value;

  const projects = Array.from(
    new Set(tasks.map(t => (t.project ?? "").trim()).filter(p => p.length > 0))
  ).sort((a, b) => a.localeCompare(b, "ja"));

  // 先頭の「すべて」以外を作り直す
  sel.innerHTML = `<option value="">すべて</option>` + projects
    .map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`)
    .join("");

  // 可能なら選択状態を維持
  sel.value = projects.includes(current) ? current : "";
}


function filterAllTodoByProject(tasks) {
  const sel = document.getElementById("all-project-filter");
  const selected = (sel?.value ?? "").trim();
  if (!selected) return tasks;
  return tasks.filter(t => (t.project ?? "").trim() === selected);
}
