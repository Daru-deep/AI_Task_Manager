// ========================================
// import.js - 日誌インポート機能
// ========================================
// このファイルの役割：
// - テキストエリアから JSON を読み取る
// - ファイルから JSON を読み取る
// - サーバーにインポート処理を依頼
// ========================================

/**
 * 日誌インポート処理のメイン関数
 * テキスト貼り付けとファイル選択の両方に対応
 */
async function importState() {
  // 結果表示エリアを取得
  const statusElement = document.getElementById("import-result");
  if (statusElement) {
    statusElement.textContent = ""; // 前のメッセージをクリア
    statusElement.style.color = ""; // 色もリセット
  }

  // テキストエリアとファイル入力を取得
  const textArea = document.getElementById("state-text");
  const fileInput = document.getElementById("state-file");

  let jsonData = null;

  // ========================================
  // 方法1: ファイルから読み込み
  // ========================================
  const file = fileInput?.files?.[0];
  if (file) {
    try {
      const fileText = await file.text();
      jsonData = JSON.parse(fileText);
      console.log("ファイルからJSONを読み込みました");
    } catch (error) {
      showImportError("ファイルのJSON形式が正しくありません");
      return;
    }
  }
  // ========================================
  // 方法2: テキストエリアから読み込み
  // ========================================
  else if (textArea) {
    const text = (textArea.value || "").trim();
    
    if (!text) {
      showImportError("ファイルを選ぶか、JSONを貼り付けてください");
      return;
    }

    try {
      jsonData = JSON.parse(text);
      console.log("テキストエリアからJSONを読み込みました");
    } catch (error) {
      showImportError("テキストのJSON形式が正しくありません");
      return;
    }
  }
  // ========================================
  // どちらもない場合
  // ========================================
  else {
    showImportError("入力欄が見つかりません");
    return;
  }

  // ========================================
  // サーバーにインポートを依頼
  // ========================================
  await sendImportToServer(jsonData, statusElement);
}

/**
 * サーバーにインポートデータを送信
 * @param {Object} data - インポートするJSONデータ
 * @param {HTMLElement} statusElement - 結果表示エリア
 */
async function sendImportToServer(data, statusElement) {
  try {
    const response = await fetch("/api/import_state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await response.json().catch(() => ({}));

    // エラーチェック
    if (!response.ok || !result.success) {
      showImportError("インポートに失敗しました");
      return;
    }

    // 成功！
    if (statusElement) {
      statusElement.textContent = "インポート完了！今日のおすすめを更新しました。";
      statusElement.style.color = "#8ed78e"; // 緑色
    }

    console.log("日誌インポート成功");

    // ★ タスクリストを再読み込み（クールダウンチェック付き）
    await loadTodaySafe();

    // ★ state も再取得して表示を更新
    await loadState();

    // 千紗にセリフを喋らせる
    chisaSayFromKey("on_import_success", 4000);

  } catch (error) {
    console.error("インポートエラー:", error);
    showImportError("サーバーとの通信に失敗しました");
  }
}

/**
 * エラーメッセージを表示
 * @param {string} message - エラーメッセージ
 */
function showImportError(message) {
  const statusElement = document.getElementById("import-result");
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.style.color = "#ff6b6b"; // 赤色
  }
  console.error("インポートエラー:", message);
}

/**
 * インポートボタンのイベント設定
 * main.js の初期化時に呼ばれる
 */
function setupImportButtons() {
  // テキスト貼り付けボタン
  const importTextBtn = document.getElementById("btn-import-text");
  if (importTextBtn) {
    importTextBtn.addEventListener("click", importState);
  }

  // ファイル選択ボタン
  const importFileBtn = document.getElementById("btn-import");
  if (importFileBtn) {
    importFileBtn.addEventListener("click", importState);
  }
}
