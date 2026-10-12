/**
 * AegisFaceMediaPipe stub — MediaPipe dependency removed to reduce IPA size.
 * Returns an empty face list so the JS layer uses its built-in centre-crop fallback.
 */
import Foundation
import React

@objc(AegisFaceMediaPipe)
class MediaPipeModule: NSObject {

    @objc
    static func requiresMainQueueSetup() -> Bool { false }

    @objc
    func detectFaces(
        _ pixelDataBase64: String,
        width: Int,
        height: Int,
        format: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve([])
    }
}
