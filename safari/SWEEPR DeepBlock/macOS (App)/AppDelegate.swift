//
//  AppDelegate.swift
//  SWEEPR DeepBlock (macOS)
//
//  Copyright (c) 2026 Benjamin Cook (SWEEPR DeepBlock). All rights reserved.
//  Proprietary and confidential. Unauthorized copying, distribution, or
//  open-source redistribution is strictly prohibited.
//

import Cocoa

@main
class AppDelegate: NSObject, NSApplicationDelegate {
    private var window: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let viewController = ViewController()
        let contentWindow = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 620, height: 480),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        contentWindow.title = "SWEEPR DeepBlock"
        contentWindow.center()
        contentWindow.contentViewController = viewController
        contentWindow.makeKeyAndOrderFront(nil)
        self.window = contentWindow
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}
