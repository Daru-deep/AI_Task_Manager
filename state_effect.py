# state_effect.py
from __future__ import annotations
from typing import Any, Dict, List, Optional


def _task_tags(task: Dict[str, Any]) -> List[str]:
    """タスクから tags を安全に取り出す小さいヘルパー。"""
    tags = task.get("tags") or []
    # 文字列以外が混ざっていても落ちないようにしておく
    return [str(t) for t in tags]


def adjust_score_by_state(
    score: int,
    task: Dict[str, Any],
    state: Dict[str, Any],
) -> int:
    """今日の状態(meta/constraints/focus_plan)を使ってスコアを少し補正する。

    - 集中力が低い日は「heavy」タグ付きタスクを下げる
    - 外出できない日は「outside」「shopping」系タグを下げる
    - prefer_axes / avoid_axes によって、軸に合うタスクを上下させる

    ※あくまで「微調整」であって、タグやpriority_hintで決まった
      基本スコアを壊さない範囲に抑えている。
    """
    tags = _task_tags(task)
    meta = state.get("meta", {}) or {}
    constraints = state.get("constraints", {}) or {}
    plan = state.get("focus_plan", {}) or {}

    bonus = 0

    # 1. 集中力が低い日は heavy タグを下げる
    focus = meta.get("focus_level")
    try:
        focus_int: Optional[int] = int(focus) if focus is not None else None
    except (TypeError, ValueError):
        focus_int = None

    if focus_int is not None and focus_int <= 2:
        if "heavy" in tags:
            bonus -= 20

    # 2. 外出できない日は outside / shopping タグを下げる
    if constraints.get("can_go_out") is False:
        outside_related = {"outside", "shopping", "errand"}
        if any(tag in outside_related for tag in tags):
            bonus -= 15

    # 3. prefer_axes / avoid_axes をタグ名にざっくり反映
    #    例: prefer_axes=["work", "study"] のとき、
    #        "work_portfolio", "study_programming" などを少し上げる
    prefer_axes = plan.get("prefer_axes") or []
    avoid_axes = plan.get("avoid_axes") or []

    if prefer_axes:
        if any(ax in tag for tag in tags for ax in prefer_axes):
            bonus += 10

    if avoid_axes:
        if any(ax in tag for tag in tags for ax in avoid_axes):
            bonus -= 10

    return score + bonus
