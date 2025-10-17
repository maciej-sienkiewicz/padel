#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(VideoMerger, NSObject)

RCT_EXTERN_METHOD(mergeVideos:(NSArray<NSString *> *)videoPaths
                  outputPath:(NSString *)outputPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
