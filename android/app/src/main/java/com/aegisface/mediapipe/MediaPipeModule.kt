package com.aegisface.mediapipe

import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule

/**
 * AegisFaceMediaPipe — React Native TurboModule (legacy bridge compatible)
 *
 * Wraps the MediaPipe Tasks FaceDetector + FaceLandmarker.
 *
 * Build dependencies (add to android/app/build.gradle):
 *   implementation 'com.google.mediapipe:tasks-vision:0.10.14'
 *
 * TODO(human): Follow ARCHITECTURE.md §Native-MediaPipe-Android to:
 *   1. Add the MediaPipe dependency to build.gradle
 *   2. Download face_landmarker.task from MediaPipe Model Cards
 *      (Apache-2.0) and copy to android/app/src/main/assets/
 *   3. Un-comment the real implementation below and remove the stub.
 *
 * The stub below passes through to the JS fallback in MediaPipeModule.ts
 * (returns empty array). The JS stub in MediaPipeModule.ts provides a
 * placeholder face for UI testing.
 */
@ReactModule(name = MediaPipeModule.NAME)
class MediaPipeModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "AegisFaceMediaPipe"
    }

    override fun getName(): String = NAME

    /**
     * Detect faces + landmarks in a raw pixel buffer.
     *
     * @param pixelData  ArrayBuffer of RGB / YUV pixel data (from VisionCamera Frame)
     * @param width      Frame width in pixels
     * @param height     Frame height in pixels
     * @param format     "rgb" | "yuv" | "bgr"
     * @return           WritableArray of face result objects
     */
    @ReactMethod
    fun detectFaces(
        pixelData: ReadableMap,
        width: Int,
        height: Int,
        format: String,
        promise: Promise
    ) {
        // ── STUB ──────────────────────────────────────────────────────────────
        // Returns an empty array; the JS layer (MediaPipeModule.ts) falls back
        // to a placeholder face for UI testing.
        //
        // ── REAL IMPLEMENTATION (un-comment after adding MediaPipe dep) ──────
        // try {
        //     val context = reactContext.applicationContext
        //     val options = FaceLandmarkerOptions.builder()
        //         .setBaseOptions(
        //             BaseOptions.builder()
        //                 .setModelAssetPath("face_landmarker.task")
        //                 .build()
        //         )
        //         .setRunningMode(RunningMode.IMAGE)
        //         .setNumFaces(1)
        //         .setOutputFaceBlendshapes(true)
        //         .build()
        //     val faceLandmarker = FaceLandmarker.createFromOptions(context, options)
        //
        //     val bytes = pixelData.getArray("bytes")!! /* from JS ArrayBuffer bridge */
        //     val bitmap = decodeToBitmap(bytes, width, height, format)
        //     val mpImage = BitmapImageBuilder(bitmap).build()
        //     val result = faceLandmarker.detect(mpImage)
        //
        //     val faces = Arguments.createArray()
        //     for (face in result.faceLandmarks()) {
        //         val faceMap = Arguments.createMap()
        //         val landmarks = Arguments.createArray()
        //         for (lm in face) {
        //             val pt = Arguments.createArray()
        //             pt.pushDouble(lm.x().toDouble())
        //             pt.pushDouble(lm.y().toDouble())
        //             landmarks.pushArray(pt)
        //         }
        //         faceMap.putArray("landmarks", landmarks)
        //         faceMap.putDouble("score", 0.99)
        //         faceMap.putArray("bbox", computeBbox(face))
        //         faces.pushMap(faceMap)
        //     }
        //     promise.resolve(faces)
        // } catch (e: Exception) {
        //     promise.reject("MEDIAPIPE_ERROR", e.message, e)
        // }
        // ─────────────────────────────────────────────────────────────────────

        promise.resolve(Arguments.createArray()) // empty → JS stub takes over
    }
}
