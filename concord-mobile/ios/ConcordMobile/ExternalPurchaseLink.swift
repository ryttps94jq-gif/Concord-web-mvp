// ExternalPurchaseLink.swift
// Native bridge for Apple's StoreKit External Purchase Link API.
// Triggers Apple's mandatory disclosure sheet before opening an external checkout URL.
// Required for App Store compliance when using external payment links (Epic v. Apple).

import Foundation
import StoreKit
import UIKit

@objc(ExternalPurchaseLink)
class ExternalPurchaseLink: NSObject {

  @objc
  func open(_ urlString: String,
            resolver resolve: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock) {

    guard let url = URL(string: urlString) else {
      reject("INVALID_URL", "Invalid checkout URL", nil)
      return
    }

    if #available(iOS 16.0, *) {
      Task { @MainActor in
        do {
          // Triggers Apple's mandatory disclosure sheet:
          // "You're about to leave [App Name]" with Continue and Cancel buttons.
          // This is REQUIRED by Apple for External Purchase Link Entitlement compliance.
          try await ExternalPurchaseLink.open(url: url)
          resolve(true)
        } catch {
          reject("USER_CANCELLED", "User cancelled external purchase", error)
        }
      }
    } else {
      // Fallback for iOS < 16: open URL directly in Safari
      DispatchQueue.main.async {
        UIApplication.shared.open(url, options: [:]) { success in
          if success {
            resolve(true)
          } else {
            reject("OPEN_FAILED", "Failed to open URL", nil)
          }
        }
      }
    }
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
