// Objective-C bridge — exports the Swift module to React Native.
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AegisFaceMediaPipe, NSObject)

RCT_EXTERN_METHOD(
  detectFaces:(NSString *)pixelDataBase64
  width:(NSInteger)width
  height:(NSInteger)height
  format:(NSString *)format
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

@end
