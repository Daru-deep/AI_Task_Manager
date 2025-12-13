from pathlib import Path
import os

# このプロジェクトのルート
BASE_DIR:Path = Path(__file__).parent

# データ置き場
DATA_DIR: Path = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)


# ファイルパス
TAGS_MASTER_PATH: Path = DATA_DIR / "tags_master.json"
TASKS_PATH: Path = DATA_DIR / "tasks.jsonl"
PROJECTS_PATH: Path = DATA_DIR / "projects.json"

OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")

