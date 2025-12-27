import sys
import json
from datetime import date, datetime
from pathlib import Path
from typing import Any

from storage import load_tasks, append_task, load_tags_master,load_projects
from gpt_client import chisa_suggest_tags, chisa_suggest_priority
from priority import apply_priority_hint
from state_effect import adjust_score_by_state


# === パス関連 ===
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)  # data/ディレクトリを確実に作成

# ★ すべてのパスをdata配下に統一
STATE_PATH = DATA_DIR / "state.json"
TASKS_PATH = DATA_DIR / "tasks.jsonl"


def save_tasks(tasks: list[dict[str, Any]]) -> None:
    """tasks を data/tasks.jsonl に書き戻すヘルパー。"""
    lines: list[str] = []
    for t in tasks:
        lines.append(json.dumps(t, ensure_ascii=False))
    TASKS_PATH.write_text(("\n".join(lines) + "\n") if lines else "", encoding="utf-8")


# === 状態（state）読み込み ===
def load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        with STATE_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)
    # なければデフォルトの空の state
    return {}

def save_state(state: dict[str, Any]) -> None:
    """state.json を保存するヘルパー。"""
    with STATE_PATH.open("w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


# === タグ手動選択用（今はオプション機能） ===
def choose_tags_interactive() -> list[str]:
    """
    tags_master.json を読み込み、ユーザーにタグを選んでもらって
    key のリストを返す。
    """
    tags_master: dict[str, Any] = load_tags_master()
    tags: list[dict[str, Any]] = tags_master["tags"]

    print("利用可能なタグ一覧:")
    for idx, tag in enumerate(tags, start=1):
        axis = tag["axis"]
        key = tag["key"]
        label = tag["label"]
        print(f"{idx:2}: [{axis}] {key} - {label}")

    raw = input(
        "付けたいタグの番号をカンマ区切りで入力（例: 1,3 ／ 空Enterでタグなし）: "
    ).strip()

    if not raw:
        return []  # タグなし

    indices: list[int] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        if not part.isdigit():
            print(f"数字じゃないので無視します: {part}")
            continue

        i = int(part)
        if 1 <= i <= len(tags):
            indices.append(i - 1)  # enumerate(start=1) なので -1 する
        else:
            print(f"範囲外の番号なので無視します: {i}")

    selected_keys: list[str] = [tags[i]["key"] for i in indices]
    print("選択されたタグ:", selected_keys)
    return selected_keys


# === タスク追加 ===
def add_task(text: str, due_date: str | None = None) -> None:
    tasks = load_tasks()
    new_id = (tasks[-1]["id"] + 1) if tasks else 1

    tags: list[str] = chisa_suggest_tags(title=text, detail="")
    print("千紗のタグ提案:", tags)

    task: dict[str, Any] = {
        "id": new_id,
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "text": text,
        "project": "default",
        "tags": tags,
        "status": "todo",
    }

    if due_date is not None:
        task["due_date"] = due_date  # 文字列のまま持っておく

    append_task(task)
    print("タスク追加:", task)

# === タスク一覧表示 ===
def list_tasks() -> None:
    """タスク一覧を表示する。"""
    tasks = load_tasks()
    if not tasks:
        print("タスクはまだありません。")
        return

    for t in tasks:
        print(f"[{t['id']}] {t['text']} ({t['status']})")


# === 今日のおすすめタスク表示 ===
def show_today_recommendation() -> None:
    """state.json と tasks.jsonl を使って、千紗のおすすめ順を表示する。"""
    tasks = load_tasks()
    state = load_state()
    projects = load_projects()
    tags_master = load_tags_master()

    # タグごとの重みを辞書にしておく
    tag_weight_by_key: dict[str, int] = {}
    for tag_def in tags_master.get("tags", []):
        key = tag_def.get("key")
        if not key:
            continue
        w = int(tag_def.get("weight_for_priority", 0))
        tag_weight_by_key[key] = w

    today = date.today()

    # todo だけに絞る
    todo_tasks = [t for t in tasks if t.get("status") == "todo"]

    # days_left と score を計算してタスクに追加
    for t in todo_tasks:
        due_str = t.get("due_date")

        # タスクに期日がない場合、プロジェクトのdefaultを見る
        if not due_str:
            proj = t.get("project")
            if proj:
                proj_info = projects.get(proj, {})
                due_str = proj_info.get("default_due_date")

        if due_str:
            try:
                d = date.fromisoformat(due_str)
                days_left = (d - today).days
            except ValueError:
                days_left = None
        else:
            days_left = None

        t["days_left"] = days_left  # 千紗に渡す補助情報

        # --- ここから priority_hint を含めたスコア計算 ---
        # タグから基礎スコア
        base_score = 0
        for key in t.get("tags", []):
            base_score += tag_weight_by_key.get(key, 0)

        t["base_score"] = base_score

        # priority_hint を反映
        hint = t.get("priority_hint")
        score = apply_priority_hint(base_score, hint)

        # ★ ここで「今日の状態」からさらに微調整
        score = adjust_score_by_state(score, t, state)

        t["score"] = score
    # score 付きの todo_tasks を千紗APIに渡す
    ordered = chisa_suggest_priority(todo_tasks, state)

    print("=== 今日のおすすめタスク（千紗案） ===")
    if not ordered:
        print("おすすめ候補がありません。")
        return

    # id から元タスクを引けるように辞書を作る
    tasks_by_id: dict[str, dict[str, Any]] = {str(t["id"]): t for t in tasks}

    for item in ordered:
        tid = str(item.get("id"))
        reason = item.get("reason", "")
        original = tasks_by_id.get(tid)

        if original is not None:
            title = original.get("text", "(タイトル不明)")
        else:
            title = "(不明なタスク)"

        print(f"- [{tid}] {title}  ← {reason}")



def get_today_recommendation() -> list[dict[str, Any]]:
    """
    Web用：
    state.json と tasks.jsonl を使って、千紗のおすすめ順を
    「表示せずに list[dict] として返す」バージョン。
    """
    
    print("[DEBUG] get_today_recommendation start")
    print("[DEBUG] todo_count=", len([t for t in tasks if t.get("status")=="todo"]))

    tasks = load_tasks()
    state = load_state()
    projects = load_projects()
    tags_master = load_tags_master()

    # タグごとの重み辞書
    tag_weight_by_key: dict[str, int] = {}
    for tag_def in tags_master.get("tags", []):
        key = tag_def.get("key")
        if not key:
            continue
        w = int(tag_def.get("weight_for_priority", 0))
        tag_weight_by_key[key] = w

    today = date.today()

    # status が "todo" のタスクだけ対象
    todo_tasks: list[dict[str, Any]] = [t for t in tasks if t.get("status") == "todo"]

    # days_left, base_score, score を計算
    for t in todo_tasks:
        # 期日取得（タスク → プロジェクト default）
        due_str = t.get("due_date")

        if not due_str:
            proj = t.get("project")
            if proj:
                proj_info = projects.get(proj, {})
                due_str = proj_info.get("default_due_date")

        if due_str:
            try:
                d = date.fromisoformat(due_str)
                days_left = (d - today).days
            except ValueError:
                days_left = None
        else:
            days_left = None

        t["days_left"] = days_left

        # タグから基礎スコア
        base_score = 0
        for key in t.get("tags", []):
            base_score += tag_weight_by_key.get(key, 0)
        t["base_score"] = base_score

        # priority_hint 補正
        priority_hint = t.get("priority_hint")
        score = apply_priority_hint(base_score, priority_hint)

        # state からさらに補正
        score = adjust_score_by_state(score, t, state)

        t["score"] = score

    # 千紗APIに渡して、優先度順リストをもらう
    ordered = chisa_suggest_priority(todo_tasks, state)
    print("[DEBUG] chisa_result_count=", len(ordered))

    
    # 千紗が失敗したら、スコアで並べる（フォールバック）
    if not ordered:
        print("[情報] 千紗なし：スコアで並べます")
        # スコアの高い順に並べる
        sorted_tasks = sorted(todo_tasks, key=lambda t: t.get("score", 0), reverse=True)
        # 上位10件に絞る
        top_tasks = sorted_tasks[:10]
        
        results: list[dict[str, Any]] = []
        for t in top_tasks:
            results.append({
                "id": t.get("id"),
                "text": t.get("text", "(タイトル不明)"),
                "project": t.get("project"),
                "status": t.get("status"),
                "progress": t.get("status"),
                "tags": t.get("tags", []),
                "due_date": t.get("due_date"),
                "days_left": t.get("days_left"),
                "score": t.get("score"),
                "reason": "スコア順",
            })
        return results

    # 千紗が成功した場合の処理（元のまま）
    tasks_by_id: dict[int, dict[str, Any]] = {t["id"]: t for t in tasks}

    results: list[dict[str, Any]] = []
    for item in ordered:
        tid = item.get("id")
        reason = item.get("reason", "")
        original = tasks_by_id.get(tid)
        if original is None:
            continue

        results.append({
            "id": original.get("id"),
            "text": original.get("text", "(タイトル不明)"),
            "project": original.get("project"),
            "status": original.get("status"),
            "progress": original.get("status"),
            "tags": original.get("tags", []),
            "due_date": original.get("due_date"),
            "days_left": original.get("days_left"),
            "score": original.get("score"),
            "reason": reason,
        })

    return results

def get_tasks_scored_all() -> list[dict[str, Any]]:
    """
    Android用：
    - tasks.jsonl の todo に score を付与（state/projects/tagsを加味）
    - 千紗のおすすめ（最大5件）にだけ reason を付与
    - done も含めて返す（邪魔なら todo のみにしてOK）
    """
    tasks = load_tasks()
    state = load_state()
    projects = load_projects()
    tags_master = load_tags_master()

    # まず score を計算（get_today_recommendation と同じ流れ）
    today = date.today()
    todo_tasks: list[dict[str, Any]] = [t for t in tasks if t.get("status") == "todo"]

    for t in todo_tasks:
        # 期日取得（タスク → プロジェクト default）
        due_str = t.get("due_date")
        if not due_str:
            proj = t.get("project")
            if proj:
                proj_info = projects.get(proj, {})
                due_str = proj_info.get("default_due_date")

        if due_str:
            try:
                d = date.fromisoformat(due_str)
                days_left = (d - today).days
            except ValueError:
                days_left = None
        else:
            days_left = None

        t["days_left"] = days_left

        # タグから基礎スコア
        base_score = 0
        tag_weight_by_key = tags_master.get("tag_weight_by_key", {})
        for key in t.get("tags", []):
            base_score += tag_weight_by_key.get(key, 0)
        t["base_score"] = base_score

        # priority_hint 補正
        priority_hint = t.get("priority_hint")
        score = apply_priority_hint(base_score, priority_hint)

        # state からさらに補正
        score = adjust_score_by_state(score, t, state)

        t["score"] = score

    # 次に 千紗で「おすすめ順＋理由」をもらう（最大5件）
    ordered = chisa_suggest_priority(todo_tasks, state)  # ← 既存の関数を利用

    # reason を id で引けるようにする
    reason_by_id: dict[str, str] = {}
    for item in (ordered or []):
        tid = str(item.get("id"))
        reason = str(item.get("reason", "")).strip()
        if tid and reason:
            reason_by_id[tid] = reason

    # tasks 全体に reason を付与（おすすめ以外は空文字）
    for t in tasks:
        tid = str(t.get("id"))
        t["reason"] = reason_by_id.get(tid, "")

    return tasks


def complete_task(task_id: int) -> bool:
    """
    指定IDのタスクを status='done' にして保存する。
    見つかったら True、見つからなければ False。
    """
    tasks = load_tasks()
    found = False

    for t in tasks:
        if t.get("id") == task_id:
            # すでに done ならそれでOK扱い
            if t.get("status") == "done":
                return True
            t["status"] = "done"
            t["completed_at"] = datetime.now().isoformat(timespec="seconds")
            found = True
            break

    if not found:
        return False

    save_tasks(tasks)
    return True


def import_state_data(data: dict[str, Any]) -> None:
    """
    日誌JSON(dict)を受け取り、state.json更新＋new_tasks追加を行う。
    """
    from datetime import datetime
    
    # 1) state.json を更新（★ save_state()を使うのでSTATE_PATHに自動的に保存される）
    state_out: dict[str, Any] = {
        "date": data.get("date"),
        "meta": data.get("meta", {}),
        "constraints": data.get("constraints", {}),
        "focus_plan": data.get("focus_plan", {}),
        "tomorrow_suggestions": data.get("tomorrow_suggestions", {}),
        "free_note": data.get("free_note", ""),
        "last_imported_at": datetime.now().isoformat(timespec="seconds"),
    }
    save_state(state_out)
    print(f"state.json を更新しました: {STATE_PATH}")

    # 2) new_tasks からタスクを追加
    new_tasks_data = data.get("new_tasks", [])
    if not isinstance(new_tasks_data, list):
        print("new_tasks が配列ではありません。タスクの追加はスキップします。")
        return

    tasks = load_tasks()
    existing_texts = {t.get("text") for t in tasks if t.get("text")}
    next_id = max([t.get("id", 0) for t in tasks] or [0]) + 1

    added_count = 0
    for nt in new_tasks_data:
        if not isinstance(nt, dict):
            continue

        text = nt.get("text")
        if not text:
            continue

        if text in existing_texts:
            continue

        project = nt.get("project") or "default"
        due_date = nt.get("due_date")
        tags = nt.get("tags_hint") or []
        priority_hint = nt.get("priority_hint")

        task: dict[str, Any] = {
            "id": next_id,
            "created_at": date.today().isoformat(),
            "text": text,
            "project": project,
            "tags": tags,
            "status": "todo",
        }
        if due_date:
            task["due_date"] = due_date
        if priority_hint:
            task["priority_hint"] = priority_hint

        append_task(task)
        existing_texts.add(text)
        next_id += 1
        added_count += 1

    print(f"new_tasks から {added_count} 件のタスクを追加しました。")


def import_state_log(path_str: str) -> None:
    """日誌JSONファイル(state_xxx.json)を読み込んで処理する（CLI 用）。"""
    path = Path(path_str)
    if not path.exists():
        print("stateファイルが見つかりません:", path)
        return

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    import_state_data(data)

def get_projects_summary() -> list[dict[str, Any]]:
    """
    プロジェクトごとの進捗状況を集計して返す
    """
    tasks = load_tasks()
    projects_data = load_projects() # storage.py にある前提
    
    # プロジェクトごとの集計用辞書
    # key: project_id
    summary = {}

    # 1. プロジェクト定義をロードして枠を作る
    # projects_data が {"prj_a": {...}, "prj_b": {...}} の形だと仮定
    for pid, info in projects_data.items():
        summary[pid] = {
            "id": pid,
            "name": info.get("name", pid),
            "description": info.get("description", ""),
            "total": 0,
            "done": 0,
        }

    # "default" や未定義プロジェクト用も考慮
    if "default" not in summary:
        summary["default"] = {
            "id": "default",
            "name": "デフォルト",
            "description": "プロジェクト未割り当てのタスク",
            "total": 0,
            "done": 0
        }

    # 2. タスクを集計
    for t in tasks:
        pid = t.get("project", "default")
        
        # もし projects.json にない未知のプロジェクトIDがタスクにあった場合
        if pid not in summary:
            summary[pid] = {
                "id": pid,
                "name": pid,
                "description": "未定義プロジェクト",
                "total": 0,
                "done": 0
            }
            
        summary[pid]["total"] += 1
        if t.get("status") == "done":
            summary[pid]["done"] += 1

    # 3. リストに変換して進捗率を計算
    results = []
    for pid, data in summary.items():
        total = data["total"]
        done = data["done"]
        # タスクが0個なら進捗0%
        progress = int((done / total) * 100) if total > 0 else 0
        
        data["progress"] = progress
        results.append(data)

    # 進捗が高い順、あるいはID順に並べ替え（お好みで）
    results.sort(key=lambda x: x["id"])
    
    return results



# === エントリポイント ===
def main() -> None:
    if len(sys.argv) < 2:
        print("使い方:")
        print("  python app.py add \"タスク内容\"")
        print("  python app.py list")
        print("  python app.py today")
        return

    cmd = sys.argv[1]

    if cmd == "add":
        if len(sys.argv) < 3:
            print("タスク内容を指定してください。")
            return
        text = " ".join(sys.argv[2:])
        add_task(text)

    elif cmd == "add_due":
        if len(sys.argv) < 4:
            print("使い方: python app.py add_due \"タスク内容\" YYYY-MM-DD")
            return
        text = " ".join(sys.argv[2:-1])
        due_date = sys.argv[-1]
        add_task(text, due_date)

    elif cmd == "list":
        list_tasks()

    elif cmd == "today":
        show_today_recommendation()
        
    elif cmd == "import_state":
        if len(sys.argv) < 3:
            print("使い方: python app.py import_state state_YYYY-MM-DD.json")
            return
        import_state_log(sys.argv[2])

    else:
        print("未知のコマンドです:", cmd)




if __name__ == "__main__":
    main()
