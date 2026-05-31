# AegisFace — Model Files

## Required model (PRIMARY)

| File | Size target | Format | Used by |
|------|-------------|--------|---------|
| `mobilefacenet_int8.tflite` | ~5 MB | INT8-quantised TFLite | `TfliteFaceEmbedder` |

## Optional model (passive anti-spoof)

| File | Size target | Format | Used by |
|------|-------------|--------|---------|
| `minifasnet_int8.tflite` | ~2 MB | INT8-quantised TFLite | `PassiveAntiSpoof` hook |

---

## Where to get MobileFaceNet weights

**Option A — ArcFace community weights (Apache-2.0 compatible):**
```
https://github.com/deepinsight/insightface  (model zoo → MobileFaceNet)
```

**Option B — TensorFlow Hub (Apache-2.0):**
```
https://tfhub.dev/google/facenet/1
```

**Option C — Convert from ONNX (recommended, cleanest pipeline):**
1. Clone https://github.com/foamliu/MobileFaceNet-PyTorch  
2. Export ONNX: `python export.py --out mobilefacenet.onnx`
3. Run `tools/convert_model.py mobilefacenet.onnx mobilefacenet_int8.tflite`

---

## MediaPipe face-landmarker model (Apache-2.0)

The native MediaPipe module needs `face_landmarker.task` bundled separately:

**Android:** copy to `android/app/src/main/assets/face_landmarker.task`  
**iOS:** add to Xcode project bundle

Download from:
```
https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task
```
(Apache-2.0 licence — see MediaPipe Model Cards page)

---

## Drop-in checklist

1. [ ] `mobilefacenet_int8.tflite` → this directory
2. [ ] `face_landmarker.task` → Android assets + iOS bundle
3. [ ] Set `USE_MOCK_EMBEDDER = false` in `src/config/constants.ts`
4. [ ] Build and run: `npm run android`
5. [ ] Check the Home screen shows "🟢 TFLite" and "🟢 Native"
