//
//  SceneDelegate.swift
//  SWEEPR DeepBlock (iOS)
//
//  Copyright (c) 2026 Benjamin Cook (SWEEPR DeepBlock). All rights reserved.
//  Proprietary and confidential. Unauthorized copying, distribution, or
//  open-source redistribution is strictly prohibited.
//

import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else {
            return
        }

        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = ViewController()
        self.window = window
        window.makeKeyAndVisible()
    }
}
