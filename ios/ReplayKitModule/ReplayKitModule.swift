import Foundation
import ReplayKit
import AVFoundation

@objc(ReplayKitModule)
class ReplayKitModule: NSObject {
  
  private let recorder = RPScreenRecorder.shared()
  private var isBuffering = false
  
  @objc
  func startBuffering(_ resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    
    guard recorder.isAvailable else {
      reject("NOT_AVAILABLE", "ReplayKit is not available on this device", nil)
      return
    }
    
    if isBuffering {
      resolve(["status": "already_buffering"])
      return
    }
    
    // Włącz microphone i camera
    recorder.isMicrophoneEnabled = true
    recorder.isCameraEnabled = true
    
    // Start clip buffering (trzyma ostatnie ~15 minut w pamięci)
    recorder.startClipBuffering { error in
      if let error = error {
        reject("START_ERROR", "Failed to start buffering: \(error.localizedDescription)", error)
        return
      }
      
      self.isBuffering = true
      resolve([
        "status": "success",
        "message": "Clip buffering started"
      ])
    }
  }
  
  @objc
  func stopBuffering(_ resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    
    if !isBuffering {
      resolve(["status": "not_buffering"])
      return
    }
    
    recorder.stopClipBuffering { error in
      if let error = error {
        reject("STOP_ERROR", "Failed to stop buffering: \(error.localizedDescription)", error)
        return
      }
      
      self.isBuffering = false
      resolve([
        "status": "success",
        "message": "Clip buffering stopped"
      ])
    }
  }
  
  @objc
  func exportClip(_ durationSeconds: NSInteger,
                 outputPath: NSString,
                 resolver resolve: @escaping RCTPromiseResolveBlock,
                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    
    guard isBuffering else {
      reject("NOT_BUFFERING", "Clip buffering is not active", nil)
      return
    }
    
    let duration = TimeInterval(durationSeconds)
    let url = URL(fileURLWithPath: outputPath as String)
    
    // Usuń plik jeśli już istnieje
    if FileManager.default.fileExists(atPath: url.path) {
      try? FileManager.default.removeItem(at: url)
    }
    
    // Eksportuj ostatnie N sekund z bufora
    recorder.exportClip(to: url, duration: duration) { error in
      if let error = error {
        // ReplayKit error codes:
        // -5808: No recorded content available (buffer jest pusty)
        // -5823: User declined (użytkownik anulował - ale to nie powinno wystąpić w naszym przypadku)
        let nsError = error as NSError
        
        if nsError.code == -5808 {
          reject("NO_CONTENT", "No recorded content in buffer (recording too short?)", error)
        } else {
          reject("EXPORT_ERROR", "Failed to export clip: \(error.localizedDescription)", error)
        }
        return
      }
      
      // Sprawdź czy plik został utworzony
      guard FileManager.default.fileExists(atPath: url.path) else {
        reject("FILE_NOT_CREATED", "Export succeeded but file was not created", nil)
        return
      }
      
      resolve([
        "status": "success",
        "path": url.path,
        "duration": durationSeconds
      ])
    }
  }
  
  @objc
  func isRecording(_ resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve([
      "isRecording": recorder.isRecording,
      "isBuffering": isBuffering
    ])
  }
  
  @objc
  func isAvailable(_ resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve([
      "available": recorder.isAvailable,
      "cameraEnabled": recorder.isCameraEnabled,
      "microphoneEnabled": recorder.isMicrophoneEnabled
    ])
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
