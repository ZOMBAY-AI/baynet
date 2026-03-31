"""
ZOMBAY NudeNet Blur Service — Cloud Run microservice.

Accepts a base64 PNG/JPEG, detects explicit regions with NudeNet,
blurs only those regions, returns the blurred image as base64.

Endpoint:
  POST /blur
  Body: { "image": "<base64>", "mime_type": "image/png" }
  Response: { "blurred": "<base64>", "regions": [...], "has_explicit": true/false }

Runs on CPU — no GPU needed. NudeNet ONNX model is ~150MB.
"""

import base64
import io
import os
import time

from flask import Flask, request, jsonify
from nudenet import NudeDetector
from PIL import Image, ImageFilter, ImageDraw

app = Flask(__name__)

# Pre-load NudeNet at startup (not per-request)
print("[nudenet] Loading detector...")
detector = NudeDetector()
print("[nudenet] Ready")

# Explicit regions to blur
BLUR_CLASSES = {
    "FEMALE_BREAST_EXPOSED",
    "MALE_BREAST_EXPOSED",
    "FEMALE_GENITALIA_EXPOSED",
    "MALE_GENITALIA_EXPOSED",
    "BUTTOCKS_EXPOSED",
    "ANUS_EXPOSED",
}

BLUR_RADIUS = 40
EXPAND_PX = 30
MIN_SCORE = 0.3


@app.route("/blur", methods=["POST"])
def blur_image():
    t0 = time.time()
    data = request.get_json()

    if not data or "image" not in data:
        return jsonify({"error": "Missing 'image' field (base64)"}), 400

    try:
        image_bytes = base64.b64decode(data["image"])
    except Exception:
        return jsonify({"error": "Invalid base64"}), 400

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = img.size

    # Save to temp file for NudeNet
    import tempfile
    from pathlib import Path

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        img.save(tmp, format="PNG")
        tmp_path = tmp.name

    try:
        detections = detector.detect(tmp_path)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    # Filter to explicit regions
    regions = [
        {
            "class": d["class"],
            "score": round(d["score"], 3),
            "box": d["box"],
        }
        for d in detections
        if d["class"] in BLUR_CLASSES and d["score"] >= MIN_SCORE
    ]

    has_explicit = len(regions) > 0

    if not has_explicit:
        # No explicit content — return original
        return jsonify({
            "blurred": data["image"],  # return as-is
            "regions": [],
            "has_explicit": False,
            "processing_ms": round((time.time() - t0) * 1000),
            "width": w,
            "height": h,
        })

    # Create blurred version — only blur explicit regions
    fully_blurred = img.filter(ImageFilter.GaussianBlur(radius=BLUR_RADIUS))

    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)

    for det in regions:
        box = det["box"]  # [x, y, width, height]
        x, y, bw, bh = box
        x1 = max(0, x - EXPAND_PX)
        y1 = max(0, y - EXPAND_PX)
        x2 = min(w, x + bw + EXPAND_PX)
        y2 = min(h, y + bh + EXPAND_PX)
        draw.ellipse([x1, y1, x2, y2], fill=255)

    # Smooth mask edges
    mask = mask.filter(ImageFilter.GaussianBlur(radius=EXPAND_PX // 2))

    # Composite: original where mask=0, blurred where mask=255
    result = Image.composite(fully_blurred, img, mask)

    buf = io.BytesIO()
    result.save(buf, format="PNG")
    blurred_b64 = base64.b64encode(buf.getvalue()).decode()

    return jsonify({
        "blurred": blurred_b64,
        "regions": regions,
        "has_explicit": True,
        "processing_ms": round((time.time() - t0) * 1000),
        "width": w,
        "height": h,
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "nudenet"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
