# state_effect.py
from __future__ import annotations
from typing import Any, Dict, List, Optional


def _task_tags(task: Dict[str, Any]) -> List[str]:
    """タスクから tags を安全に取り出す小さいヘルパー。"""
    tags = task.get("tags") or []
    # 文字列以外が混ざっていても落ちないようにしておく
    return [str(t) for t in tags]


from typing import Any, Dict, List, Optional

def _as_dict(v: Any) -> Dict[str, Any]:
    """dict以外が来ても落ちないようにdictへ寄せる"""
    return v if isinstance(v, dict) else {}

def _as_list(v: Any) -> List[Any]:
    """list以外が来ても落ちないようにlistへ寄せる（strは1要素扱い）"""
    if v is None:
        return []
    if isinstance(v, list):
        return v
    if isinstance(v, tuple):
        return list(v)
    if isinstance(v, str):
        s = v.strip()
        return [s] if s else []
    # それ以外（数値/dict等）は無視
    return []

def adjust_score_by_state(
    score: int,
    task: Dict[str, Any],
    state: Dict[str, Any],
) -> int:
    """今日の状態(meta/constraints/focus_plan)を使ってスコアを少し補正する。"""
    tags = _task_tags(task)

    meta = _as_dict((state or {}).get("meta"))
    constraints = _as_dict((state or {}).get("constraints"))

    # ★ここが今回の要：focus_planがlistでも落ちない
    plan_raw = (state or {}).get("focus_plan")
    plan = _as_dict(plan_raw)

    # prefer_axes / avoid_axes は list に正規化
    prefer_axes = [str(x) for x in _as_list(plan.get("prefer_axes")) if str(x).strip()]
    avoid_axes  = [str(x) for x in _as_list(plan.get("avoid_axes")) if str(x).strip()]

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
    if prefer_axes:
        if any(ax in tag for tag in tags for ax in prefer_axes):
            bonus += 10

    if avoid_axes:
        if any(ax in tag for tag in tags for ax in avoid_axes):
            bonus -= 10

    return score + bonus

