// ========================================
// main.js - 千紗のメイン制御ファイル
// ========================================
// このファイルの役割：
// - アプリ起動時の初期化
// - タブ（画面）の切り替え
// - 日付表示の更新
// ========================================

// 他のJSファイルを読み込む順番（HTMLのscriptタグで）：
// 1. chisa.js
// 2. tasks.js
// 3. state.js
// 4. import.js
// 5. main.js（このファイル）

/**
 * 指定した画面（ビュー）を表示する
 * @param {string} viewId - 表示したい画面のID
 * @param {string} tabId - アクティブにするタブのID
 */
function activateView(viewId, tabId) {
  // すべての画面を非表示にする
  document.querySelectorAll(".vg-view").forEach(v => {
    v.classList.remove("vg-view-active");
  });
  
  // 指定された画面だけ表示
  const view = document.getElementById(viewId);
  if (view) view.classList.add("vg-view-active");

  // すべてのタブの選択マークを消す
  document.querySelectorAll(".vg-tab").forEach(t => {
    t.classList.remove("vg-tab-active");
  });
  
  // 指定されたタブだけ選択中にする
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add("vg-tab-active");
}

/**
 * 画面右上に今日の日付を表示する
 */
function updateTodayDate() {
  const el = document.getElementById("today-date");
  if (!el) return;

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  el.textContent = `今日の日付: ${year}-${month}-${day}`;
}

/**
 * 各タブボタンがクリックされたときの処理を設定
 */
function setupTabButtons() {
  // 今日のおすすめタブ
  const navToday = document.getElementById("nav-today");
  if (navToday) {
    navToday.addEventListener("click", () => {
      activateView("view-today", "nav-today");
      // 初回のみデータ再読み込み
      if (!window.todayTabOpenedOnce) {
        window.todayTabOpenedOnce = true;
        loadTodaySafe();
      }
    });
  }

  // 今日のステータスタブ
  const navState = document.getElementById("nav-state");
  if (navState) {
    navState.addEventListener("click", () => {
      activateView("view-state", "nav-state");
      loadState(); // state.jsの関数
    });
  }

  // 全タスクタブ（未実装）
  const navAll = document.getElementById("nav-all");
  if (navAll) {
    navAll.addEventListener("click", () => {
      activateView("view-all", "nav-all");
    });
  }

  // プロジェクトタブ（未実装）
  const navProjects = document.getElementById("nav-projects");
  if (navProjects) {
    navProjects.addEventListener("click", () => {
      activateView("view-projects", "nav-projects");
      loadProjects();
    });
  }

  // 日誌インポートタブ
  const navImport = document.getElementById("nav-import");
  if (navImport) {
    navImport.addEventListener("click", () => {
      activateView("view-import", "nav-import");
    });
  }

  // 状態更新ボタン
  const refreshBtn = document.getElementById("btn-refresh-state");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadState);
  }

  // 今日のおすすめ更新ボタン
 /* const refreshTodayBtn = document.getElementById("btn-refresh-today");
  if (refreshTodayBtn) {
    refreshTodayBtn.addEventListener("click", loadTodaySafe);
  }*/

  // インポートボタン（import.jsの関数を呼ぶ）
  setupImportButtons();
}

/**
 * アプリ起動時の処理
 */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("========================================");
  console.log("千紗を起動中...");
  console.log("========================================");

  // 1. 千紗のセリフデータを読み込む
  await loadChisaLines();
  
  // 2. 起動時のセリフを表示
  chisaSayFromKey("on_app_start");

  // 3. 今日の日付を表示
  updateTodayDate();

  // 4. タブボタンにイベントを設定
  setupTabButtons();

  // 5. 最初の画面を表示（今日のおすすめ）
  activateView("view-today", "nav-today");
  
  // 6. 最初のデータ読み込み
  await loadTodaySafe();

  // 7. 今日の日誌があるかチェック
  await checkTodayState();
  
  console.log("========================================");
  console.log("千紗の起動完了！");
  console.log("========================================");
});

/**
 * 今日の日誌があるかチェックして、なければ千紗が教える
 */
async function checkTodayState() {
  try {
    const response = await fetch("/api/state");
    const body = await response.json();
    
    if (!body.success) return; // エラーなら何もしない
    
    const state = body.data || {};
    const stateDate = state.date;
    
    // 今日の日付
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    
    // 今日の日誌がない場合
    if (stateDate !== todayStr) {
      const bubble = document.getElementById("chisa-bubble");
      if (bubble) {
        bubble.textContent = "今日の日誌がまだないみたい。千歳に日誌を書いてもらって、インポートしてね。";
        bubble.classList.remove("chisa-bubble-hidden");
        
        // 10秒後に消す
        setTimeout(() => {
          bubble.classList.add("chisa-bubble-hidden");
        }, 10000);
      }
    }
  } catch (error) {
    console.error("日誌チェックエラー:", error);
  }
}