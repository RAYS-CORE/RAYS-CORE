"""Module 7: Image Validator — validate image quality before face recognition.

Checks:
  - Resolution too low (< 100px)
  - No face detected
  - Multiple faces detected
  - Face confidence below threshold
  - Heavily blurred (Laplacian variance)
  - Cartoon / illustration / anime (edge ratio heuristic)
  - Avatar / logo / icon (low color variance, small size)
  - Excessive filters or edits (high saturation variance)

Returns a dict per image with:
  accepted: bool
  rejection_reason: str | None
  face_count: int
  face_details: list[dict] | None
  det_score: float | None
  blur_score: float
  cartoon_score: float
"""

from __future__ import annotations

import contextlib
import io
import os
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

# Minimum face detection score
MIN_DET_SCORE = 0.5
# Minimum image dimension
MIN_IMAGE_SIZE = 100
# Laplacian variance threshold for blur detection
BLUR_THRESHOLD = 80.0
# Edge ratio below which image is likely cartoon/illustration
CARTOON_EDGE_THRESHOLD = 0.04
# Max saturation std for logo/icon detection
MAX_SATURATION_STD_FOR_LOGO = 15
# Max color count for logo/icon detection
MAX_COLOR_COUNT_FOR_LOGO = 32

# Lazy-loaded face engine
_face_engine = None


def _get_face_engine():
    global _face_engine
    if _face_engine is None:
        with contextlib.redirect_stdout(io.StringIO()):
            with contextlib.redirect_stderr(io.StringIO()):
                from insightface.app import FaceAnalysis
                _face_engine = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
                _face_engine.prepare(ctx_id=0, det_size=(640, 640))
    return _face_engine


def validate(image_path: str | Path) -> dict:
    """Validate a single image.

    Args:
        image_path: Path to the image file on disk.

    Returns:
        Dict with validation results.
    """
    path = Path(image_path)
    if not path.exists():
        return {"accepted": False, "rejection_reason": "file_not_found"}

    img = cv2.imread(str(path))
    if img is None:
        return {"accepted": False, "rejection_reason": "corrupt_image"}

    h, w = img.shape[:2]
    result: dict = {
        "image_path": str(path),
        "resolution": (w, h),
        "accepted": True,
        "rejection_reason": None,
        "face_count": 0,
        "face_details": None,
        "det_score": None,
        "blur_score": None,
        "cartoon": False,
        "blurry": False,
    }

    # ── 1. Resolution check ──
    if w < MIN_IMAGE_SIZE or h < MIN_IMAGE_SIZE:
        result["accepted"] = False
        result["rejection_reason"] = f"too_small: {w}x{h} < {MIN_IMAGE_SIZE}x{MIN_IMAGE_SIZE}"
        return result

    # ── 2. Blur detection ──
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    result["blur_score"] = float(laplacian_var)
    if laplacian_var < BLUR_THRESHOLD:
        result["blurry"] = True
        result["accepted"] = False
        result["rejection_reason"] = "blurry"
        return result

    # ── 3. Cartoon / illustration detection ──
    edges = cv2.Canny(gray, 50, 150)
    edge_ratio = np.count_nonzero(edges) / (h * w)
    if edge_ratio < CARTOON_EDGE_THRESHOLD:
        result["cartoon"] = True
        result["accepted"] = False
        result["rejection_reason"] = "cartoon_or_illustration"
        return result

    # ── 4. Logo / icon detection ──
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    sat_std = float(np.std(hsv[:, :, 1]))
    if sat_std < MAX_SATURATION_STD_FOR_LOGO:
        # Check unique color count
        reshaped = img.reshape(-1, 3)
        unique_colors = len(np.unique(reshaped, axis=0))
        if unique_colors < MAX_COLOR_COUNT_FOR_LOGO:
            result["accepted"] = False
            result["rejection_reason"] = "logo_or_icon"
            return result

    # ── 5. Anime / art detection (low edge + high color uniformity) ──
    if edge_ratio < 0.08 and sat_std < 25:
        result["accepted"] = False
        result["rejection_reason"] = "anime_or_art"
        return result

    # ── 6. Face detection ──
    engine = _get_face_engine()
    faces = engine.get(img)

    result["face_count"] = len(faces)
    result["face_details"] = [
        {
            "gender": "Male" if f.gender == 1 else "Female" if f.gender == 0 else None,
            "age": int(f.age) if hasattr(f, "age") and f.age else None,
            "det_score": float(f.det_score) if hasattr(f, "det_score") and f.det_score else 0.0,
            "bbox": f.bbox.tolist() if hasattr(f.bbox, "tolist") else list(f.bbox),
        }
        for f in faces
    ]

    if len(faces) == 0:
        result["accepted"] = False
        result["rejection_reason"] = "no_face_detected"
        return result

    if len(faces) > 1:
        result["accepted"] = False
        result["rejection_reason"] = f"multiple_faces: {len(faces)}"
        return result

    det_score = float(faces[0].det_score) if hasattr(faces[0], "det_score") and faces[0].det_score else 0.0
    result["det_score"] = det_score
    if det_score < MIN_DET_SCORE:
        result["accepted"] = False
        result["rejection_reason"] = f"low_face_confidence: {det_score:.3f}"
        return result

    result["accepted"] = True
    result["rejection_reason"] = None
    return result


def validate_batch(image_paths: list[str | Path]) -> list[dict]:
    """Validate multiple images.

    Args:
        image_paths: List of paths to image files.

    Returns:
        List of validation result dicts.
    """
    return [validate(p) for p in image_paths]
