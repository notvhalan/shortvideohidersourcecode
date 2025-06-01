// ContentView.swift
// BlockYTShortsNew
//
// Created by vhalan on 09/05/2025.
//

import SwiftUI

struct ContentView: View {
    // State for presenting the instructions sheet
    @State private var showingInstructions = false
    // State for presenting the Tip Jar sheet
    @State private var showingTipJar = false
    
    // Access the StoreManager from the environment.
    // This assumes StoreManager is provided by a parent view or the App struct.
    @EnvironmentObject var storeManager: StoreManager

    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Image(systemName: "shield.lefthalf.filled.slash") // Example icon for the extension
                    .font(.system(size: 80))
                    .foregroundColor(.accentColor)
                
                Text("BlockYTShorts")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                Text("Enhance your YouTube experience by blocking Shorts and more.")
                    .font(.headline)
                    .multilineTextAlignment(.center)
                    .foregroundColor(.secondary)
                    .padding(.horizontal)

                // Button to show setup instructions
                Button {
                    showingInstructions = true
                } label: {
                    HStack {
                        Image(systemName: "info.circle.fill")
                        Text("View Setup Instructions")
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color.accentColor)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                }
                .padding(.horizontal, 40)

                // Button to open the Tip Jar
                Button {
                    showingTipJar = true
                } label: {
                    HStack {
                        Image(systemName: "gift.fill") // Example icon for Tip Jar
                        Text("Open Tip Jar")
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color.green) // Different color for distinction
                    .foregroundColor(.white)
                    .cornerRadius(10)
                }
                .padding(.horizontal, 40)
                
                Text("Once enabled in Safari Settings, this app doesn't need to be opened regularly.")
                    .font(.caption)
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)
                    .padding(.top) // Add some space above this text

            }
            .padding()
            .navigationTitle("Welcome")
            .navigationBarHidden(true) // Optionally hide nav bar for a cleaner welcome screen
            .sheet(isPresented: $showingInstructions) {
                // Present InstructionsView in a NavigationView for its own title bar and Done button
                NavigationView {
                    InstructionsView()
                        .toolbar {
                            ToolbarItem(placement: .navigationBarTrailing) {
                                Button("Done") {
                                    showingInstructions = false
                                }
                            }
                        }
                }
            }
            .sheet(isPresented: $showingTipJar) {
                // Present TipJarView. It will use the @EnvironmentObject storeManager.
                // TipJarView itself is a NavigationView, so it will have its own title bar.
                TipJarView()
                // No need to explicitly pass .environmentObject(storeManager) here if it's already in the environment
                // from a higher-up view (like the App struct).
            }
            // Task to load products when ContentView appears.
            // This is a good place if ContentView is your main initial view.
            // Alternatively, this can be in your App struct's onAppear.
            .onAppear {
                 Task {
                     if storeManager.products.isEmpty { // Only load if not already loaded
                         await storeManager.loadProducts()
                     }

                 }
            }
        }
    }
}

// Preview needs an EnvironmentObject if the view uses it.
// For previewing purposes, you can create a mock or a real StoreManager.
struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environmentObject(StoreManager()) // Provide a StoreManager for the preview
    }
}
