"""Event bus — modules communicate via events, never direct calls."""


class EventBus:
    def __init__(self):
        self._subscribers: dict[str, list[callable]] = {}

    def on(self, event: str, handler: callable):
        self._subscribers.setdefault(event, []).append(handler)

    def off(self, event: str, handler: callable):
        handlers = self._subscribers.get(event, [])
        if handler in handlers:
            handlers.remove(handler)

    def emit(self, event: str, **data):
        for handler in self._subscribers.get(event, []):
            handler(event=event, **data)

    def clear(self):
        self._subscribers.clear()
