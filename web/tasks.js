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
async function loadTodaySafe() {
  const now = Date.now();
  const timeSinceLastFetch = now - lastTodayFetchTime;
  const cooldownMs = 60000; // 60秒
  
  // 60秒以内なら何もしない
  if (timeSinceLastFetch < cooldownMs) {
    const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastFetch) / 1000);
    console.log(`レート制限対策：あと${remainingSeconds}秒待ってから再取得します`);
    
    // 千紗に教えてもらう
    const bubble = document.getElementById("chisa-bubble");
    if (bubble) {
      bubble.textContent = `ちょっと待ってね。あと${remainingSeconds}秒でデータを取得できるよ。`;
      bubble.classList.remove("chisa-bubble-hidden");
      
      // 3秒後に消す
      setTimeout(() => {
        bubble.classList.add("chisa-bubble-hidden");
      }, 3000);
    }
    
    return;
  }
  
  lastTodayFetchTime = now;
  return loadToday();
}

/**
 * サーバーから今日のおすすめタスクを取得（実際の処理）
 */
async function loadToday() {
  try {
    const response = await fetch("/api/today");
    const data = await response.json();

    // データが配列かチェック
    if (!Array.isArray(data)) {
      console.error("APIエラー: データが配列ではありません", data);
      allTasks = [];
    } else {
      allTasks = data;
      console.log(`タスクを${data.length}件取得しました`);
    }

    // タスクを画面に表示
    renderTasks(allTasks);
    
  } catch (error) {
    console.error("タスク取得エラー:", error);
    allTasks = [];
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

  // タスクが0件なら「タスクなし」と表示
  if (tasks.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="8" style="text-align:center; padding:20px;">タスクがありません</td>';
    tbody.appendChild(tr);
    return;
  }

  // 各タスクを1行ずつ追加
  tasks.forEach(task => {
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

  // 締切の表示文字列を作る
  const dueText = formatDueDate(task.due_date);

  tr.innerHTML = `
    <td>${task.id || "-"}</td>
    <td>
      <div>${task.text || "（タスク名なし）"}</div>
      ${task.reason ? `<div class="reason" style="font-size:11px; opacity:0.8; margin-top:4px;">${task.reason}</div>` : ''}
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
      await loadTodaySafe();
      // 千紗にセリフを喋らせる
      chisaSayFromKey("on_task_complete");
    } else {
      console.error("タスク完了に失敗しました");
    }
  } catch (error) {
    console.error("タスク完了エラー:", error);
  }
}