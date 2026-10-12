#!/usr/bin/env bash
# Download all required model files for AegisFace.
#
# Run from the project root:
#   bash tools/download_models.sh
#
# Models downloaded:
#   models/face_landmarker.task   — MediaPipe FaceLandmarker   (Apache-2.0)
#   models/mobilefacenet_int8.tflite — MobileFaceNet embedder  (Apache-2.0)
#
# Optional (enable ENABLE_PASSIVE_ANTISPOOF in constants.ts to use):
#   models/minifasnet_int8.tflite — MiniFASNet anti-spoof      (Apache-2.0)
#
# After running this script complete the checklist in models/README.md.

set -euo pipefail

MODELS_DIR="$(cd "$(dirname "$0")/.." && pwd)/models"
ANDROID_ASSETS="$(cd "$(dirname "$0")/.." && pwd)/android/app/src/main/assets"

echo "→ Creating models/ directory..."
mkdir -p "$MODELS_DIR"
mkdir -p "$ANDROID_ASSETS"

# ─── face_landmarker.task ─────────────────────────────────────────────────────
LANDMARKER_URL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
LANDMARKER_FILE="$MODELS_DIR/face_landmarker.task"

if [ -f "$LANDMARKER_FILE" ]; then
  echo "✓ face_landmarker.task already present — skipping"
else
  echo "→ Downloading face_landmarker.task (~11 MB)..."
  curl -L --fail --progress-bar -o "$LANDMARKER_FILE" "$LANDMARKER_URL"
  echo "✓ face_landmarker.task downloaded"
fi

# Copy to Android assets (needed at runtime)
echo "→ Copying face_landmarker.task to Android assets..."
cp "$LANDMARKER_FILE" "$ANDROID_ASSETS/face_landmarker.task"
echo "✓ Copied to $ANDROID_ASSETS"

# ─── mobilefacenet_int8.tflite ────────────────────────────────────────────────
# Official model from InsightFace model zoo — INT8 quantised.
# See models/README.md Option C for the ONNX-to-TFLite conversion path.
MOBILEFACENET_URL="https://github.com/deepinsight/insightface/releases/download/v0.7/mobilefacenet_int8.tflite"
MOBILEFACENET_FILE="$MODELS_DIR/mobilefacenet_int8.tflite"

if [ -f "$MOBILEFACENET_FILE" ]; then
  echo "✓ mobilefacenet_int8.tflite already present — skipping"
else
  echo "→ Downloading mobilefacenet_int8.tflite (~5 MB)..."
  # Attempt direct download; fall back with a helpful message on 404
  if curl -L --fail --progress-bar -o "$MOBILEFACENET_FILE" "$MOBILEFACENET_URL" 2>/dev/null; then
    echo "✓ mobilefacenet_int8.tflite downloaded"
  else
    echo ""
    echo "⚠  Auto-download of mobilefacenet_int8.tflite failed."
    echo "   Please convert manually (see models/README.md Option C)"
    echo "   or download from the InsightFace model zoo and rename to:"
    echo "   $MOBILEFACENET_FILE"
    echo ""
  fi
fi

# ─── minifasnet_int8.tflite (optional) ────────────────────────────────────────
MINIFASNET_URL="https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/raw/master/resources/anti_spoof_models/4_0_0_80x80_MiniFASNetV2.onnx"
MINIFASNET_FILE="$MODELS_DIR/minifasnet_int8.tflite"

if [ -f "$MINIFASNET_FILE" ]; then
  echo "✓ minifasnet_int8.tflite already present — skipping"
else
  echo ""
  echo "ℹ  minifasnet_int8.tflite not downloaded (optional)."
  echo "   To enable passive anti-spoof:"
  echo "   1. Convert ONNX → TFLite INT8 (see models/README.md)"
  echo "   2. Place at: $MINIFASNET_FILE"
  echo "   3. Set ENABLE_PASSIVE_ANTISPOOF = true in src/config/constants.ts"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "─── Next steps ──────────────────────────────────────────────────────────"
echo "  1. For iOS: open Xcode → drag face_landmarker.task into the project"
echo "     (Target: AegisFace, Copy items if needed ✓)"
echo "  2. Set USE_MOCK_EMBEDDER = false in src/config/constants.ts"
echo "     (only after mobilefacenet_int8.tflite is in models/)"
echo "  3. Build: npm run android   or   npm run ios"
echo "  4. Home screen should show  🟢 TFLite  and  🟢 Native"
echo "─────────────────────────────────────────────────────────────────────────"
