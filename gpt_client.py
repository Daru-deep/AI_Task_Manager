from typing import Any
import json
import os
from openai import OpenAI
from config import TAGS_MASTER_PATH

API_KEY = os.environ.get("OPENAI_API_KEY", "")
if not API_KEY:
    raise RuntimeError(
        "環境変数 OPENAI_API_KEY が設定されていません。\n"
        "設定方法:\n"
        "  Windows: set OPENAI_API_KEY=sk-...\n"
        "  Mac/Linux: export OPENAI_API_KEY=sk-..."
    )
client = OpenAI(api_key=API_KEY)

def load_tag_candidates() -> list[str]:
    """tags_master.jsonからタグ候補を動的に読み込む"""
    if not TAGS_MASTER_PATH.exists():
        print(f"[警告] {TAGS_MASTER_PATH} が見つかりません。")
        print("デフォルトタグを使用します。")
        return ["job_search", "portfolio", "coding", "admin", "light", "medium", "heavy"]
    
    with open(TAGS_MASTER_PATH, encoding="utf-8") as f:
        data = json.load(f)
    
    return [tag["key"] for tag in data.get("tags", [])]
  
  
"""コメントアウト（過去のタグリスト）

CHISA_TAG_CANDIDATES: list[str] = [
    "job_search",
    "career_research",      # ← 追加
    "portfolio",
    "portfolio_review",
    "strategy_game",
    "novel_game",
    "room_setup",
    "research",
    "design",
    "writing",
    "coding",
    "asset",
    "fix",
    "cleaning",
    "admin",
    "creative_paid_short",
    "creative_paid_long",
    "creative_portfolio",
    "light",
    "medium",
    "heavy",
    "start",
    "ongoing",
    "review",
]
"""

# 優先度提案用の system プロンプト
PRIORITY_SYSTEM_PROMPT: str = """
あなたは「千紗（ちさ）」です。
タスク管理・優先順位付けのためのAIアシスタントです。

目的:
- 小鳥遊の今日の状態（state）を理解する
- その状態でも「現実的にこなせる」タスクだけを候補にする
- タスクのタグ・締切・身体／精神負荷を総合して優先順位をつける
- 今日やるべきタスクを、上位5件まで JSON で返す

入力:
- state: 今日の状態を表すJSON
  - 例: can_sit_at_desk, can_go_outside,
        physical_energy, mental_energy, creative_drive,
        money_pressure_creative, study_deadline_days など
- tasks: タスク配列（status=="todo" のものが対象）
  - 各タスクには tags, project, due_date などが含まれる

主なタグの意味（重要なものだけ）:
- job_search: 就活（応募書類・面談準備）→ 緊急度の高いカテゴリ
- career_research: 業界調査・企業研究
- study_*: 勉強・試験対策タスク
- creative_paid_short: 短期で収益につながる創作（生活費に直結）
- creative_paid_long: 長期プロジェクトとしての収益創作
- creative_portfolio: ポートフォリオ用の作品
- strategy_game / novel_game: ゲーム制作タスク
- cleaning / room_setup / admin: 比較的軽めの日常タスク
- light / medium / heavy: 身体負荷レベル
- start: 「とりあえず一歩目」として取り組みやすいタスク

優先順位付けの指針:

1. まず「今日できないタスク」を除外する
   - can_sit_at_desk = false の場合、
     机での作業かつ heavy なタスクは候補に入れない
   - can_go_outside = false の場合、
     外出が前提のタスクは候補に入れない
   - physical_energy と mental_energy が両方 low のとき、
     heavy タスクは原則除外し、medium も下位に回す

2. 緊急度・義務を考慮する
   - job_search 系タスクは、体調が「完全に不可能」でなければ最上位候補
   - study_deadline_days <= 2 の場合、
     study_* タスクを強く優先する（ただし heavy すぎるものは避ける）

3. 経済的プレッシャーを考慮する
   - money_pressure_creative = "high" のとき、
     creative_paid_short を優先度高めに扱う
   - creative_paid_long は physical_energy が medium 以上のときのみ候補にしてよい
   - creative_portfolio は基本的に後回しにしてよいが、
     体調と他の義務に余裕がある日に上位に入れてよい

4. 体力・精神状態で調整する
   - physical_energy = "low" のときは heavy を避け、light を優先する
   - mental_energy = "low" のときは、
     design / writing / coding / fix のような頭を酷使するタスクの優先度を下げる
   - creative_drive = "high" のとき、
     light な creative_* タスクをウォームアップとして1件程度上位に含めてもよいが、
     job_search や差し迫った study_* を追い出してはいけない

5. スタートのしやすさ
   - 似た重要度のタスク同士なら、
     「今日の体調でも始めやすいもの」
     （タグ: light / cleaning / admin / start など）を少しだけ優先してよい

出力形式:
次の形式の JSON オブジェクトのみを返してください。

{
  "ordered_tasks": [
    { "id": 数値ID, "reason": "なぜ今日そのタスクを優先するのかを1〜2文で簡潔に" }
  ]
}

制約:
- 対象は status=="todo" のタスクのみ
- id は入力 tasks の id をそのまま使うこと（数値型）
- 最大5件まで
- JSON以外のテキストは一切出力しないこと
""".strip()


def chisa_suggest_priority(
    tasks: list[dict[str, Any]],
    state: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    今日の state と todoタスク一覧を渡して、
    千紗に「今日のおすすめタスク順」を聞く。

    戻り値: [{ "id": int, "reason": str }, ...]
    """
    # Pythonのdict/listをJSON文字列に変換して、プロンプトに埋め込む
    state_json: str = json.dumps(state, ensure_ascii=False)
    tasks_json: str = json.dumps(tasks, ensure_ascii=False)

    user_msg: str = f"""
これから小鳥遊の「今日の状態」と「タスク一覧」を渡します。

【今日の状態 state（JSON）】
{state_json}

【タスク一覧 tasks（JSON）】
{tasks_json}

条件：
- status が "todo" のタスクだけを対象にしてください。
- 今日の状態とタグを考慮して、現実的に実行可能なタスクだけを候補にしてください。
- 最大5件までで十分です。

お願い：
- 今日やるべきタスクを優先順位順に並べてください。
- 各タスクについて、「なぜそれを優先したのか」の理由も短く付けてください。
- 出力は必ず JSON のみ（ordered_tasks配列）で返してください。
""".strip()

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": PRIORITY_SYSTEM_PROMPT},  # ← ここ修正
                {"role": "user", "content": user_msg},
            ],
            timeout=30.0,
        )
        content: str = resp.choices[0].message.content or "{}"
    
    except Exception as e:
        print(f"[警告] 千紗への問い合わせに失敗しました: {e}")  # ← メッセージ修正
        print("今回は千紗なしで動作を続けます。")
        return []

    # ← ここからJSON解析のtryブロック（元からあったもの）
    try:
        data: dict[str, Any] = json.loads(content)
    except json.JSONDecodeError:
        print("千紗の優先度レスポンスがJSONとして壊れていました:", content)
        return []

    ordered: list[dict[str, Any]] = data.get("ordered_tasks", [])
    
    # 実在するタスクIDのセットを作成（検証用）
    valid_task_ids = {t["id"] for t in tasks}
    
    # id / reason を整形して返す
    normalized: list[dict[str, Any]] = []
    for item in ordered:
        # IDを整数に変換
        raw_id = item.get("id")
        try:
            task_id = int(raw_id)
        except (TypeError, ValueError):
            print(f"[警告] 不正なタスクID: {raw_id}")
            continue
        
        # 存在しないIDをスキップ
        if task_id not in valid_task_ids:
            print(f"[警告] 存在しないタスクID: {task_id}")
            continue
        
        reason = str(item.get("reason", "")).strip()
        
        # 理由が空ならスキップ
        if not reason:
            print(f"[警告] タスク{task_id}の理由が空です")
            continue
        
        normalized.append({"id": task_id, "reason": reason})

    return normalized


def chisa_suggest_tags(title: str, detail: str) -> list[str]:
    """
    千紗（ちさ）としてタスクのタグを提案する。
    返り値はタグ文字列のリスト（最大3個）。
    """
    # タグ候補リストを1つの文字列にする（プロンプト用）
    tag_candidates = load_tag_candidates()
    tags_list_str = ", ".join(tag_candidates)

    system_msg = f"""
あなたは「千紗（ちさ）」です。
タスク管理・分類専用のAIとして動作します。

あなたの目的：
- 与えられたタスク内容から、最も適切なタグを0〜3個選択する。
- タグは必ず定義済みリストから選ぶ。
- 出力は必ず JSON のみとし、余計な文章は付けない。

【タグ候補リスト】
{tags_list_str}

【出力形式】
{{
  "tags": ["tag1", "tag2", ...]
}}

【ルール】
- タスクのタイトル・詳細を読み、カテゴリ → 性質 → 重さ の順に関連性を判断する。
- 候補リストにない語は生成しない。
- タグ数は最大3個。迷ったら重要度の高いものを優先する。
- JSON以外の文章は出さない。
""".strip()

    user_msg = f"""
以下はタスクです。
このタスクにふさわしいタグを選んでください。

【タスク】
タイトル: {title}
詳細: {detail}

JSONのみで返してください。
""".strip()


    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            timeout=30.0,
        )
        content: str = resp.choices[0].message.content or "{}"
    
    except Exception as e:
        print(f"[警告] 千紗へのタグ提案に失敗しました: {e}")
        print("タグなしでタスクを追加します。")
        return []

    try:
        data: dict[str, Any] = json.loads(content)
    except json.JSONDecodeError:
        print("千紗のタグ付けレスポンスがJSONとして壊れていました:", content)
        return []

    tags: list[str] = data.get("tags", [])
    
    # 候補リスト内のタグのみ返す
    tag_candidates = load_tag_candidates()
    valid_tags = [str(t) for t in tags if str(t) in tag_candidates]
    
    # 候補外のタグがあれば警告
    if len(valid_tags) < len(tags):
        invalid = set(tags) - set(valid_tags)
        print(f"[警告] 候補外のタグが提案されました: {invalid}")
    
    return valid_tags[:3]  # 最大3個に制限


