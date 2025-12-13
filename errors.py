# errors.py
class ChisaError(Exception):
    def __init__(self, code: str, message: str, *, meta: dict | None = None):
        super().__init__(message)
        self.code = code
        self.meta = meta or {}
