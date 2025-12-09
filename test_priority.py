from typing import Any
from gpt_client import chisa_suggest_priority

def main() -> None:
    # さっき話した「元気ないけど創作欲だけ高い」状態
    state: dict[str, Any] = {
        "physical_energy": "low",
        "mental_energy": "low",
        "creative_drive": "high",
        "can_sit_at_desk": False,
        "can_go_outside": False,
        "study_deadline_days": 2,
        "money_pressure_creative": "high",
    }

    # 仮タスクたち
    tasks: list[dict[str, Any]] = [
        {
            "id": "exam_study",
            "project_id": "exam",
            "title": "試験対策の過去問を1セット解く",
            "detail": "",
            "tags": ["study", "medium"],
            "priority": None,
            "status": "todo",
        },
        {
            "id": "yandere_scenario",
            "project_id": "yandere_confinement",
            "title": "ヤンデレ監禁のシナリオを10行だけ進める",
            "detail": "",
            "tags": ["novel_game", "creative_paid_short", "writing", "light"],
            "priority": None,
            "status": "todo",
        },
        {
            "id": "tower_balance",
            "project_id": "tower_defense",
            "title": "ストラテジーのWaveバランス調整",
            "detail": "",
            "tags": ["strategy_game", "creative_portfolio", "design", "heavy"],
            "priority": None,
            "status": "todo",
        },
    ]

    ordered = chisa_suggest_priority(tasks, state)

    print("=== 今日のおすすめタスク順（千紗案） ===")
    for item in ordered:
        print(f"- {item['id']}: {item['reason']}")

if __name__ == "__main__":
    main()
