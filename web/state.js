// ========================================
// state.js - 今日のステータス（表示 + 編集）
// ========================================

/**
 * サーバーから state を取得してフォームに反映する
 */
async function loadState() {
  try {
    const res  = await fetch("/api/state");
    const body = await res.json();

    // X-Error-Code が E_STATE_EMPTY なら「未登録」扱い
    const errCode = res.headers?.get?.("X-Error-Code");
    if (errCode === "E_STATE_EMPTY" || !body.success) {
      _fillFormDefaults();
      _setUpdatedAt("未登録");
      return;
    }

    const state = body.data || {};
    _fillFormFromState(state);

    // デバッグ用
    const raw = document.getElementById("state-raw");
    if (raw) raw.textContent = JSON.stringify(state, null, 2);

  } catch (err) {
    console.error("state 取得エラー:", err);
    _setUpdatedAt("取得失敗");
  }
}

// ── フォームにデータを流し込む ──────────────────────

function _fillFormFromState(s) {
  const meta        = s?.meta        ?? {};
  const constraints = s?.constraints ?? {};
  const focus_plan  = s?.focus_plan  ?? {};

  _setDate(s?.date);
  _setSelect("si-physical", s?.physical_energy ?? "medium");
  _setSelect("si-mental",   s?.mental_energy   ?? "medium");
  _setSelect("si-creative", s?.creative_drive  ?? "medium");
  _setSelect("si-money",    s?.money_pressure_creative ?? "low");

  _setRange("si-focus",  "si-focus-val",  meta?.focus_level  ?? 3);
  _setRange("si-health", "si-health-val", meta?.health_score ?? 3);

  _setCheck("si-desk",    s?.can_sit_at_desk ?? true);
  _setCheck("si-outside", s?.can_go_outside  ?? constraints?.can_go_out ?? true);

  _setText("si-prefer", (focus_plan?.prefer_axes ?? []).join(", "));
  _setText("si-avoid",  (focus_plan?.avoid_axes  ?? []).join(", "));
  _setText("si-note",   s?.free_note ?? "");

  // 最終更新
  const last = s?.last_imported_at;
  _setUpdatedAt(last ? `最終保存: ${_formatAgo(new Date(last))}` : "");
}

function _fillFormDefaults() {
  _setDate(null);
  _setSelect("si-physical", "medium");
  _setSelect("si-mental",   "medium");
  _setSelect("si-creative", "medium");
  _setSelect("si-money",    "low");
  _setRange("si-focus",  "si-focus-val",  3);
  _setRange("si-health", "si-health-val", 3);
  _setCheck("si-desk",    true);
  _setCheck("si-outside", true);
  _setText("si-prefer", "");
  _setText("si-avoid",  "");
  _setText("si-note",   "");
}

// ── 保存処理 ────────────────────────────────────────

async function saveState() {
  const resultEl = document.getElementById("st-save-result");

  const date    = document.getElementById("si-date")?.value;
  if (!date) {
    _showResult(resultEl, "日付を入力してください", false);
    return;
  }

  const splitAxes = id =>
    (document.getElementById(id)?.value ?? "")
      .split(",").map(s => s.trim()).filter(Boolean);

  const stateData = {
    date,
    physical_energy:         document.getElementById("si-physical")?.value ?? "medium",
    mental_energy:           document.getElementById("si-mental")?.value   ?? "medium",
    can_sit_at_desk:         document.getElementById("si-desk")?.checked   ?? true,
    can_go_outside:          document.getElementById("si-outside")?.checked ?? true,
    creative_drive:          document.getElementById("si-creative")?.value ?? "medium",
    money_pressure_creative: document.getElementById("si-money")?.value    ?? "low",
    study_deadline_days:     999,
    meta: {
      focus_level:  Number(document.getElementById("si-focus")?.value  ?? 3),
      health_score: Number(document.getElementById("si-health")?.value ?? 3),
      mood_summary: (document.getElementById("si-note")?.value ?? "").slice(0, 80) || "手動入力",
    },
    constraints: {
      can_go_out: document.getElementById("si-outside")?.checked ?? true,
    },
    focus_plan: {
      prefer_axes: splitAxes("si-prefer"),
      avoid_axes:  splitAxes("si-avoid"),
    },
    free_note: document.getElementById("si-note")?.value ?? "",
    new_tasks: [],
  };

  try {
    const res    = await fetch("/api/import_state", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(stateData),
    });
    const result = await res.json().catch(() => ({}));

    if (!res.ok || !result.success) {
      _showResult(resultEl, "保存に失敗しました", false);
      return;
    }

    _showResult(resultEl, "保存しました！", true);
    _setUpdatedAt(`最終保存: たった今`);

    // タスクリストを更新
    await loadTodaySafe(true);
    chisaSayFromKey?.("on_import_success", 3000);

  } catch (err) {
    console.error("state 保存エラー:", err);
    _showResult(resultEl, "サーバーとの通信に失敗しました", false);
  }
}

// ── イベント設定 ─────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // 保存ボタン
  document.getElementById("btn-save-state")
    ?.addEventListener("click", saveState);

  // 再読み込みボタン
  document.getElementById("btn-refresh-state")
    ?.addEventListener("click", loadState);

  // スライダーのリアルタイム表示
  document.getElementById("si-focus")
    ?.addEventListener("input", e => _setRangeLabel("si-focus-val", e.target.value));
  document.getElementById("si-health")
    ?.addEventListener("input", e => _setRangeLabel("si-health-val", e.target.value));
});

// ── ヘルパー ─────────────────────────────────────────

function _setDate(dateStr) {
  const el = document.getElementById("si-date");
  if (!el) return;
  if (dateStr) {
    el.value = dateStr;
  } else {
    const t = new Date();
    el.value = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
  }
}

function _setSelect(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function _setRange(id, labelId, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
  _setRangeLabel(labelId, val);
}

function _setRangeLabel(labelId, val) {
  const el = document.getElementById(labelId);
  if (el) el.textContent = val;
}

function _setCheck(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = !!val;
}

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? "";
}

function _setUpdatedAt(text) {
  const el = document.getElementById("st-updated-at");
  if (el) el.textContent = text;
}

function _showResult(el, msg, ok) {
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? "#8ed78e" : "#ff6b6b";
  if (ok) setTimeout(() => { el.textContent = ""; }, 3000);
}

function _formatAgo(date) {
  const diff = Math.floor((Date.now() - date) / 60000);
  if (diff < 1)  return "たった今";
  if (diff < 60) return `${diff}分前`;
  const h = Math.floor(diff / 60);
  if (h < 24)    return `${h}時間前`;
  return `${Math.floor(h/24)}日前`;
}
