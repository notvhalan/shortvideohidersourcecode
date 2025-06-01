// settings.js - For the settings.html popup

// --- Native Messaging Configuration ---
const NATIVE_APP_EXTENSION_BUNDLE_ID = "com.vhalan.BlockYTShortsNew.Ext";
const JS_MESSAGE_ACTION_KEY = "action";
const JS_ACTION_GET_IAP_STATUS = "getIAPStatus";
const NATIVE_RESPONSE_DATA_KEY = "data";

const IAP_STATUS_KEY_REMOVE_LOGO = "isRemoveYouTubeLogoEnabled";
const IAP_STATUS_KEY_BETA_ACCESS = "isBetaAccessEnabled";
const CHROME_STORAGE_IAP_STATUS_KEY = "extension_iap_status";

// --- Default Settings for the UI (MUST include all toggles in settings.html) ---
const defaultSettings = {
    redirectShorts: true,
    removeShortsUI: true,
    removeAdditionalShortsShelves: true, // Default for the new toggle
    grayscaleThumbnails: false,
    modifyTitles: false,
    removeYouTubeLogo: false,
    redirectInstagramReels: true,
    removeInstagramReelsUI: true
};

// --- DOM Elements from settings.html ---
const redirectShortsToggle = document.getElementById('redirectShorts');
const removeShortsUIToggle = document.getElementById('removeShortsUI');
const removeAdditionalShortsShelvesToggle = document.getElementById('removeAdditionalShortsShelvesToggle'); // Get the new toggle
const grayscaleThumbnailsToggle = document.getElementById('grayscaleThumbnails');
const modifyTitlesToggle = document.getElementById('modifyTitles');
const removeYouTubeLogoToggle = document.getElementById('removeYouTubeLogo');
const removeLogoSettingContainer = document.getElementById('removeLogoSettingContainer');
const removeLogoUnlockMessage = document.getElementById('removeLogoUnlockMessage');
const redirectInstagramReelsToggle = document.getElementById('redirectInstagramReels');
const removeInstagramReelsUIToggle = document.getElementById('removeInstagramReelsUI');
const statusMessage = document.getElementById('statusMessage');

// --- IAP Status Handling ---
function fetchAndStoreIAPStatus(callback) {
    console.log('[SETTINGS LOG] fetchAndStoreIAPStatus: Starting...');
    let defaultIAPStatusObject = {
        [IAP_STATUS_KEY_REMOVE_LOGO]: false,
        [IAP_STATUS_KEY_BETA_ACCESS]: false
    };

    if (chrome && chrome.runtime && chrome.runtime.sendNativeMessage) {
        console.log('[SETTINGS LOG] fetchAndStoreIAPStatus: Attempting native message...');
        chrome.runtime.sendNativeMessage(
            NATIVE_APP_EXTENSION_BUNDLE_ID,
            { [JS_MESSAGE_ACTION_KEY]: JS_ACTION_GET_IAP_STATUS },
            function(nativeResponse) {
                console.log('[SETTINGS LOG] fetchAndStoreIAPStatus: Raw nativeResponse:', JSON.stringify(nativeResponse, null, 2));
                let iapStatus = { ...defaultIAPStatusObject };

                if (chrome.runtime.lastError) {
                    console.error('[SETTINGS LOG] fetchAndStoreIAPStatus: Native message error:', chrome.runtime.lastError.message);
                } else if (nativeResponse && nativeResponse.error) {
                    console.error('[SETTINGS LOG] fetchAndStoreIAPStatus: Native handler returned error:', nativeResponse.error);
                } else if (nativeResponse && nativeResponse[NATIVE_RESPONSE_DATA_KEY]) {
                    const nativeData = nativeResponse[NATIVE_RESPONSE_DATA_KEY];
                    console.log('[SETTINGS LOG] fetchAndStoreIAPStatus: Received nativeData:', JSON.stringify(nativeData, null, 2));
                    
                    if (nativeData.hasOwnProperty(IAP_STATUS_KEY_REMOVE_LOGO)) {
                        iapStatus[IAP_STATUS_KEY_REMOVE_LOGO] = nativeData[IAP_STATUS_KEY_REMOVE_LOGO] === true;
                        console.log(`[SETTINGS LOG] fetchAndStoreIAPStatus: ${IAP_STATUS_KEY_REMOVE_LOGO} from native is ${nativeData[IAP_STATUS_KEY_REMOVE_LOGO]}, evaluated to: ${iapStatus[IAP_STATUS_KEY_REMOVE_LOGO]}`);
                    } else {
                        console.warn(`[SETTINGS LOG] fetchAndStoreIAPStatus: Native data missing key: ${IAP_STATUS_KEY_REMOVE_LOGO}`);
                    }
                    if (nativeData.hasOwnProperty(IAP_STATUS_KEY_BETA_ACCESS)) {
                        iapStatus[IAP_STATUS_KEY_BETA_ACCESS] = nativeData[IAP_STATUS_KEY_BETA_ACCESS] === true;
                        console.log(`[SETTINGS LOG] fetchAndStoreIAPStatus: ${IAP_STATUS_KEY_BETA_ACCESS} from native is ${nativeData[IAP_STATUS_KEY_BETA_ACCESS]}, evaluated to: ${iapStatus[IAP_STATUS_KEY_BETA_ACCESS]}`);
                    } else {
                        console.warn(`[SETTINGS LOG] fetchAndStoreIAPStatus: Native data missing key: ${IAP_STATUS_KEY_BETA_ACCESS}`);
                    }
                } else {
                    console.warn('[SETTINGS LOG] fetchAndStoreIAPStatus: No valid "data" key or unexpected native response.');
                }

                chrome.storage.sync.set({ [CHROME_STORAGE_IAP_STATUS_KEY]: iapStatus }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('[SETTINGS LOG] fetchAndStoreIAPStatus: Error saving IAP status to sync storage:', chrome.runtime.lastError.message);
                    } else {
                        console.log('[SETTINGS LOG] fetchAndStoreIAPStatus: IAP status saved to sync storage:', iapStatus);
                    }
                    if (callback) callback(iapStatus);
                });
            }
        );
    } else {
        console.warn('[SETTINGS LOG] fetchAndStoreIAPStatus: sendNativeMessage API not available. Using stored/default IAP status.');
        chrome.storage.sync.get([CHROME_STORAGE_IAP_STATUS_KEY], (result) => {
            const storedIAPStatus = result[CHROME_STORAGE_IAP_STATUS_KEY] || defaultIAPStatusObject;
            console.log('[SETTINGS LOG] fetchAndStoreIAPStatus: Loaded IAP status from storage (fallback):', storedIAPStatus);
            if (callback) callback(storedIAPStatus);
        });
    }
}

// --- Load Settings and Apply to UI ---
function loadSettingsAndApplyUI() {
    console.log("[SETTINGS LOG] loadSettingsAndApplyUI: Starting...");
    fetchAndStoreIAPStatus(function(iapStatus) {
        console.log("[SETTINGS LOG] loadSettingsAndApplyUI: fetchAndStoreIAPStatus callback. IAP Status resolved to:", iapStatus);
        
        if (chrome && chrome.storage && chrome.storage.sync) {
            const keysToFetch = Object.keys(defaultSettings);
            chrome.storage.sync.get(keysToFetch, (loadedDisplaySettings) => {
                let effectiveDisplaySettings = { ...defaultSettings };
                if (chrome.runtime.lastError) {
                    console.error('[SETTINGS LOG] loadSettingsAndApplyUI: Error loading display settings:', chrome.runtime.lastError.message);
                } else {
                    console.log('[SETTINGS LOG] loadSettingsAndApplyUI: Display settings raw loaded from storage:', loadedDisplaySettings);
                    for (const key of keysToFetch) { // Iterate using keysToFetch to ensure all defaults are considered
                        if (loadedDisplaySettings.hasOwnProperty(key)) {
                            effectiveDisplaySettings[key] = loadedDisplaySettings[key];
                            // console.log(`[SETTINGS LOG] Loaded '${key}': ${loadedDisplaySettings[key]}`); // Optional detailed log
                        } else {
                            // console.log(`[SETTINGS LOG] Key '${key}' not in storage, using default: ${defaultSettings[key]}`); // Optional
                        }
                    }
                }
                console.log('[SETTINGS LOG] loadSettingsAndApplyUI: Effective display settings to apply:', effectiveDisplaySettings);
                applySettingsToUI(effectiveDisplaySettings, iapStatus);
            });
        } else {
            console.warn('[SETTINGS LOG] loadSettingsAndApplyUI: Storage API not available. Using defaults.');
            applySettingsToUI(defaultSettings, iapStatus);
        }
    });
}

// --- Apply Settings to UI Elements ---
function applySettingsToUI(settings, iapStatus) {
    console.log("[SETTINGS LOG] applySettingsToUI: Applying. Display Settings:", settings, "IAP Status:", iapStatus);

    if (redirectShortsToggle) redirectShortsToggle.checked = settings.redirectShorts;
    if (removeShortsUIToggle) removeShortsUIToggle.checked = settings.removeShortsUI;
    if (removeAdditionalShortsShelvesToggle) removeAdditionalShortsShelvesToggle.checked = settings.removeAdditionalShortsShelves; // APPLY NEW SETTING
    if (grayscaleThumbnailsToggle) grayscaleThumbnailsToggle.checked = settings.grayscaleThumbnails;
    if (modifyTitlesToggle) modifyTitlesToggle.checked = settings.modifyTitles;
    
    const isLogoRemovalPurchased = (iapStatus && iapStatus[IAP_STATUS_KEY_REMOVE_LOGO] === true);
    if (removeYouTubeLogoToggle && removeLogoSettingContainer && removeLogoUnlockMessage) {
        removeLogoSettingContainer.classList.toggle('iap-locked', !isLogoRemovalPurchased);
        removeLogoSettingContainer.classList.toggle('disabled', !isLogoRemovalPurchased);
        removeYouTubeLogoToggle.disabled = !isLogoRemovalPurchased;
        removeLogoUnlockMessage.style.display = isLogoRemovalPurchased ? 'none' : 'block';
        removeYouTubeLogoToggle.checked = isLogoRemovalPurchased ? settings.removeYouTubeLogo : false;
    }
    
    if (redirectInstagramReelsToggle) redirectInstagramReelsToggle.checked = settings.redirectInstagramReels;
    if (removeInstagramReelsUIToggle) removeInstagramReelsUIToggle.checked = settings.removeInstagramReelsUI;
}

// --- Save Settings ---
function saveSettings() {
    console.log("[SETTINGS LOG] saveSettings: Called.");
    const settingsToSave = {
        redirectShorts: redirectShortsToggle ? redirectShortsToggle.checked : defaultSettings.redirectShorts,
        removeShortsUI: removeShortsUIToggle ? removeShortsUIToggle.checked : defaultSettings.removeShortsUI,
        removeAdditionalShortsShelves: removeAdditionalShortsShelvesToggle ? removeAdditionalShortsShelvesToggle.checked : defaultSettings.removeAdditionalShortsShelves, // SAVE NEW SETTING
        grayscaleThumbnails: grayscaleThumbnailsToggle ? grayscaleThumbnailsToggle.checked : defaultSettings.grayscaleThumbnails,
        modifyTitles: modifyTitlesToggle ? modifyTitlesToggle.checked : defaultSettings.modifyTitles,
        removeYouTubeLogo: removeYouTubeLogoToggle ? removeYouTubeLogoToggle.checked : defaultSettings.removeYouTubeLogo,
        redirectInstagramReels: redirectInstagramReelsToggle ? redirectInstagramReelsToggle.checked : defaultSettings.redirectInstagramReels,
        removeInstagramReelsUI: removeInstagramReelsUIToggle ? removeInstagramReelsUIToggle.checked : defaultSettings.removeInstagramReelsUI
    };
    console.log("[SETTINGS LOG] saveSettings: Settings to save:", settingsToSave);

    if (chrome && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set(settingsToSave, () => {
            if (chrome.runtime.lastError) {
                console.error('[SETTINGS LOG] saveSettings: Error saving settings:', chrome.runtime.lastError.message);
                showStatusMessage('Error saving settings.', 2000, true);
            } else {
                console.log('[SETTINGS LOG] saveSettings: Settings saved successfully.');
                showStatusMessage('Settings saved!', 1500);
            }
        });
    } else {
        console.error('[SETTINGS LOG] saveSettings: Storage API not found.');
        showStatusMessage('Could not save settings (API unavailable).', 3000, true);
    }
}

// --- Show Status Message ---
function showStatusMessage(message, duration, isError = false) {
    if (!statusMessage) return;
    statusMessage.textContent = message;
    statusMessage.classList.remove('status-success', 'status-error');
    statusMessage.classList.add(isError ? 'status-error' : 'status-success');
    statusMessage.style.display = 'block';
    statusMessage.style.opacity = '1';
    setTimeout(() => {
        statusMessage.style.opacity = '0';
        setTimeout(() => {
            if (statusMessage.style.opacity === '0') {
                 statusMessage.style.display = 'none';
            }
        }, 300);
    }, duration);
}

// --- Add Event Listeners to Toggles ---
if (redirectShortsToggle) redirectShortsToggle.addEventListener('change', saveSettings);
if (removeShortsUIToggle) removeShortsUIToggle.addEventListener('change', saveSettings);
if (removeAdditionalShortsShelvesToggle) removeAdditionalShortsShelvesToggle.addEventListener('change', saveSettings); // ADD LISTENER FOR NEW TOGGLE
if (grayscaleThumbnailsToggle) grayscaleThumbnailsToggle.addEventListener('change', saveSettings);
if (modifyTitlesToggle) modifyTitlesToggle.addEventListener('change', saveSettings);
if (removeYouTubeLogoToggle) {
    removeYouTubeLogoToggle.addEventListener('change', function(event) {
        console.log(`[SETTINGS LOG] removeYouTubeLogoToggle: Change event. New checked state: ${event.target.checked}. User initiated: ${event.isTrusted}`);
        saveSettings();
    });
}
if (redirectInstagramReelsToggle) redirectInstagramReelsToggle.addEventListener('change', saveSettings);
if (removeInstagramReelsUIToggle) removeInstagramReelsUIToggle.addEventListener('change', saveSettings);

// --- Initialize on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[SETTINGS LOG] DOMContentLoaded: Event fired.");
    loadSettingsAndApplyUI();
});
