//
//  AppDelegate.swift
//  SWEEPR DeepBlock (iOS)
//
//  Copyright (c) 2026 Benjamin Cook (SWEEPR DeepBlock). All rights reserved.
//  Proprietary and confidential. Unauthorized copying, distribution, or
//  open-source redistribution is strictly prohibited.
//

import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        return true
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
