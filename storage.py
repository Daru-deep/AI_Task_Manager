import json
from pathlib import Path
from typing import Any, TypedDict
from config import TAGS_MASTER_PATH,TASKS_PATH,PROJECTS_PATH
from errors import ChisaError

TagsMaster = dict[str, Any]

def load_tags_master() -> TagsMaster:
    path: Path = TAGS_MASTER_PATH
    
    if not path.exists():
        raise FileNotFoundError(f"タグマスタがありません: {path}")
    
    with path.open("r", encoding="utf-8") as f:
        data: TagsMaster = json.load(f)
    return data

def save_tags_master(data: TagsMaster) -> None:
    path: Path = TAGS_MASTER_PATH
    
    with path.open("W",encoding="utf-8") as f:
        json.dump(data,f,ensure_ascii=False,indent=2)

def load_tasks() -> list[dict]:
    path = TASKS_PATH
    if not path.exists():
        return []

    tasks = []
    with path.open("r", encoding="utf-8") as f:
        for i, line in enumerate(f, start=1):
            s = line.strip()
            if not s:
                continue
            try:
                tasks.append(json.loads(s))
            except Exception as e:
                raise ChisaError(
                    "E_TASKS_JSONL_CORRUPT",
                    "tasks.jsonl が壊れています（JSON連結/欠損の可能性）",
                    meta={"line": i, "head": s[:200], "path": str(path), "err": str(e)}
                )
    return tasks

def append_task(path: Path, task: dict) -> None:
    line = json.dumps(task, ensure_ascii=False)
    # 1行1JSONの保証
    json.loads(line)  # 念のため：壊れたJSONは書かない

    with path.open("a", encoding="utf-8", newline="\n") as f:
        f.write(line + "\n")
        f.flush()
        
def _load_json_flexible(path: Path):
    if not path.exists():
        return {}

    text = path.read_text(encoding="utf-8")

    # BOMや空白を除去
    s = text.lstrip("\ufeff").strip()
    if not s:
        return {}

    # 1) まず通常JSONとして読む
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass

    # 2) 先頭のJSONだけ救出（連結JSON対策）
    dec = json.JSONDecoder()
    try:
        obj, _ = dec.raw_decode(s.lstrip())
        return obj
    except Exception:
        pass

    # 3) JSONLとして読む（各行がJSON）
    out = []
    for line in s.splitlines():
        line = line.strip()
        if not line:
            continue
        out.append(json.loads(line))
    return out



def load_projects() -> dict[str, dict[str, Any]]:
    """
    projects を dict に統一して返す。
    - dict形式: {"default": {...}, "job": {...}}
    - list形式: [{"id":"default", ...}, {"id":"job", ...}] → dictに変換
    """

    raw = _load_json_flexible(PROJECTS_PATH)

    if isinstance(raw, dict):
        return raw

    if isinstance(raw, list):
        result: dict[str, dict[str, Any]] = {}
        for item in raw:
            if not isinstance(item, dict):
                continue
            pid = item.get("id") or item.get("key") or item.get("project")  # 保険
            if isinstance(pid, str) and pid:
                result[pid] = item
        return result

    return {}