// ========================================
// template.js - テンプレート・プロンプトページ
// ========================================

const DIARY_TEMPLATE = `{
  "date": "YYYY-MM-DD",

  "physical_energy": "medium",
  "mental_energy": "medium",
  "can_sit_at_desk": true,
  "can_go_outside": true,
  "creative_drive": "medium",
  "money_pressure_creative": "low",
  "study_deadline_days": 999,

  "meta": {
    "focus_level": 3,
    "health_score": 3,
    "mood_summary": "今日の一言メモ"
  },
  "constraints": {
    "can_go_out": true
  },
  "focus_plan": {
    "prefer_axes": ["light", "admin"],
    "avoid_axes": ["heavy"]
  },
  "free_note": "今日の振り返りを自由に。",
  "new_tasks": [
    {
      "text": "タスクのタイトル（必須）",
      "project": "プロジェクトID",
      "due_date": null,
      "tags_hint": [],
      "priority_hint": "medium"
    }
  ]
}`;

const GPT_SYSTEM_PROMPT = `あなたはタスク管理AIの日誌パーサーです。
私（ユーザー）の今日の出来事・体調・タスクを会話の中から読み取り、以下のJSON形式で日誌データを出力してください。

【フィールドの説明】
- physical_energy  : 体の元気さ。"low" / "medium" / "high"
- mental_energy    : 頭・気持ちの元気さ。"low" / "medium" / "high"
- can_sit_at_desk  : 机に座って作業できるか。true / false
- can_go_outside   : 外出できるか。true / false
- creative_drive   : 創作・制作への意欲。"low" / "medium" / "high"
- money_pressure_creative : 収益作業へのプレッシャー。"low" / "medium" / "high"
- study_deadline_days     : 試験や提出の締切まで何日か。なければ 999
- meta.focus_level : 集中力 0〜5。2以下だと重い作業が自動で下がる
- meta.health_score: 体調スコア 0〜5（目安）
- constraints.can_go_out  : 外出できるか（constraints用）。true / false
- focus_plan.prefer_axes  : 優先したいタグのキーワード配列（例: ["light", "admin"]）
- focus_plan.avoid_axes   : 避けたいタグのキーワード配列（例: ["heavy", "coding"]）
- free_note        : 今日の振り返りを自由に記述
- new_tasks        : 今日の会話で出てきた「やること」を追加する

【tags_hint に使えるキー一覧】
job_search, career_research, portfolio, portfolio_review,
strategy_game, novel_game, room_setup, research, design,
writing, coding, asset, fix, cleaning, admin,
creative_paid_short, creative_paid_long, creative_portfolio,
light, medium, heavy, start, ongoing, review

【priority_hint の値】
critical（最優先）/ high / medium / low / someday

【ルール】
- 出力は必ずJSONのみ。説明文は不要
- 読み取れない項目はデフォルト値を使う
  （energy系: "medium"、can_*: true、focus_level: 3、study_deadline_days: 999）
- new_tasks は会話で明示されたものだけ追加する
- date は今日の日付（YYYY-MM-DD形式）を入れる`;

const GPT_USER_EXAMPLE = `以下は今日の出来事です。日誌JSONを出力してください。

---
今日は朝から頭が重くて、あまり集中できなかった。
午後に少しだけ部屋の片付けをして、夜はご飯を作って食べた。
外には出ていない。
明日はポートフォリオの作業を少しでも進めたい。
---`;

function copyToClipboard(text, btnEl) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btnEl.textContent;
    btnEl.textContent = "コピーしました！";
    btnEl.style.background = "linear-gradient(180deg, #00cc88, #00aa66)";
    setTimeout(() => {
      btnEl.textContent = orig;
      btnEl.style.background = "";
    }, 2000);
  });
}

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function setupTemplatePage() {
  // テンプレートエリアに内容をセット
  const tplEl = document.getElementById("tpl-json-content");
  if (tplEl) tplEl.textContent = DIARY_TEMPLATE;

  const sysEl = document.getElementById("tpl-system-prompt-content");
  if (sysEl) sysEl.textContent = GPT_SYSTEM_PROMPT;

  const userEl = document.getElementById("tpl-user-example-content");
  if (userEl) userEl.textContent = GPT_USER_EXAMPLE;

  // コピーボタン
  document.getElementById("btn-copy-template")
    ?.addEventListener("click", e => copyToClipboard(DIARY_TEMPLATE, e.target));

  document.getElementById("btn-copy-system")
    ?.addEventListener("click", e => copyToClipboard(GPT_SYSTEM_PROMPT, e.target));

  document.getElementById("btn-copy-user")
    ?.addEventListener("click", e => copyToClipboard(GPT_USER_EXAMPLE, e.target));

  // ダウンロードボタン
  document.getElementById("btn-download-template")
    ?.addEventListener("click", () => {
      const today = new Date();
      const d = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
      downloadFile(DIARY_TEMPLATE, `state_${d}.json`);
    });
}

document.addEventListener("DOMContentLoaded", setupTemplatePage);
