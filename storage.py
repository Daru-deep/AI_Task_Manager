import json
from pathlib import Path
from typing import Any, TypedDict

from config import TAGS_MASTER_PATH,TASKS_PATH,PROJECTS_PATH

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

def load_tasks() -> list[dict[str, Any]]:
    path: Path = TASKS_PATH
    
    if not path.exists():
        return []
    
    tasks: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            task: dict[str, Any] = json.loads(line)
            tasks.append(task)
    return tasks

def append_task(task: dict[str, Any]) -> None:
    path: Path = TASKS_PATH
    
    line: str = json.dumps(task, ensure_ascii=False)
    with path.open("a",encoding="utf-8") as f:
        f.write(line + "\n")
        
def load_projects() -> dict[str,Any]:
    if not PROJECTS_PATH.exists():
        return {}
    text = PROJECTS_PATH.read_text(encoding="utf-8")
    return json.loads(text)