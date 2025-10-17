import Foundation
import AVFoundation
import React

@objc(VideoMerger)
class VideoMerger: NSObject {

  @objc
  func mergeVideos(_ videoPaths: [String],
                   outputPath: String,
                   resolver: @escaping RCTPromiseResolveBlock,
                   rejecter: @escaping RCTPromiseRejectBlock) {

    guard !videoPaths.isEmpty else {
      rejecter("EMPTY_INPUT", "No video paths provided", nil)
      return
    }

    // Usuń file:// prefix z ścieżek
    let cleanedPaths = videoPaths.map { path -> String in
      if path.hasPrefix("file://") {
        let cleaned = path.replacingOccurrences(of: "file://", with: "")
        print("🧹 Cleaned path: \(path) -> \(cleaned)")
        return cleaned
      }
      print("✅ Path already clean: \(path)")
      return path
    }
    
    let cleanedOutputPath = outputPath.hasPrefix("file://") 
      ? outputPath.replacingOccurrences(of: "file://", with: "")
      : outputPath

    print("🎬 Starting video merge...")
    print("📹 Input videos: \(cleanedPaths.count)")
    print("📁 Output: \(cleanedOutputPath)")

    let composition = AVMutableComposition()

    guard let videoTrack = composition.addMutableTrack(
      withMediaType: .video,
      preferredTrackID: kCMPersistentTrackID_Invalid
    ),
    let audioTrack = composition.addMutableTrack(
      withMediaType: .audio,
      preferredTrackID: kCMPersistentTrackID_Invalid
    ) else {
      rejecter("TRACK_ERROR", "Failed to create composition tracks", nil)
      return
    }

    var insertTime = CMTime.zero
    var videoSize: CGSize?
    var frameRate: Float64?
    var successfulSegments = 0

    for (index, videoPath) in cleanedPaths.enumerated() {
      print("📹 Processing segment \(index + 1)/\(cleanedPaths.count): \(videoPath)")
      
      let url = URL(fileURLWithPath: videoPath)
      print("🔗 URL created: \(url)")

      // Sprawdź czy plik istnieje
      let exists = FileManager.default.fileExists(atPath: videoPath)
      print("📂 File exists: \(exists)")
      
      guard exists else {
        print("⚠️ File not found: \(videoPath)")
        continue
      }

      let asset = AVAsset(url: url)
      print("🎥 Asset created, loading tracks...")
      
      let videoTracks = asset.tracks(withMediaType: .video)
      print("📊 Video tracks found: \(videoTracks.count)")

      guard let videoAssetTrack = videoTracks.first else {
        print("⚠️ No video track in: \(videoPath)")
        continue
      }

      print("✅ Video track found!")

      if videoSize == nil {
        videoSize = videoAssetTrack.naturalSize
        frameRate = Float64(videoAssetTrack.nominalFrameRate)
        print("📐 Video size: \(videoSize!)")
        print("🎞️ Frame rate: \(frameRate!)")
      }

      do {
        let timeRange = CMTimeRange(start: .zero, duration: asset.duration)
        print("⏱️ Duration: \(CMTimeGetSeconds(asset.duration))s")
        
        try videoTrack.insertTimeRange(
          timeRange,
          of: videoAssetTrack,
          at: insertTime
        )

        if let audioAssetTrack = asset.tracks(withMediaType: .audio).first {
          try audioTrack.insertTimeRange(
            timeRange,
            of: audioAssetTrack,
            at: insertTime
          )
          print("🔊 Audio track added")
        } else {
          print("🔇 No audio track")
        }

        successfulSegments += 1
        print("✅ Added segment \(index + 1)/\(cleanedPaths.count)")
        insertTime = CMTimeAdd(insertTime, asset.duration)

      } catch {
        print("❌ Error adding segment \(index + 1): \(error.localizedDescription)")
        rejecter("INSERT_ERROR", "Failed to insert video track: \(error.localizedDescription)", error)
        return
      }
    }

    print("📊 Successfully processed: \(successfulSegments)/\(cleanedPaths.count) segments")
    print("⏱️ Total duration: \(CMTimeGetSeconds(insertTime))s")

    guard insertTime > .zero else {
      print("❌ No valid segments - insertTime is zero")
      rejecter("NO_VIDEO", "No valid video segments found", nil)
      return
    }

    let outputURL = URL(fileURLWithPath: cleanedOutputPath)
    
    // Usuń istniejący plik
    if FileManager.default.fileExists(atPath: cleanedOutputPath) {
      print("🗑️ Removing existing file")
      try? FileManager.default.removeItem(at: outputURL)
    }

    guard let exporter = AVAssetExportSession(
      asset: composition,
      presetName: AVAssetExportPresetHighestQuality
    ) else {
      rejecter("EXPORTER_ERROR", "Failed to create export session", nil)
      return
    }

    exporter.outputURL = outputURL
    exporter.outputFileType = .mp4
    exporter.shouldOptimizeForNetworkUse = true

    if let size = videoSize, let fps = frameRate {
      let videoComposition = AVMutableVideoComposition()
      videoComposition.renderSize = size
      videoComposition.frameDuration = CMTimeMake(value: 1, timescale: Int32(fps))

      let instruction = AVMutableVideoCompositionInstruction()
      instruction.timeRange = CMTimeRange(start: .zero, duration: composition.duration)

      let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTrack)
      instruction.layerInstructions = [layerInstruction]

      videoComposition.instructions = [instruction]
      exporter.videoComposition = videoComposition
    }

    print("🔄 Starting export...")

    exporter.exportAsynchronously {
      DispatchQueue.main.async {
        switch exporter.status {
        case .completed:
          print("✅ Video merge completed!")
          print("📁 Output: \(cleanedOutputPath)")

          if let attributes = try? FileManager.default.attributesOfItem(atPath: cleanedOutputPath),
             let fileSize = attributes[.size] as? Int64 {
            print("📦 File size: \(fileSize / 1024 / 1024)MB")
          }

          resolver(cleanedOutputPath)

        case .failed:
          let errorMsg = exporter.error?.localizedDescription ?? "Unknown error"
          print("❌ Export failed: \(errorMsg)")
          if let error = exporter.error {
            print("❌ Error details: \(error)")
          }
          rejecter("EXPORT_FAILED", "Video export failed: \(errorMsg)", exporter.error)

        case .cancelled:
          print("⚠️ Export cancelled")
          rejecter("CANCELLED", "Video export was cancelled", nil)

        default:
          print("❌ Unknown export status: \(exporter.status.rawValue)")
          rejecter("UNKNOWN_ERROR", "Unknown export error", nil)
        }
      }
    }
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
