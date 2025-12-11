 // 今日の日付をセットする関数
function updateTodaySummary() {
  const el = document.getElementById("today-date");
  if (!el) return;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  el.textContent = `今日の日付: ${yyyy}-${mm}-${dd}`;
}


// /api/today の結果を保持して、フィルタで使う
let allTasks = [];

// 今日のおすすめをサーバから取得して state を更新
async function loadToday() {
  const res = await fetch("/api/today");
  const body = await res.json();

  // /api/today は「配列そのもの」を返す前提
  if (!Array.isArray(body)) {
    console.error("APIエラー or data が配列じゃない:", body);
    allTasks = [];
  } else {
    allTasks = body;
  }

  populateProjectFilter();
  applyFilterAndRender();
}

// プロジェクト一覧から <select> の選択肢を作る
function populateProjectFilter() {
  const select = document.getElementById("project-filter");
  if (!select) return; // セレクト自体が無いなら何もしない

  const currentValue = select.value; // 今選ばれている値を一応保存

  const projectSet = new Set();
  for (const t of allTasks) {
    if (t.project) {
      projectSet.add(t.project);
    }
  }

  // 一旦クリア
  select.innerHTML = "";

  // 「すべて」オプション
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "すべて";
  select.appendChild(optAll);

  // 各プロジェクト
  for (const p of projectSet) {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    select.appendChild(opt);
  }

  // もし以前の選択肢がまだ存在するなら復元
  if (
    currentValue &&
    Array.from(select.options).some((o) => o.value === currentValue)
  ) {
    select.value = currentValue;
  }
}

// 現在のフィルタ条件に基づいて描画する
function applyFilterAndRender() {
  let tasks = allTasks;

  const select = document.getElementById("project-filter");
  if (select && select.value) {
    const selected = select.value;
    tasks = allTasks.filter((t) => t.project === selected);
  }

  renderTasks(tasks);
}

// 実際にテーブルへ描画する
function renderTasks(tasks) {
  const tbody = document.getElementById("task-body");
  if (!tbody) {
    console.error("#task-body が見つかりません。index.html の <tbody id=\"task-body\"> を確認してね。");
    return;
  }

  tbody.innerHTML = "";

  for (const t of tasks) {
    const tr = document.createElement("tr");

    // 締切表示
    // 締切表示（days_left はフロントで毎回計算し直す）
const due = t.due_date ?? "";
let days = null;

if (due) {
  // due は "YYYY-MM-DD" 形式を想定
  const dueDate = new Date(due);
  if (!Number.isNaN(dueDate.getTime())) {
    // 今日の日付（時刻は0:00に揃える）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 差分（日単位）
    const diffMs = dueDate - today;
    days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  }
}

let dueText = "";
if (due) {
  if (typeof days === "number") {
    let label;
    if (days > 0) {
      label = `残り${days}日`;
    } else if (days === 0) {
      label = "今日が締切";
    } else {
      label = `締切から${Math.abs(days)}日経過`;
    }
    dueText = `${due}（${label}）`;
  } else {
    // パースできなかったときはそのまま表示
    dueText = due;
  }
}


    tr.innerHTML = `
      <td>
        ${t.text}
        <div class="reason">${t.reason || ""}</div>
      </td>
      <td>${t.project || ""}</td>
      <td>${dueText}</td>
      <td>${t.score ?? ""}</td>
      <td><button data-id="${t.id}">完了</button></td>
    `;
    tbody.appendChild(tr);
  }

  // 「完了」ボタンのイベント付け替え
  tbody.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      await fetch("/api/tasks/done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await loadToday(); // 完了後に再読み込み（フィルタも維持される）
    });
  });
}

// 日誌インポート（ファイル or テキスト）
async function importState() {
  // const status = document.getElementById("import-state-status");
  const status = document.getElementById("import-result");  // ← HTMLに合わせる
  if (status) status.textContent = "";

  const fileInput = document.getElementById("state-file");
  // const textArea = document.getElementById("state-json-input");
  const textArea = document.getElementById("state-text");   // ← HTMLに合わせる

  let data = null;

const file =
    fileInput && fileInput.files && fileInput.files.length > 0
      ? fileInput.files[0]
      : null;

  if (file) {
    try {
      const text = await file.text();
      data = JSON.parse(text);
    } catch (e) {
      if (status) status.textContent = "ファイルのJSON形式がおかしいです。";
      return;
    }
  } else if (textArea) {

    const raw = (textArea.value || "").trim();
    if (!raw) {
      if (status) status.textContent = "ファイルを選ぶか、JSONを貼り付けてください。";
      return;
    }
    try {
      data = JSON.parse(raw);
    } catch (e) {
      if (status) status.textContent = "テキストのJSON形式がおかしいです。";
      return;
    }
  } else {
    if (status) status.textContent = "入力欄が見つかりません。";
    return;
  }

  const res = await fetch("/api/import_state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    if (status) status.textContent = "インポートに失敗しました。";
    return;
  }

  if (status) status.textContent = "インポート完了。今日のおすすめを更新しました。";
  await loadToday();
}


// DOM が出来てからイベント登録する
document.addEventListener("DOMContentLoaded", () => {
  // 「今日のおすすめ再計算」ボタン
  const reloadBtn = document.getElementById("btn-refresh-today");
  if (reloadBtn) {
    reloadBtn.addEventListener("click", loadToday);
  }

  // 日誌インポート（ペーストボタン）
  const importTextBtn = document.getElementById("btn-import-text");
  if (importTextBtn) {
    importTextBtn.addEventListener("click", importState);
  }

  // 日誌インポート（ファイルボタン）
  const importFileBtn = document.getElementById("btn-import");
  if (importFileBtn) {
    importFileBtn.addEventListener("click", importState);
  }

  // プロジェクトフィルタは、今のHTMLには無いのであってもなくてもOK
  const projectSelect = document.getElementById("project-filter");
  if (projectSelect) {
    projectSelect.addEventListener("change", applyFilterAndRender);
  }

  // 初回表示
  updateTodaySummary();
  // 初回読み込み
  loadToday();
});


// --- 画面切り替えナビ（枠だけ） ---

function activateView(viewId, tabId) {
  document.querySelectorAll(".vg-view").forEach(v => {
    v.classList.remove("vg-view-active");
  });
  const view = document.getElementById(viewId);
  if (view) view.classList.add("vg-view-active");

  document.querySelectorAll(".vg-tab").forEach(t => {
    t.classList.remove("vg-tab-active");
  });
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add("vg-tab-active");
}

document.addEventListener("DOMContentLoaded", () => {
  // ここは今まで通り
  if (typeof loadToday === "function") {
    loadToday();
  }

  const navToday = document.getElementById("nav-today");
  const navAll = document.getElementById("nav-all");
  const navProjects = document.getElementById("nav-projects");
  const navImport = document.getElementById("nav-import");

  if (navToday) {
    navToday.addEventListener("click", () => {
      activateView("view-today", "nav-today");
      if (typeof loadToday === "function") loadToday();
    });
  }
  if (navAll) {
    navAll.addEventListener("click", () => {
      activateView("view-all", "nav-all");
    });
  }
  if (navProjects) {
    navProjects.addEventListener("click", () => {
      activateView("view-projects", "nav-projects");
    });
  }
  if (navImport) {
    navImport.addEventListener("click", () => {
      activateView("view-import", "nav-import");
    });
  }
});

