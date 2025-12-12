// ========================================
// chisa.js - 千紗のセリフ表示
// ========================================
// このファイルの役割：
// - 千紗のセリフデータを読み込む
// - 画面に吹き出しを表示する
// ========================================

// 千紗のセリフデータを保存する変数
let chisaLines = {};

/**
 * chisa_lines.json からセリフデータを読み込む
 * これは起動時に1回だけ実行される
 */
async function loadChisaLines() {
  try {
    const response = await fetch("/web/chisa_lines.json");
    chisaLines = await response.json();
    console.log("千紗のセリフデータを読み込みました");
  } catch (error) {
    console.warn("千紗のセリフデータが読み込めませんでした:", error);
    chisaLines = {}; // 空のオブジェクトにしておく
  }
}

/**
 * 千紗にセリフを喋らせる
 * @param {string} key - セリフの種類（例: "on_app_start", "on_task_complete"）
 * @param {number} displayTime - 表示時間（ミリ秒）デフォルトは3200ms
 */
function chisaSayFromKey(key, displayTime = 3200) {
  // 吹き出し要素を取得
  const bubble = document.getElementById("chisa-bubble");
  if (!bubble) {
    console.warn("千紗の吹き出し要素が見つかりません");
    return;
  }

  // 指定されたキーのセリフを取得
  const lines = chisaLines[key];
  
  // セリフが配列で、中身があるか確認
  if (!Array.isArray(lines) || lines.length === 0) {
    console.log(`セリフが見つかりません: ${key}`);
    return;
  }

  // セリフをランダムに1つ選ぶ
  const randomIndex = Math.floor(Math.random() * lines.length);
  const text = lines[randomIndex];

  // 吹き出しにテキストを表示
  bubble.textContent = text;
  bubble.classList.remove("chisa-bubble-hidden");

  // 前のタイマーがあればクリア
  if (chisaSayFromKey.timer) {
    clearTimeout(chisaSayFromKey.timer);
  }

  // 指定時間後に吹き出しを消す
  chisaSayFromKey.timer = setTimeout(() => {
    bubble.classList.add("chisa-bubble-hidden");
  }, displayTime);
}