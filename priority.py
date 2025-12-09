# priority.py
from __future__ import annotations
from typing import Optional, Dict

HINT_BONUS: Dict[Optional[str], int] = {
    "critical": 40,
    "high": 20,
    "normal": 0,
    "low": -10,
    "someday": -20,
    None: 0,  # 未指定
}

def normalize_priority_hint(raw: Optional[str]) -> Optional[str]:
    """priority_hint を正規化。不正値は None 扱い。"""
    if raw is None:
        return None
    hint = str(raw).strip().lower()
    return hint if hint in HINT_BONUS else None

def apply_priority_hint(base_score: int, priority_hint: Optional[str]) -> int:
    """base_score に priority_hint の補正を足す。"""
    norm = normalize_priority_hint(priority_hint)
    bonus = HINT_BONUS.get(norm, 0)
    return base_score + bonus
