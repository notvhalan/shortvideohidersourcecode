// StoreManager.swift
// BlockYTShortsNew
//
// Created by vhalan on 10/05/2025.
//

import Foundation
import StoreKit
import os.log // Import os.log for consistent logging

// Define your product identifiers exactly as in App Store Connect / Products.storekit
enum ProductID {
    // IMPORTANT: Replace these with your actual Product IDs from App Store Connect
    static let smallTip = "com.vhalan.BlockYTShortsNew.small" // For "Remove YouTube Logo"
    static let largeTip = "com.vhalan.BlockYTShortsNew.large" // For "Instagram Follow + Beta Access"
}

// UserDefaults keys for unlocked features (shared via App Group)
enum FeatureUnlockKeys {
    static let appGroupId = "group.com.vhalan.BlockYTShortsNew"
    static let removeYouTubeLogoEnabled = "isRemoveYouTubeLogoEnabled"
    static let betaAccessEnabled = "isBetaAccessEnabled"
    // For cross-process testing
    static let crossProcessTestKey = "CrossProcessTestKey"


    static var sharedUserDefaults: UserDefaults? {
        let defaults = UserDefaults(suiteName: appGroupId)
        if defaults == nil {
            os_log(.error, "[StoreManager] CRITICAL: sharedUserDefaults is nil. App Group '%{public}@' might not be configured correctly or accessible.", appGroupId)
        }
        return defaults
    }
}

@MainActor
class StoreManager: ObservableObject {
    @Published var products: [Product] = []
    @Published var purchasedProductIDs: Set<String> = []
    private var updates: Task<Void, Never>? = nil

    // Logger instance
    private let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "com.unknown", category: "StoreManager")

    init() {
        updates = observeTransactionUpdates()
        Task {
            await updatePurchasedProducts()
            // Example of setting the cross-process test key from the main app context
            if let defaults = FeatureUnlockKeys.sharedUserDefaults {
                let testPayload = "HelloFromMainApp-\(Date())"
                defaults.set(testPayload, forKey: FeatureUnlockKeys.crossProcessTestKey)
                let syncSuccess = defaults.synchronize() // Forcing sync for this test key
                logger.log("[INIT] Wrote to CrossProcessTestKey with value: \(testPayload). Synchronize success: \(syncSuccess)")
            }
        }
    }

    deinit {
        updates?.cancel()
    }

    func loadProducts() async {
        do {
            let productIdentifiers = [ProductID.smallTip, ProductID.largeTip]
            self.products = try await Product.products(for: productIdentifiers)
            await updatePurchasedProducts() // This will also log synchronize results internally
            logger.log("Products loaded: \(self.products.count)")
        } catch {
            logger.error("Failed to load products: \(error.localizedDescription, privacy: .public)")
        }
    }

    func purchase(_ product: Product) async throws -> StoreKit.Transaction? {
        logger.log("Attempting to purchase product: \(product.id, privacy: .public)")
        let result = try await product.purchase()

        switch result {
        case .success(let verificationResult):
            let transaction = try verificationResult.payloadValue
            logger.log("Purchase successful for \(transaction.productID, privacy: .public), transaction ID: \(transaction.originalID, privacy: .public)")
            await transaction.finish()
            await updatePurchasedProducts() // This will also log synchronize results internally
            return transaction
        case .userCancelled:
            logger.log("Purchase cancelled by user for product: \(product.id, privacy: .public).")
            return nil
        case .pending:
            logger.log("Purchase is pending for product: \(product.id, privacy: .public).")
            return nil
        @unknown default:
            logger.warning("Unknown purchase result for product: \(product.id, privacy: .public).")
            return nil
        }
    }

    func updatePurchasedProducts() async {
        logger.log("Updating purchased products...")
        var newPurchasedIDs: Set<String> = []
        var latestTransactions: [String: StoreKit.Transaction] = [:]

        if let defaults = FeatureUnlockKeys.sharedUserDefaults {
            let initialLogoStatus = defaults.bool(forKey: FeatureUnlockKeys.removeYouTubeLogoEnabled)
            let initialBetaStatus = defaults.bool(forKey: FeatureUnlockKeys.betaAccessEnabled)
            logger.log("Initial UserDefaults - RemoveLogo: \(initialLogoStatus), BetaAccess: \(initialBetaStatus)")
            logger.log("Initial UserDefaults - All keys/values in App Group (\(FeatureUnlockKeys.appGroupId, privacy: .public)): \(String(describing: defaults.dictionaryRepresentation()), privacy: .public)")
        }

        for await verificationResult in StoreKit.Transaction.currentEntitlements {
            do {
                let transaction = try verificationResult.payloadValue
                logger.log("Processing current entitlement for product: \(transaction.productID, privacy: .public)")
                newPurchasedIDs.insert(transaction.productID)
                if let existingTransaction = latestTransactions[transaction.productID], transaction.purchaseDate > existingTransaction.purchaseDate {
                    latestTransactions[transaction.productID] = transaction
                } else if latestTransactions[transaction.productID] == nil {
                    latestTransactions[transaction.productID] = transaction
                }
            } catch {
                logger.error("Error processing current entitlement: \(error.localizedDescription, privacy: .public)")
            }
        }

        let oldPurchasedIDs = self.purchasedProductIDs
        self.purchasedProductIDs = newPurchasedIDs
        logger.log("Updated purchasedProductIDs Set: \(self.purchasedProductIDs, privacy: .public)")

        let newlyAddedIDs = newPurchasedIDs.subtracting(oldPurchasedIDs)
        if !newlyAddedIDs.isEmpty {
            logger.log("Newly added product IDs from entitlements: \(newlyAddedIDs, privacy: .public)")
        }

        let shouldEnableRemoveLogo = newPurchasedIDs.contains(ProductID.smallTip) || newPurchasedIDs.contains(ProductID.largeTip)
        let shouldEnableBetaAccess = newPurchasedIDs.contains(ProductID.largeTip)

        if let defaults = FeatureUnlockKeys.sharedUserDefaults {
            defaults.set(shouldEnableRemoveLogo, forKey: FeatureUnlockKeys.removeYouTubeLogoEnabled)
            logger.log("Set \(FeatureUnlockKeys.removeYouTubeLogoEnabled, privacy: .public) to \(shouldEnableRemoveLogo) based on current entitlements.")

            defaults.set(shouldEnableBetaAccess, forKey: FeatureUnlockKeys.betaAccessEnabled)
            logger.log("Set \(FeatureUnlockKeys.betaAccessEnabled, privacy: .public) to \(shouldEnableBetaAccess) based on current entitlements.")

            let syncSuccess = defaults.synchronize() // Forcing sync during debugging
            logger.log("UserDefaults synchronize after setting entitlements: \(syncSuccess ? "succeeded" : "failed")")
            logger.log("After potential updates, all keys/values in App Group (\(FeatureUnlockKeys.appGroupId, privacy: .public)): \(String(describing: defaults.dictionaryRepresentation()), privacy: .public)")
            logger.log("Specifically, isRemoveYouTubeLogoEnabled is now: \(defaults.bool(forKey: FeatureUnlockKeys.removeYouTubeLogoEnabled))")
            logger.log("Specifically, isBetaAccessEnabled is now: \(defaults.bool(forKey: FeatureUnlockKeys.betaAccessEnabled))")
        }

        for productID in newlyAddedIDs {
            if let purchasedProduct = self.products.first(where: { $0.id == productID }) {
                await handlePurchaseCompletion(for: purchasedProduct)
            } else if let transaction = latestTransactions[productID] {
                logger.log("Handling entitlement for \(transaction.productID, privacy: .public) directly from transaction (product list not yet populated).")
                var syncSuccessAfterNewlyAddedHandling = false
                if transaction.productID == ProductID.smallTip {
                    logger.log("Small tip entitlement found. Ensuring 'Remove YouTube Logo' feature is set via newlyAddedIDs.")
                    FeatureUnlockKeys.sharedUserDefaults?.set(true, forKey: FeatureUnlockKeys.removeYouTubeLogoEnabled)
                    syncSuccessAfterNewlyAddedHandling = FeatureUnlockKeys.sharedUserDefaults?.synchronize() ?? false
                } else if transaction.productID == ProductID.largeTip {
                    logger.log("Large tip entitlement found. Ensuring Beta Access & Remove Logo are set via newlyAddedIDs.")
                    FeatureUnlockKeys.sharedUserDefaults?.set(true, forKey: FeatureUnlockKeys.removeYouTubeLogoEnabled)
                    FeatureUnlockKeys.sharedUserDefaults?.set(true, forKey: FeatureUnlockKeys.betaAccessEnabled)
                    syncSuccessAfterNewlyAddedHandling = FeatureUnlockKeys.sharedUserDefaults?.synchronize() ?? false
                }
                if let currentDefaults = FeatureUnlockKeys.sharedUserDefaults { // Re-fetch for logging
                    logger.log("UserDefaults synchronize after specific newlyAddedID handling for \(transaction.productID, privacy: .public): \(syncSuccessAfterNewlyAddedHandling ? "succeeded" : "failed")")
                    logger.log("After specific newlyAddedID handling for \(transaction.productID, privacy: .public), App Group: \(String(describing: currentDefaults.dictionaryRepresentation()), privacy: .public)")
                }
            }
        }
    }

    private func observeTransactionUpdates() -> Task<Void, Never> {
        Task(priority: .background) { [unowned self] in
            for await verificationResult in StoreKit.Transaction.updates {
                do {
                    let transaction = try verificationResult.payloadValue
                    logger.log("Transaction update received for \(transaction.productID, privacy: .public)")
                    await transaction.finish()
                    await self.updatePurchasedProducts() // This will also log synchronize results internally
                } catch {
                    logger.error("Transaction update error: \(error.localizedDescription, privacy: .public)")
                }
            }
        }
    }

    private func handlePurchaseCompletion(for product: Product) async {
        logger.log("Handling purchase completion actions for product: \(product.id, privacy: .public)")
        var syncSuccess = false
        if product.id == ProductID.smallTip {
            logger.log("Ensuring 'Remove YouTube Logo' feature is set via handlePurchaseCompletion.")
            FeatureUnlockKeys.sharedUserDefaults?.set(true, forKey: FeatureUnlockKeys.removeYouTubeLogoEnabled)
            syncSuccess = FeatureUnlockKeys.sharedUserDefaults?.synchronize() ?? false
        } else if product.id == ProductID.largeTip {
            logger.log("Ensuring Beta Access & Remove Logo are set via handlePurchaseCompletion.")
            FeatureUnlockKeys.sharedUserDefaults?.set(true, forKey: FeatureUnlockKeys.removeYouTubeLogoEnabled)
            FeatureUnlockKeys.sharedUserDefaults?.set(true, forKey: FeatureUnlockKeys.betaAccessEnabled)
            syncSuccess = FeatureUnlockKeys.sharedUserDefaults?.synchronize() ?? false
        }

        if let defaults = FeatureUnlockKeys.sharedUserDefaults { // Re-fetch for logging
            logger.log("UserDefaults synchronize after handlePurchaseCompletion for \(product.id, privacy: .public): \(syncSuccess ? "succeeded" : "failed")")
            logger.log("After handlePurchaseCompletion for \(product.id, privacy: .public), all keys/values in App Group (\(FeatureUnlockKeys.appGroupId, privacy: .public)): \(String(describing: defaults.dictionaryRepresentation()), privacy: .public)")
            logger.log("Specifically, isRemoveYouTubeLogoEnabled is now: \(defaults.bool(forKey: FeatureUnlockKeys.removeYouTubeLogoEnabled))")
            logger.log("Specifically, isBetaAccessEnabled is now: \(defaults.bool(forKey: FeatureUnlockKeys.betaAccessEnabled))")
        }
    }

    func restorePurchases() async throws {
        logger.log("Attempting to restore purchases...")
        try await AppStore.sync()
        logger.log("AppStore.sync() completed. Updating purchased products.")
        await updatePurchasedProducts() // This will also log synchronize results internally
        logger.log("Purchase restoration process finished.")
    }

    func resetIAPStatusForTesting() {
        logger.warning("RESETTING IAP STATUS FOR TESTING...")
        if let defaults = FeatureUnlockKeys.sharedUserDefaults {
            defaults.set(false, forKey: FeatureUnlockKeys.removeYouTubeLogoEnabled)
            defaults.set(false, forKey: FeatureUnlockKeys.betaAccessEnabled)
            let syncSuccess = defaults.synchronize() // Forcing sync during debugging
            logger.log("UserDefaults synchronize after IAP reset: \(syncSuccess ? "succeeded" : "failed")")
            logger.log("IAP status reset in UserDefaults. RemoveLogo: \(defaults.bool(forKey: FeatureUnlockKeys.removeYouTubeLogoEnabled)), BetaAccess: \(defaults.bool(forKey: FeatureUnlockKeys.betaAccessEnabled))")
            logger.log("All keys/values in App Group after reset: \(String(describing: defaults.dictionaryRepresentation()), privacy: .public)")

            Task {
                await MainActor.run {
                    self.purchasedProductIDs.removeAll()
                    logger.log("Local purchasedProductIDs set cleared.")
                }
                await updatePurchasedProducts()
            }
        } else {
            logger.error("Failed to reset IAP status: sharedUserDefaults is nil.")
        }
    }
}
