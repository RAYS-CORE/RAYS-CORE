import asyncio
import json

import pytest
from fastapi import HTTPException

from services.documents_loader import (
    DocumentsLoader,
    _unwrap_liteparse_json_line_if_stored,
    clean_extracted_document_text,
)


def test_unwrap_liteparse_json_line_extracts_text_field():
    inner_text = "Title\n\nBody with \"quotes\""
    payload = json.dumps({"ok": True, "filePath": "/tmp/test.pdf", "text": inner_text})

    assert _unwrap_liteparse_json_line_if_stored(payload) == inner_text
    assert _unwrap_liteparse_json_line_if_stored(f"  {payload}") == inner_text


def test_unwrap_liteparse_json_line_leaves_non_json_text():
    plain_text = "Not JSON, should stay as-is."
    assert _unwrap_liteparse_json_line_if_stored(plain_text) == plain_text


def test_clean_extracted_document_text_handles_malformed_json_body():
    malformed = (
        '{"ok": true, "filePath": "/tmp/test.pdf", "text": '
        '"hello\\nworld\\u0021 and trailing'
    )
    cleaned = clean_extracted_document_text(malformed)
    assert cleaned == "hello\nworld! and trailing"


def test_clean_extracted_document_text_unwraps_nested_liteparse_payloads():
    nested = json.dumps(
        {
            "ok": True,
            "filePath": "/tmp/outer.pdf",
            "text": json.dumps(
                {"ok": True, "filePath": "/tmp/inner.pdf", "text": "final body"}
            ),
        }
    )
    assert clean_extracted_document_text(nested) == "final body"


def test_load_pdf_requires_temp_dir_when_images_are_requested():
    loader = DocumentsLoader(file_paths=[])

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            loader.load_pdf(
                file_path="/tmp/fake.pdf",
                load_text=False,
                load_images=True,
                temp_dir=None,
            )
        )

    assert exc.value.status_code == 400
    assert "temp_dir is required" in exc.value.detail
