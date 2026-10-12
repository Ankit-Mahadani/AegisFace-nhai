package com.aegisface.mediapipe

import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule

/**
 * Stub MediaPipe module — MediaPipe dependency removed to reduce APK size.
 * The JS layer falls back to its built-in centre-crop stub when this module
 * returns an empty result.
 */
@ReactModule(name = MediaPipeModule.NAME)
class MediaPipeModule(reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "AegisFaceMediaPipe"
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun detectFaces(
        pixelDataBase64: String,
        width: Int,
        height: Int,
        format: String,
        promise: Promise
    ) {
        promise.resolve(Arguments.createArray())
    }
}
