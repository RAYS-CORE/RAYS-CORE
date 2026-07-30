import base64
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.v1.ppt.endpoints.slide_to_html import SLIDE_TO_HTML_ROUTER


def _build_client():
    app = FastAPI()
    app.include_router(SLIDE_TO_HTML_ROUTER)
    return TestClient(app)


def test_slide_to_html_returns_500_when_api_key_missing():
    client = _build_client()

    with patch.dict("os.environ", {}, clear=False):
        response = client.post("/slide-to-html/", json={"image": "/x.png", "xml": "<x />"})

    assert response.status_code == 500
    assert "OPENAI_API_KEY environment variable not set" in response.json()["detail"]


def test_slide_to_html_returns_404_when_image_not_found():
    client = _build_client()

    with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}, clear=False), patch(
        "api.v1.ppt.endpoints.slide_to_html.resolve_image_path_to_filesystem",
        return_value=None,
    ):
        response = client.post("/slide-to-html/", json={"image": "/missing.png", "xml": "<x />"})

    assert response.status_code == 404
    assert response.json()["detail"].startswith("Image file not found")


def test_slide_to_html_success_returns_structured_response_and_strips_fences(tmp_path):
    client = _build_client()
    image_path = tmp_path / "slide.png"
    image_path.write_bytes(b"png-data")

    mock_generate = AsyncMock(return_value="```html\n<div>Hello</div>\n```")

    with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}, clear=False), patch(
        "api.v1.ppt.endpoints.slide_to_html.resolve_image_path_to_filesystem",
        return_value=str(image_path),
    ), patch(
        "api.v1.ppt.endpoints.slide_to_html.generate_html_from_slide",
        mock_generate,
    ):
        response = client.post(
            "/slide-to-html/",
            json={"image": "/app_data/images/slide.png", "xml": "<p:sld />", "fonts": ["Inter"]},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["html"] == "\n<div>Hello</div>\n"

    kwargs = mock_generate.await_args.kwargs
    assert kwargs["media_type"] == "image/png"
    assert kwargs["fonts"] == ["Inter"]
    assert kwargs["base64_image"] == base64.b64encode(b"png-data").decode("utf-8")
