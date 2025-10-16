import Foundation
import AVFoundation
import React

@objc(VideoMerger)
class VideoMerger: NSObject {

  /**
   * Łączy wiele plików wideo w jeden
   * @param videoPaths - tablica ścieżek do plików MP4
   * @param outputPath - ścieżka gdzie zapisać wynikowy plik
   * @param resolver - Promise resolve callback
   * @param rejecter - Promise reject callback
   */
  @objc
  func mergeVideos(_ videoPaths: [String],
                   outputPath: String,
                   resolver: @escaping RCTPromiseResolveBlock,
                   rejecter: @escaping RCTPromiseRejectBlock) {

    // Sprawdź czy są pliki do połączenia
    guard !videoPaths.isEmpty else {
      rejecter("EMPTY_INPUT", "No video paths provided", nil)
      return
    }

    print("🎬 Starting video merge...")
    print("📹 Input videos: \(videoPaths.count)")

    // Stwórz composition
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

    // Dodaj każdy segment do composition
    for (index, videoPath) in videoPaths.enumerated() {
      let url = URL(fileURLWithPath: videoPath)

      // Sprawdź czy plik istnieje
      guard FileManager.default.fileExists(atPath: videoPath) else {
        print("⚠️ File not found: \(videoPath)")
        continue
      }

      let asset = AVAsset(url: url)

      guard let videoAssetTrack = asset.tracks(withMediaType: .video).first else {
        print("⚠️ No video track in: \(videoPath)")
        continue
      }

      // Zachowaj rozmiar i frame rate z pierwszego wideo
      if videoSize == nil {
        videoSize = videoAssetTrack.naturalSize
        frameRate = videoAssetTrack.nominalFrameRate
        print("📐 Video size: \(videoSize!)")
        print("🎞️ Frame rate: \(frameRate!)")
      }

      do {
        // Dodaj video track
        let timeRange = CMTimeRange(start: .zero, duration: asset.duration)
        try videoTrack.insertTimeRange(
          timeRange,
          of: videoAssetTrack,
          at: insertTime
        )

        // Dodaj audio track (jeśli istnieje)
        if let audioAssetTrack = asset.tracks(withMediaType: .audio).first {
          try audioTrack.insertTimeRange(
            timeRange,
            of: audioAssetTrack,
            at: insertTime
          )
        }

        print("✅ Added segment \(index + 1)/\(videoPaths.count)")

        insertTime = CMTimeAdd(insertTime, asset.duration)

      } catch {
        print("❌ Error adding segment \(index + 1): \(error.localizedDescription)")
        rejecter("INSERT_ERROR", "Failed to insert video track: \(error.localizedDescription)", error)
        return
      }
    }

    // Sprawdź czy mamy jakiekolwiek wideo
    guard insertTime > .zero else {
      rejecter("NO_VIDEO", "No valid video segments found", nil)
      return
    }

    print("⏱️ Total duration: \(CMTimeGetSeconds(insertTime))s")

    let outputURL = URL(fileURLWithPath: outputPath)

    // Usuń istniejący plik
    try? FileManager.default.removeItem(at: outputURL)

    // Stwórz exporter
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

    // Ustaw video composition dla poprawnego rozmiaru
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

    print("🔄 Exporting video...")

    // Eksportuj wideo
    exporter.exportAsynchronously {
      DispatchQueue.main.async {
        switch exporter.status {
        case .completed:
          print("✅ Video merge completed!")
          print("📁 Output: \(outputPath)")

          // Sprawdź rozmiar pliku
          if let attributes = try? FileManager.default.attributesOfItem(atPath: outputPath),
             let fileSize = attributes[.size] as? Int64 {
            print("📦 File size: \(fileSize / 1024 / 1024)MB")
          }

          resolver(outputPath)

        case .failed:
          let errorMsg = exporter.error?.localizedDescription ?? "Unknown error"
          print("❌ Export failed: \(errorMsg)")
          rejecter("EXPORT_FAILED", "Video export failed: \(errorMsg)", exporter.error)

        case .cancelled:
          print("⚠️ Export cancelled")
          rejecter("CANCELLED", "Video export was cancelled", nil)

        default:
          print("❌ Unknown export status")
          rejecter("UNKNOWN_ERROR", "Unknown export error", nil)
        }
      }
    }
  }

  /**
   * Wymaga uruchomienia na main queue
   */
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}