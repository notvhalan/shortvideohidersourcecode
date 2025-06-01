// SafariWebExtensionHandler.swift
// BlockYTShortsWebExt // Your Safari App Extension Target Name
//
// Created by vhalan on 09/05/2025.
//

import SafariServices
import os.log

// --- Define these keys consistently with your JavaScript and StoreManager ---
enum AppGroupAccess {
    static let appGroupId = "group.com.vhalan.BlockYTShortsNew"
}

enum IAPFeatureKeys { // Keys for the features themselves (used in UserDefaults by StoreManager)
    static let removeYouTubeLogoEnabled = "isRemoveYouTubeLogoEnabled"
    static let betaAccessEnabled = "isBetaAccessEnabled"
    // For cross-process testing
    static let crossProcessTestKey = "CrossProcessTestKey"
}

enum NativeMessageKeys { // Keys for JS-Native communication
    static let action = "action"
    static let getIAPStatusAction = "getIAPStatus"
    static let responseData = "data" // JS expects the IAP status object under this key
}
// --- End of key definitions ---

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    // Logger instance
    private let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "com.unknown.extension", category: "SafariWebExtensionHandler")

    func beginRequest(with context: NSExtensionContext) {
        logger.log("beginRequest called.")
        guard let requestItem = context.inputItems.first as? NSExtensionItem else {
            logger.error("Invalid request - no NSExtensionItem.")
            let error = NSError(domain: "com.vhalan.BlockYTShortsNew.ErrorDomain", code: 101, userInfo: [NSLocalizedDescriptionKey: "Invalid request structure."])
            context.cancelRequest(withError: error)
            return
        }

        // Profile and Message Payload handling (existing code) ...
        let profile: UUID?
        #if os(macOS)
            if #available(macOS 11.0, *) { profile = requestItem.userInfo?[SFExtensionProfileKey] as? UUID } else { profile = requestItem.userInfo?["profile"] as? UUID }
        #elseif os(iOS)
            if #available(iOS 17.0, *) { profile = requestItem.userInfo?[SFExtensionProfileKey] as? UUID } else { profile = nil }
        #else
            profile = nil
        #endif

        let messagePayload: Any?
        if #available(macOS 11.0, iOS 15.0, *) { messagePayload = requestItem.userInfo?[SFExtensionMessageKey] } else { messagePayload = requestItem.userInfo?["message"] }

        logger.debug("Received message (profile: \(profile?.uuidString ?? "none", privacy: .public)). Payload: \(String(describing: messagePayload ?? "nil payload"), privacy: .public)")

        guard let messageDict = messagePayload as? [String: Any] else {
            logger.error("Message payload is not a dictionary. Received: \(String(describing: messagePayload ?? "nil payload"), privacy: .public)")
            let errorResponse = createErrorResponse(message: "Message payload was not a dictionary.", receivedPayload: String(describing: messagePayload ?? "nil payload"))
            context.completeRequest(returningItems: [errorResponse], completionHandler: nil)
            return
        }

        if let action = messageDict[NativeMessageKeys.action] as? String, action == NativeMessageKeys.getIAPStatusAction {
            logger.info("Action '\(NativeMessageKeys.getIAPStatusAction, privacy: .public)' received.")

            guard let sharedDefaults = UserDefaults(suiteName: AppGroupAccess.appGroupId) else {
                logger.error("CRITICAL - Could not access App Group UserDefaults with ID: \(AppGroupAccess.appGroupId, privacy: .public)")
                let errorResponse = createErrorResponse(message: "Native Error: Failed to access shared UserDefaults for IAP status.")
                context.completeRequest(returningItems: [errorResponse], completionHandler: nil)
                return
            }

            // --- Enhanced Logging ---
            logger.debug("Attempting to read from App Group: \(AppGroupAccess.appGroupId, privacy: .public)")
            logger.debug("DUMP ALL SHARED DEFAULTS before reading for JS: \(String(describing: sharedDefaults.dictionaryRepresentation()), privacy: .public)")

            // Test reading the cross-process test key
            let crossTestValue = sharedDefaults.string(forKey: IAPFeatureKeys.crossProcessTestKey)
            logger.debug("Read CrossProcessTestKey from App Group: \(crossTestValue ?? "NIL", privacy: .public)")
            // --- End Enhanced Logging ---

            let isRemoveLogoPurchased = sharedDefaults.bool(forKey: IAPFeatureKeys.removeYouTubeLogoEnabled)
            let isBetaAccessPurchased = sharedDefaults.bool(forKey: IAPFeatureKeys.betaAccessEnabled)

            logger.debug("Reading IAP Status - isRemoveYouTubeLogoEnabled: \(isRemoveLogoPurchased)")
            logger.debug("Reading IAP Status - isBetaAccessEnabled: \(isBetaAccessPurchased)")

            let iapStatusPayload = [
                IAPFeatureKeys.removeYouTubeLogoEnabled: isRemoveLogoPurchased,
                IAPFeatureKeys.betaAccessEnabled: isBetaAccessPurchased
            ]

            logger.debug("Prepared IAP status payload for JS: \(iapStatusPayload, privacy: .public)")

            let responseItem = NSExtensionItem()
            let responseUserInfoValue = [NativeMessageKeys.responseData: iapStatusPayload]

            if #available(macOS 11.0, iOS 15.0, *) {
                responseItem.userInfo = [SFExtensionMessageKey: responseUserInfoValue]
            } else {
                responseItem.userInfo = ["message": responseUserInfoValue]
            }

            context.completeRequest(returningItems: [responseItem], completionHandler: nil)
            logger.debug("Sent IAP status response to JS: \(iapStatusPayload, privacy: .public)")

        } else {
            let receivedAction = messageDict[NativeMessageKeys.action] as? String ?? "N/A"
            logger.info("Unknown or missing action. Received action: '\(receivedAction, privacy: .public)'. Echoing original message for debugging.")
            // ... (existing unknown action handling) ...
            let responseItem = NSExtensionItem()
            let echoPayload = ["echo": messageDict, "comment": "Unknown action ('\(receivedAction)') received by native handler."] as [String : Any]
            if #available(macOS 11.0, iOS 15.0, *) { responseItem.userInfo = [SFExtensionMessageKey: echoPayload] } else { responseItem.userInfo = ["message": echoPayload] }
            context.completeRequest(returningItems: [responseItem], completionHandler: nil)
        }
    }

    private func createErrorResponse(message: String, receivedPayload: String? = nil) -> NSExtensionItem {
        // ... (existing error response creation) ...
        let errorItem = NSExtensionItem()
        var errorPayload: [String: Any] = ["error": message]
        if let received = receivedPayload { errorPayload["received"] = received }
        if #available(macOS 11.0, iOS 15.0, *) { errorItem.userInfo = [SFExtensionMessageKey: errorPayload] } else { errorItem.userInfo = ["message": errorPayload] }
        return errorItem
    }
}
