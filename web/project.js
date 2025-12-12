// ========================================
// projects.js - プロジェクト進捗表示
// ========================================

/**
 * プロジェクト一覧をロードして表示
 */
async function loadProjects() {
  const container = document.getElementById("project-list");
  if (!container) return;

  // 読み込み中表示
  container.innerHTML = '<div style="text-align:center; padding:20px;">読み込み中...</div>';

  try {
    const response = await fetch("/api/projects");
    const body = await response.json();

    if (!body.success) {
      container.innerHTML = `<div style="color:red">エラー: ${body.error}</div>`;
      return;
    }

    renderProjects(body.data);

  } catch (error) {
    console.error("プロジェクト取得エラー:", error);
    container.innerHTML = `<div style="color:red">通信エラーが発生しました</div>`;
  }
}

/**
 * プロジェクトカードを描画
 */
function renderProjects(projects) {
  const container = document.getElementById("project-list");
  container.innerHTML = "";

  if (!projects || projects.length === 0) {
    container.innerHTML = '<div style="padding:20px;">プロジェクトがありません</div>';
    return;
  }

  // グリッド表示用のコンテナ
  const grid = document.createElement("div");
  grid.className = "vg-grid";

  projects.forEach(p => {
    const card = document.createElement("div");
    card.className = "vg-card";

    // 進捗バーの色（完了したら虹色とかにしてもいいかもね！）
    const barColor = p.progress === 100 ? "var(--cyan)" : "var(--pink-2)";

    card.innerHTML = `
      <div class="vg-card-title">${p.id}</div>
      <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">
        ${p.name}
      </div>
      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px; min-height: 3em;">
        ${p.description || "説明なし"}
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

    grid.appendChild(card);
  });

  container.appendChild(grid);
}