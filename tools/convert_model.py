#!/usr/bin/env python3
"""
convert_model.py — MobileFaceNet to INT8 TFLite converter

Usage:
  pip install onnx tf2onnx tensorflow
  python tools/convert_model.py <input.onnx|input.h5> <output.tflite>

If no args are given, prints usage and exits.

────────────────────────────────────────────────────────────────────────────
TODO(human): Provide one of the following as the source model:
  - A Keras .h5 file (MobileFaceNet trained on MS1M or CASIA)
  - An ONNX file exported from PyTorch
  - A SavedModel directory

The script handles all three input formats automatically.
────────────────────────────────────────────────────────────────────────────
"""

import sys
import os
import pathlib
import numpy as np

INPUT_SIZE = 112   # MobileFaceNet canonical input
EMBEDDING_DIM = 128
CALIB_SAMPLES = 200  # representative dataset size for INT8 calibration


def print_usage():
    print(__doc__)
    print("Example:")
    print("  python tools/convert_model.py mobilefacenet.onnx models/mobilefacenet_int8.tflite")


# ─── Representative dataset generator ────────────────────────────────────────

def representative_dataset():
    """
    Generates random face-like crops for calibration.
    Replace with real crops from your dataset for better accuracy.
    """
    for _ in range(CALIB_SAMPLES):
        # MobileFaceNet expects (1, 112, 112, 3) float32 in [-1, 1]
        sample = np.random.uniform(-1.0, 1.0, (1, INPUT_SIZE, INPUT_SIZE, 3)).astype(np.float32)
        yield [sample]


# ─── Converters ──────────────────────────────────────────────────────────────

def convert_keras(h5_path: str, out_path: str):
    import tensorflow as tf
    print(f"[1/4] Loading Keras model from {h5_path} …")
    model = tf.keras.models.load_model(h5_path, compile=False)
    model.summary()

    print("[2/4] Converting to TFLite with INT8 post-training quantisation …")
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = representative_dataset
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.uint8
    converter.inference_output_type = tf.float32  # keep output as float32

    tflite_model = converter.convert()
    _write(out_path, tflite_model)


def convert_onnx(onnx_path: str, out_path: str):
    import tensorflow as tf
    print(f"[1/4] Converting ONNX → TF SavedModel …")
    import subprocess, tempfile
    saved_model_dir = tempfile.mkdtemp(prefix="aegis_tf_")
    subprocess.run(
        [sys.executable, "-m", "tf2onnx.convert",
         "--onnx", onnx_path,
         "--output", saved_model_dir + "/model.pb",
         "--saved-model", saved_model_dir],
        check=True,
    )
    print("[2/4] Converting SavedModel → INT8 TFLite …")
    converter = tf.lite.TFLiteConverter.from_saved_model(saved_model_dir)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = representative_dataset
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_output_type = tf.float32
    tflite_model = converter.convert()
    _write(out_path, tflite_model)


def convert_saved_model(sm_dir: str, out_path: str):
    import tensorflow as tf
    print(f"[1/4] Loading SavedModel from {sm_dir} …")
    converter = tf.lite.TFLiteConverter.from_saved_model(sm_dir)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = representative_dataset
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_output_type = tf.float32
    print("[2/4] Converting to INT8 TFLite …")
    tflite_model = converter.convert()
    _write(out_path, tflite_model)


def _write(out_path: str, tflite_model: bytes):
    pathlib.Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(tflite_model)
    size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"[3/4] Written: {out_path}")
    print(f"[4/4] Model size: {size_mb:.2f} MB  (target ≤ 8 MB)")
    if size_mb > 8:
        print("⚠️  Model exceeds 8 MB target — consider more aggressive quantisation.")
    else:
        print("✅ Size OK")
    _verify(out_path)


def _verify(out_path: str):
    """Quick sanity-check: run one forward pass and print output shape."""
    import tensorflow as tf
    interp = tf.lite.Interpreter(model_path=out_path)
    interp.allocate_tensors()
    inp = interp.get_input_details()[0]
    out = interp.get_output_details()[0]
    print(f"\nModel IO:")
    print(f"  Input  shape  : {inp['shape']}  dtype={inp['dtype'].__name__}")
    print(f"  Output shape  : {out['shape']}  dtype={out['dtype'].__name__}")
    # One dummy inference
    dummy = np.zeros(inp['shape'], dtype=inp['dtype'])
    interp.set_tensor(inp['index'], dummy)
    interp.invoke()
    result = interp.get_tensor(out['index'])
    # Check L2 norm ~1 (embeddings should be pre-normalised by the model, or we normalise in JS)
    norm = np.linalg.norm(result[0])
    print(f"  Embedding L2 norm: {norm:.4f}  (expect ~1 if model normalises, otherwise we normalise in JS)")


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print_usage()
        sys.exit(1)

    src = sys.argv[1]
    dst = sys.argv[2]

    if not os.path.exists(src):
        print(f"Error: source file/dir '{src}' not found.")
        sys.exit(1)

    ext = pathlib.Path(src).suffix.lower()
    if ext in (".h5", ".keras"):
        convert_keras(src, dst)
    elif ext == ".onnx":
        convert_onnx(src, dst)
    elif os.path.isdir(src):
        convert_saved_model(src, dst)
    else:
        print(f"Unknown format '{ext}'. Supported: .h5, .keras, .onnx, or SavedModel directory.")
        sys.exit(1)
