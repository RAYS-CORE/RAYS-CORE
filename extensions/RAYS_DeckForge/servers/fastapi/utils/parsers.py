def parse_bool_or_none(value: str | None) -> bool | None:
    if value is None:
        return None
    return value.lower() == "true"
