// Objective-C bridge file required for React Native to export Swift modules.
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AegisFaceMediaPipe, NSObject)

RCT_EXTERN_METHOD(
  detectFaces:(NSDictionary *)pixelData
  width:(NSInteger)width
  height:(NSInteger)height
  format:(NSString *)format
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

@end
