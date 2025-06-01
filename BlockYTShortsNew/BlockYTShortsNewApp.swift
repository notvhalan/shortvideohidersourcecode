//
//  BlockYTShortsNewApp.swift
//  BlockYTShortsNew
//
//  Created by vhalan on 09/05/2025.
//

import SwiftUI

@main
struct BlockYTShortsNewApp: App {
    // Create and manage the lifecycle of StoreManager here
    // @StateObject ensures it's kept alive for the app's lifecycle
    @StateObject var storeManager = StoreManager()

    var body: some Scene {
        WindowGroup {
            ContentView() // Your main content view
                // Make StoreManager available to ContentView and all its children
                .environmentObject(storeManager)
                .onAppear {
                    Task {
                        // Load IAP products and set initial app icon when the app starts
                        // This will now correctly use the storeManager instance created above
                        await storeManager.loadProducts()
                    }
                }
        }
    }
}
