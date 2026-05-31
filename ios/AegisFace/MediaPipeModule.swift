/**
 * AegisFaceMediaPipe — React Native Native Module (Swift)
 *
 * Wraps MediaPipe Tasks FaceLandmarker for iOS.
 *
 * Setup steps (run on macOS):
 *   1. Add to Podfile:
 *        pod 'MediaPipeTasksVision', '~> 0.10.14'
 *   2. Download face_landmarker.task from MediaPipe Model Cards (Apache-2.0)
 *      and add to the Xcode project (copy to app bundle).
 *   3. Un-comment the real implementation below.
 *
 * TODO(human): Follow ARCHITECTURE.md §Native-MediaPipe-iOS to activate.
 */
import Foundation
import React

@objc(AegisFaceMediaPipe)
class MediaPipeModule: NSObject {

    @objc
    static func requiresMainQueueSetup() -> Bool { false }

    /**
     * detectFaces — synchronous pixel-buffer face detection.
     *
     * Parameters match the Android side exactly so the JS bridge
     * (src/native/MediaPipeModule.ts) is platform-agnostic.
     */
    @objc
    func detectFaces(
        _ pixelData: [String: Any],
        width: Int,
        height: Int,
        format: String,
        resolve: RCTPromiseResolveBlock,
        reject: RCTPromiseRejectBlock
    ) {
        // ── STUB ──────────────────────────────────────────────────────────────
        // Returns an empty array; the JS layer falls back to a placeholder face.
        //
        // ── REAL IMPLEMENTATION (un-comment after adding MediaPipe pod) ──────
        // do {
        //     let options = try FaceLandmarkerOptions()
        //     options.baseOptions.modelAssetPath = Bundle.main.path(
        //         forResource: "face_landmarker", ofType: "task")!
        //     options.runningMode = .image
        //     options.numFaces = 1
        //     options.outputFaceBlendshapes = true
        //
        //     let faceLandmarker = try FaceLandmarker(options: options)
        //     // Convert pixelData bytes → UIImage / MPImage ...
        //     // let result = try faceLandmarker.detect(image: mpImage)
        //     // ... build faces array and resolve(faces)
        // } catch {
        //     reject("MEDIAPIPE_ERROR", error.localizedDescription, error)
        // }
        // ─────────────────────────────────────────────────────────────────────

        resolve([]) // empty → JS stub takes over
    }
}
