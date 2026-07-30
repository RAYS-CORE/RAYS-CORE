import asyncio
from unittest.mock import AsyncMock, patch

from api.v1.ppt.endpoints.slide_to_html import SlideToHtmlRequest, convert_slide_to_html
from tests.mocks.normalizers import normalize_payload


def test_slide_to_html_snapshot_matches_normalized_response(load_snapshot, tmp_path):
    image_path = tmp_path / "slide.png"
    image_path.write_bytes(b"png-bytes")

    with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}, clear=False), patch(
        "api.v1.ppt.endpoints.slide_to_html.resolve_image_path_to_filesystem",
        return_value=str(image_path),
    ), patch(
        "api.v1.ppt.endpoints.slide_to_html.generate_html_from_slide",
        new=AsyncMock(
            return_value="```html\n<div>\n  <h1>Title</h1>\n  <p>Body text</p>\n</div>\n```"
        ),
    ):
        result = asyncio.run(
            convert_slide_to_html(
                SlideToHtmlRequest(
                    image="/app_data/images/slide.png",
                    xml="<slide />",
                )
            )
        )

    normalized = normalize_payload(result.model_dump(mode="json"))
    assert normalized == load_snapshot("slide_to_html_response.json")
