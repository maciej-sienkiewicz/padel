#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(VideoMerger, NSObject)

// Existing function - merge multiple videos
RCT_EXTERN_METHOD(mergeVideos:(NSArray<NSString *> *)videoPaths
                  outputPath:(NSString *)outputPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// 🆕 NEW FUNCTION - extract precise clip with GOP alignment
RCT_EXTERN_METHOD(extractPreciseClip:(NSArray<NSString *> *)videoPaths
                  startTimeSeconds:(double)startTimeSeconds
                  durationSeconds:(double)durationSeconds
                  outputPath:(NSString *)outputPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end