// ========================================
// state.js - 今日の状態表示
// ========================================
// このファイルの役割：
// - サーバーから state.json を取得
// - 体調・メンタル・集中力を表示
// - 制約条件・今日の目標を表示
// ========================================

/**
 * サーバーから state.json を取得して表示
 */
async function loadState() {
  try {
    const response = await fetch("/api/state");
    const body = await response.json();

    // エラーチェック
    if (!body.success) {
      showStateError(body.error || "不明なエラー");
      return;
    }

    // state データを画面に表示
    displayState(body.data || {});
    
  } catch (error) {
    console.error("状態取得エラー:", error);
    showStateError("サーバーとの通信に失敗しました");
  }
}

/**
 * エラーメッセージを表示
 * @param {string} errorMessage - エラーメッセージ
 */
function showStateError(errorMessage) {
  setText("st-physical", "取得失敗");
  setText("st-mental", "");
  setText("st-focus", "");
  setList("st-constraints", [errorMessage]);
  setList("st-goals", []);
}

/**
 * state データを画面に表示
 * @param {Object} state - state.json のデータ
 */
function displayState(state) {
  // state から必要なデータを取り出す
  const view = extractStateView(state);

  // 体調・メンタル・集中力を表示
  setText("st-physical", formatScore(view.physical));
  setText("st-mental", formatScore(view.mental));
  setText("st-focus", formatScore(view.focusLevel));

  // 補足説明を表示
  setText("st-physical-note", view.physicalNote || "");
  setText("st-mental-note", view.mentalNote || "");
  setText("st-focus-note", view.focusNote || "");

  // 制約条件と目標をリスト表示
  setList("st-constraints", view.constraintsList);
  setList("st-goals", view.goalsList);

  // 最終インポート日時を表示
  const lastImported = state?.last_imported_at;
  if (lastImported) {
    const importedDate = new Date(lastImported);
    const formatted = formatDateTime(importedDate);
    setText("st-updated-at", `${view.updatedAt || "-"}（最終インポート: ${formatted}）`);
  } else {
    setText("st-updated-at", view.updatedAt || "-");
  }

  // 最終更新日時を表示
  setText("st-updated-at", view.updatedAt || "-");

  // デバッグ用：生のJSONを表示
  const raw = document.getElementById("state-raw");
  if (raw) raw.textContent = JSON.stringify(state, null, 2);
}

/**
 * 日時を見やすい形式に変換
 * @param {Date} date - 日時オブジェクト
 * @returns {string} 表示用の文字列
 */
function formatDateTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 1) return "たった今";
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}時間前`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}日前`;
  
  // 7日以上前なら具体的な日時
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  
  return `${year}-${month}-${day} ${hour}:${minute}`;
}


/**
 * state データから表示用の情報を取り出す
 * （プロジェクトによってJSONの構造が違うことがあるので、柔軟に対応）
 * @param {Object} state - state.json のデータ
 * @returns {Object} 表示用のデータ
 */
function extractStateView(state) {
  const meta = state?.meta ?? {};
  const constraints = state?.constraints ?? {};
  const focus = state?.focus_plan ?? {};

  // 体調・メンタル・集中力（色々な名前のキーに対応）
  const physical = meta.physical_energy ?? meta.physical ?? meta.body ?? meta.health ?? null;
  const mental = meta.mental_energy ?? meta.mental ?? meta.mood ?? null;
  const focusLevel = meta.focus_level ?? meta.focus ?? meta.concentration ?? null;

  // 補足説明
  const physicalNote = meta.physical_note ?? meta.health_note ?? "";
  const mentalNote = meta.mental_note ?? meta.mood_note ?? "";
  const focusNote = meta.focus_note ?? "";

  // 制約条件をリストに変換
  const constraintsList = [];
  for (const [key, value] of Object.entries(constraints)) {
    if (typeof value === "boolean") {
      constraintsList.push(`${key}: ${value ? "OK" : "NG"}`);
    } else if (value != null && value !== "") {
      constraintsList.push(`${key}: ${value}`);
    }
  }

  // 今日の目標をリストに変換
  const goalsList = [];
  for (const [key, value] of Object.entries(focus)) {
    if (Array.isArray(value)) {
      value.forEach(item => goalsList.push(`${key}: ${item}`));
    } else if (value != null && value !== "") {
      goalsList.push(`${key}: ${value}`);
    }
  }

  // 更新日時
  const updatedAt = state?.date ?? meta?.date ?? meta?.updated_at ?? "";

  return {
    physical,
    mental,
    focusLevel,
    physicalNote,
    mentalNote,
    focusNote,
    constraintsList,
    goalsList,
    updatedAt
  };
}

/**
 * スコアを見やすい形式に変換
 * @param {any} value - スコアの値
 * @returns {string} 表示用の文字列
 */
function formatScore(value) {
  if (value == null || value === "") return "-";
  
  // 数値なら「X/10」形式で表示
  const num = Number(value);
  if (!isNaN(num)) {
    return `${num}/10`;
  }
  
  // 数値じゃなければそのまま表示
  return value.toString();
}

/**
 * 指定したIDの要素にテキストを設定
 * @param {string} id - 要素のID
 * @param {string} text - 設定するテキスト
 */
function setText(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = (text ?? "").toString();
  }
}

/**
 * 指定したIDのリスト要素（ul）にアイテムを追加
 * @param {string} id - ul要素のID
 * @param {Array} items - リストアイテムの配列
 */
function setList(id, items) {
  const ul = document.getElementById(id);
  if (!ul) return;

  // リストを空にする
  ul.innerHTML = "";

  if (!items) return;

  // 配列でなければ配列にする
  const array = Array.isArray(items) ? items : [items];
  
  // 各アイテムを li 要素として追加
  array.filter(Boolean).forEach(item => {
    const li = document.createElement("li");
    li.textContent = item.toString();
    ul.appendChild(li);
  });
}