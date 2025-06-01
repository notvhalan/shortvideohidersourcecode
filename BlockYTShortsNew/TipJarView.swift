// TipJarView.swift
// BlockYTShortsNew
//
// Created by vhalan on 10/05/2025.
//

import SwiftUI
import StoreKit // For Product view and AppStore.sync()

struct TipJarView: View {
    @EnvironmentObject var storeManager: StoreManager
    @State private var showInstagramInfoAlert = false
    @State private var isLoadingProducts = false
    @State private var isRestoring = false
    @State private var purchaseErrorMessage: String? = nil
    @State private var showPurchaseErrorAlert = false

    // Helper to get feature descriptions
    private func description(for product: Product) -> String {
        if product.id == ProductID.smallTip {
            return "Unlock: Hide the YouTube logo on video pages for a cleaner interface."
        } else if product.id == ProductID.largeTip {
            return "Includes \"Hide Logo\" perk, plus: Get an Instagram follow from the developer & early beta access to new apps!"
        }
        return product.description // Fallback to App Store Connect description
    }

    var body: some View {
        NavigationView {
            List {
                Section(
                    header: Text("Support Development").font(.headline),
                    footer: Text("Your tips help support ongoing development and new features. Thank you!")
                ) {
                    if isLoadingProducts {
                        HStack {
                            Spacer()
                            ProgressView("Loading Tips...")
                            Spacer()
                        }.padding()
                    } else if storeManager.products.isEmpty {
                        Text("Could not load tips at this moment. Please check your internet connection or StoreKit configuration.")
                            .foregroundColor(.secondary)
                            .padding()
                    }

                    ForEach(storeManager.products.sorted(by: { $0.price < $1.price })) { product in
                        TipRow(
                            product: product,
                            featureDescription: description(for: product), // Pass custom description
                            storeManager: storeManager,
                            onPurchase: handlePurchaseResult
                        )
                    }
                }
                
                // Section for perks explanation if needed, or integrate into product descriptions
                Section(header: Text("What You Get").font(.headline)) {
                    if storeManager.purchasedProductIDs.contains(ProductID.smallTip) || storeManager.purchasedProductIDs.contains(ProductID.largeTip) {
                        Label("Hide YouTube Logo: Enabled", systemImage: "eye.slash.fill")
                    } else {
                        Label("Hide YouTube Logo (Unlock with Small Tip)", systemImage: "eye.slash")
                            .foregroundColor(.gray)
                    }

                    if storeManager.purchasedProductIDs.contains(ProductID.largeTip) {
                        Label("Instagram Follow Bonus: Active", systemImage: "person.crop.circle.badge.checkmark")
                        Label("Big thanks : Enabled", systemImage: "star.circle.fill")
                    } else {
                        Label("Instagram Follow & Beta new Apps Access (Unlock with Large Tip)", systemImage: "star.circle")
                            .foregroundColor(.gray)
                    }
                }


                if storeManager.purchasedProductIDs.contains(ProductID.largeTip) {
                    Section(header: Text("Instagram Follow Bonus").font(.headline)) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Thank you for the generous tip!")
                                .fontWeight(.bold)
                            Text("As a special thank you, I'd love to follow you on Instagram.")
                            Text("Please send me a Direct Message on Instagram with your App Store receipt or a screenshot of this message.")
                            Button(action: {
                                // <<< --- IMPORTANT: Replace with your actual Instagram profile URL
                                if let url = URL(string: "https://instagram.com/vhalanr3") {
                                    UIApplication.shared.open(url)
                                }
                            }) {
                                HStack {
                                    Image(systemName: "paperplane.circle.fill")
                                        .foregroundColor(Color(red: 0.8, green: 0.2, blue: 0.4)) // Instagram-like color
                                    Text("Message me on Instagram")
                                }
                            }
                            .padding(.top, 5)
                        }
                        .padding(.vertical, 5)
                    }
                }
            }
            .navigationTitle("Tip Jar")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if isRestoring {
                        ProgressView()
                    } else {
                        Button("Restore") {
                            Task {
                                isRestoring = true
                                do {
                                    try await storeManager.restorePurchases()
                                    // Show a success message for restore if desired
                                } catch {
                                    print("Error restoring purchases: \(error)")
                                    purchaseErrorMessage = "Failed to restore purchases. \(error.localizedDescription)"
                                    showPurchaseErrorAlert = true
                                }
                                isRestoring = false
                            }
                        }
                    }
                }
            }
            .onAppear {
                if storeManager.products.isEmpty && !isLoadingProducts {
                    Task {
                        isLoadingProducts = true
                        await storeManager.loadProducts()
                        isLoadingProducts = false
                    }
                }
            }
            .alert("Instagram Follow", isPresented: $showInstagramInfoAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                // <<< --- IMPORTANT: Replace with your actual Instagram username
                Text("Thank you for your generous support! To get your Instagram follow, please message me @your_instagram_username on Instagram with your purchase confirmation.")
            }
            .alert("Purchase Error", isPresented: $showPurchaseErrorAlert, presenting: purchaseErrorMessage) { _ in
                Button("OK") { purchaseErrorMessage = nil }
            } message: { messageText in
                Text(messageText)
            }
        }
        .navigationViewStyle(.stack) // Use .stack for typical iPhone navigation
    }
    
    private func handlePurchaseResult(productID: String, success: Bool, error: Error?) {
        if success {
            print("Purchase of \(productID) handled in TipJarView. UI should update via @EnvironmentObject.")
            if productID == ProductID.largeTip {
                showInstagramInfoAlert = true // Trigger Instagram info if large tip was bought
            }
            // No need to call refreshAlternateIcon anymore
        } else if let error = error {
            purchaseErrorMessage = "Purchase failed: \(error.localizedDescription)"
            showPurchaseErrorAlert = true
        }
    }
}

struct TipRow: View {
    let product: Product
    let featureDescription: String // New property for custom description
    @ObservedObject var storeManager: StoreManager
    var onPurchase: (String, Bool, Error?) -> Void

    @State private var isPurchasing = false

    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(product.displayName)
                    .font(.headline)
                Text(featureDescription) // Use the passed-in feature description
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true) // Allow text to wrap
                Text("Price: \(product.displayPrice)") // Display price clearly
                    .font(.caption)
                    .foregroundColor(.blue)
                    .padding(.top, 1)

            }

            Spacer()

            if storeManager.purchasedProductIDs.contains(product.id) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
                    .font(.title2)
            } else if isPurchasing {
                ProgressView()
                    .frame(width: 70, height: 30) // Adjust size as needed
            } else {
                Button(action: {
                    Task {
                        isPurchasing = true
                        var purchaseSuccess = false
                        var purchaseError: Error? = nil
                        do {
                            if try await storeManager.purchase(product) != nil {
                                purchaseSuccess = true
                            }
                        } catch {
                            print("Purchase failed for \(product.displayName): \(error)")
                            purchaseError = error
                        }
                        isPurchasing = false
                        onPurchase(product.id, purchaseSuccess, purchaseError)
                    }
                }) {
                    Text("Tip \(product.displayPrice)")
                        .fontWeight(.semibold)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Color.accentColor)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
        .padding(.vertical, 5)
    }
}
