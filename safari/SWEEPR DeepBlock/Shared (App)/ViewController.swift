//
//  ViewController.swift
//  SWEEPR DeepBlock
//
//  Copyright (c) 2026 Benjamin Cook (SWEEPR DeepBlock). All rights reserved.
//  Proprietary and confidential. Unauthorized copying, distribution, or
//  open-source redistribution is strictly prohibited.
//

import WebKit

#if os(iOS)
import UIKit
typealias PlatformViewController = UIViewController
#elseif os(macOS)
import Cocoa
import SafariServices
typealias PlatformViewController = NSViewController
#endif

private let extensionBundleIdentifier = "com.sweeprdeepblock.safari.Extension"

class ViewController: PlatformViewController, WKNavigationDelegate, WKScriptMessageHandler {
    private var webView: WKWebView!

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "controller")
        let createdWebView = WKWebView(frame: .zero, configuration: config)
        createdWebView.navigationDelegate = self
        self.webView = createdWebView
        self.view = createdWebView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        #if os(iOS)
        webView.scrollView.isScrollEnabled = true
        #endif

        if let url = Bundle.main.url(forResource: "Main", withExtension: "html") {
            webView.loadFileURL(url, allowingReadAccessTo: Bundle.main.resourceURL ?? url.deletingLastPathComponent().deletingLastPathComponent())
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        #if os(iOS)
        webView.evaluateJavaScript("show('ios')")
        #elseif os(macOS)
        webView.evaluateJavaScript("show('mac')")

        SFSafariApplication.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { state, error in
            guard let state = state, error == nil else {
                return
            }

            DispatchQueue.main.async {
                if #available(macOS 13, *) {
                    webView.evaluateJavaScript("show('mac', \(state.isEnabled), true)")
                } else {
                    webView.evaluateJavaScript("show('mac', \(state.isEnabled), false)")
                }
            }
        }
        #endif
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        #if os(macOS)
        guard let body = message.body as? String, body == "open-preferences" else {
            return
        }

        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            guard error == nil else {
                return
            }

            DispatchQueue.main.async {
                NSApplication.shared.terminate(nil)
            }
        }
        #endif
    }
}
