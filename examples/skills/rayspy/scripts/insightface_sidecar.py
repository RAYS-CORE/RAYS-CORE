"""InsightFace sidecar — download image from URL, detect faces, output JSON.

Usage:
  python insightface_sidecar.py --input <image_url> --output-format json
"""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import sys
import tempfile
import urllib.request
from pathlib import Path


def download_image(url: str) -> Path:
    tmp = Path(tempfile.mkdtemp()) / "input.jpg"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "RAYSpy/1.0 (educational project)"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        tmp.write_bytes(resp.read())
    return tmp


def detect_faces(image_path: Path) -> list[dict]:
    # InsightFace prints model-loading logs to stdout/stderr — suppress
    # both so the only stdout output is the final JSON array.
    with contextlib.redirect_stdout(io.StringIO()):
        with contextlib.redirect_stderr(io.StringIO()):
            from insightface.app import FaceAnalysis
            app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
            app.prepare(ctx_id=0, det_size=(640, 640))

    import cv2
    img = cv2.imread(str(image_path))
    if img is None:
        return []

    faces = app.get(img)
    results = []
    for face in faces:
        bbox = face.bbox.tolist() if hasattr(face.bbox, "tolist") else list(face.bbox)
        gender = "Male" if face.gender == 1 else "Female" if face.gender == 0 else None
        age = int(face.age) if face.age else None
        det_score = float(face.det_score) if face.det_score else 0.7
        results.append({
            "label": f"Face detected in image",
            "confidence": det_score,
            "match_score": det_score,
            "gender": gender,
            "age": age,
            "bbox": bbox,
        })
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="InsightFace face detection sidecar")
    parser.add_argument("--input", required=True, help="Image URL or file path")
    parser.add_argument("--output-format", default="json", help="Output format (json)")
    args = parser.parse_args()

    target = args.input
    is_url = target.startswith("http://") or target.startswith("https://")

    try:
        if is_url:
            image_path = download_image(target)
        else:
            image_path = Path(target)
            if not image_path.exists():
                print(json.dumps({"error": f"File not found: {target}"}))
                return 1

        faces = detect_faces(image_path)
        print(json.dumps(faces))
        return 0
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
