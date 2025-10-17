#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(VideoMerger, NSObject)

// Existing function - merge multiple videos (full segments)
RCT_EXTERN_METHOD(mergeVideos:(NSArray<NSString *> *)videoPaths
                  outputPath:(NSString *)outputPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Existing function - extract precise clip with passthrough (fast but may have jitter)
RCT_EXTERN_METHOD(extractPreciseClip:(NSArray<NSString *> *)videoPaths
                  startTimeSeconds:(double)startTimeSeconds
                  durationSeconds:(double)durationSeconds
                  outputPath:(NSString *)outputPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// 🆕 NEW FUNCTION - merge precise clip with re-encoding (seamless, no jitter)
// UPDATED: Now properly handles video orientation and transform
RCT_EXTERN_METHOD(mergePreciseClip:(NSArray<NSString *> *)videoPaths
                  globalStartTime:(double)globalStartTime
                  durationSeconds:(double)durationSeconds
                  segmentStartTimes:(NSArray<NSNumber *> *)segmentStartTimes
                  outputPath:(NSString *)outputPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end