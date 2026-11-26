//
//  SafariWebExtensionHandler.swift
//  SWEEPR DeepBlock
//
//  Copyright (c) 2026 Benjamin Cook (SWEEPR DeepBlock). All rights reserved.
//  Proprietary and confidential. Unauthorized copying, distribution, or
//  open-source redistribution is strictly prohibited.
//

import SafariServices
import os.log

private let extensionBundleIdentifier = "com.sweeprdeepblock.safari"
private let extensionVersion = "1.4.0"
private let proprietaryCopyright = "Copyright (c) 2026 Benjamin Cook (SWEEPR DeepBlock). All rights reserved."

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    private let logger = OSLog(subsystem: extensionBundleIdentifier, category: "WebExtension")

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem
        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(
            .default,
            log: logger,
            "Received native message from Safari Web Extension (profile: %{public}@): %{public}@",
            profile?.uuidString ?? "default",
            String(describing: message)
        )

        var payload: [String: Any] = [
            "ok": true,
            "version": extensionVersion,
            "bundleId": extensionBundleIdentifier,
            "copyright": proprietaryCopyright
        ]

        if let dict = message as? [String: Any], let action = dict["action"] as? String {
            switch action {
            case "ping":
                payload["pong"] = true
                payload["timestamp"] = Int(Date().timeIntervalSince1970 * 1000)
            case "getAppMetadata":
                payload["platform"] = currentPlatformName()
                payload["marketingVersion"] = extensionVersion
                payload["appGroup"] = "group.com.sweeprdeepblock.safari"
            default:
                payload["echo"] = action
            }
        }

        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [SFExtensionMessageKey: payload]
        } else {
            response.userInfo = ["message": payload]
        }

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

    private func currentPlatformName() -> String {
        #if os(macOS)
        return "macOS"
        #elseif os(iOS)
        return "iOS"
        #else
        return "Apple"
        #endif
    }
}
