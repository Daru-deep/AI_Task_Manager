// ========================================
// projects.js - プロジェクト進捗表示 + クリックでタスク一覧
// ========================================

async function loadProjects() {
  const container = document.getElementById("project-list");
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding:20px;">読み込み中...</div>';

  try {
    const response = await fetch("/api/projects");
    const body = await response.json();

    if (!body.success) {
      container.innerHTML = `<div style="color:red">エラー: ${body.error}</div>`;
      return;
    }

    renderProjects(body.data);
    setupProjectTaskPanel();

  } catch (error) {
    console.error("プロジェクト取得エラー:", error);
    container.innerHTML = `<div style="color:red">通信エラーが発生しました</div>`;
  }
}

function setupProjectTaskPanel() {
  const wrap = document.getElementById("project-tasks");
  const btn = document.getElementById("project-tasks-close");
  if (!wrap || !btn) return;

  btn.onclick = () => {
    wrap.style.display = "none";
    const tbody = document.getElementById("project-task-body");
    if (tbody) tbody.innerHTML = "";
  };
}

/** 100%のプロジェクトは表示から除外して、カードクリックでタスク一覧 */
function renderProjects(projects) {
  const container = document.getElementById("project-list");
  container.innerHTML = "";

  if (!projects || projects.length === 0) {
    container.innerHTML = '<div style="padding:20px;">プロジェクトがありません</div>';
    return;
  }

  // ★ 100%はフィルター（非表示）
  const visible = projects.filter(p => (p.progress ?? 0) < 100);

  if (visible.length === 0) {
    container.innerHTML = '<div style="padding:20px;">進行中のプロジェクトはありません（全部100%）</div>';
    return;
  }

  const grid = document.createElement("div");
  grid.className = "vg-grid";

  visible.forEach(p => {
    const card = document.createElement("div");
    card.className = "vg-card";
    card.style.cursor = "pointer";

    const barColor = "var(--pink-2)";

    card.innerHTML = `
      <div class="vg-card-title">${escapeHtml(p.id)}</div>
      <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">
        ${escapeHtml(p.name)}
      </div>
      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px; min-height: 3em;">
        ${escapeHtml(p.description || "説明なし")}
      </div>

      <div class="vg-progress-wrap">
        <div class="vg-progress-bar" style="width: ${p.progress}%; background: ${barColor};"></div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top: 8px;">
        <div style="font-size: 24px; font-weight: 900; color: var(--pink-1);">
          ${p.progress}%
        </div>
        <div style="font-size: 12px; color: var(--text-muted);">
          ${p.done} / ${p.total} tasks
        </div>
      </div>
    `;
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
    // projectKey はまず p.id。もし tasks の project が p.name なら両対応するのでOK
    showProjectTasksModal(p.id, p.name);
  });

    // ★ クリックでタスク一覧へ
    card.addEventListener("click", () => {
      showProjectTasks(p.id, p.name);
    }
    
  
  );

    grid.appendChild(card);
  });

  container.appendChild(grid);
}

/** ここが本体：プロジェクトIDでタスクを絞って表示 */
async function showProjectTasks(projectId, projectName) {
  const wrap = document.getElementById("project-tasks");
  const title = document.getElementById("project-tasks-title");
  const sub = document.getElementById("project-tasks-sub");
  const tbody = document.getElementById("project-task-body");
  if (!wrap || !title || !sub || !tbody) return;

  wrap.style.display = "block";
  title.textContent = `${projectId}`;
  sub.textContent = `${projectName} の未完了タスク`;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:14px;">読み込み中...</td></tr>`;

  try {
    // ★ あなたの環境では /api/tasks が 200 で返ってる（ログに出てた）
    const res = await fetch("/api/tasks", { cache: "no-store" });
    const body = await res.json();

    // 返り値が「配列」パターンと「{success,data}」パターン両対応
    const tasks = Array.isArray(body) ? body : (body.data || []);
    const filtered = tasks
      .filter(t => (t.project || "") === projectId)
      .filter(t => (t.status || "todo") !== "done");

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:14px;">未完了タスクはありません</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    filtered.forEach(t => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(t.id ?? "-")}</td>
        <td>${escapeHtml(t.text || "（タスク名なし）")}</td>
        <td>${escapeHtml(formatDueDate(t.due_date))}</td>
        <td>${escapeHtml(t.score ?? "-")}</td>
        <td>${escapeHtml(t.reason || "-")}</td>
        <td>${escapeHtml(t.status || "todo")}</td>
        <td>
          <button class="complete-btn" data-id="${t.id}">完了</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // 完了ボタン（tasks.jsの completeTask があるならそれを使う）
    tbody.querySelectorAll("button[data-id]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        if (typeof completeTask === "function") {
          await completeTask(id);
          // 完了したら再描画
          await showProjectTasks(projectId, projectName);
        } else {
          console.warn("completeTask が見つからない：tasks.js の関数名を確認してね");
        }
      });
    });

    // 見える位置へ
    wrap.scrollIntoView({ behavior: "smooth", block: "start" });

  } catch (err) {
    console.error("プロジェクト内タスク取得エラー:", err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:14px; color:red;">取得に失敗しました</td></tr>`;
  }
}

// projects.js 側にも最低限の util を持たせる（tasks.js 依存を減らす）
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDueDate(dueDate) {
  if (!dueDate) return "-";
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return String(dueDate);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = due - today;
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

  let label;
  if (daysLeft > 0) label = `残り${daysLeft}日`;
  else if (daysLeft === 0) label = "今日が締切";
  else label = `締切から${Math.abs(daysLeft)}日経過`;

  return `${dueDate}（${label}）`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openProjectModal() {
  const modal = document.getElementById("project-modal");
  const close = document.getElementById("project-modal-close");
  if (!modal || !close) return;

  modal.style.display = "block";
  close.onclick = () => (modal.style.display = "none");
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };
}

async function showProjectTasksModal(projectKey, projectName) {
  openProjectModal();

  document.getElementById("project-modal-id").textContent = projectKey ?? "";
  document.getElementById("project-modal-name").textContent = projectName ?? "";
  document.getElementById("project-modal-sub").textContent = "未完了タスク";

  const tbody = document.getElementById("project-modal-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:14px;">読み込み中...</td></tr>`;

  try {
    const res = await fetch("/api/tasks", { cache: "no-store" });
    const json = await res.json();

    // ★ ここが重要：APIの返り値が tasks / data / 配列 のどれでも拾う
    const tasks = Array.isArray(json) ? json : (json.tasks || json.data || []);
    // ★ project照合：まず projectKey、それで0件なら projectName でも試す
    let filtered = tasks
      .filter(t => (t.status || "todo") !== "done")
      .filter(t => (t.project || "") === projectKey);

    if (filtered.length === 0 && projectName) {
      filtered = tasks
        .filter(t => (t.status || "todo") !== "done")
        .filter(t => (t.project || "") === projectName);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:14px;">未完了タスクはありません</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    for (const t of filtered) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(t.id ?? "-")}</td>
        <td>${escapeHtml(t.text ?? "")}</td>
        <td>${escapeHtml(t.due_date ?? "-")}</td>
        <td>${escapeHtml(t.score ?? "-")}</td>
        <td>${escapeHtml(t.reason ?? "-")}</td>
        <td>${escapeHtml(t.status ?? "todo")}</td>
        <td><button class="complete-btn" data-id="${t.id}">完了</button></td>
      `;
      tbody.appendChild(tr);
    }

    // 完了ボタン：tasks.js の completeTask を使う（window に載ってる前提）
    tbody.querySelectorAll("button[data-id]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        if (typeof window.completeTask === "function") {
          await window.completeTask(id);
          await showProjectTasksModal(projectKey, projectName); // 再読込
        } else {
          console.warn("completeTask が window に存在しない。tasks.jsで window.completeTask = completeTask を追加してね。");
        }
      });
    });

  } catch (e) {
    console.error(e);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:14px; color:red;">取得に失敗しました</td></tr>`;
  }
}
