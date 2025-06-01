// content_instagram.js - Outer script (runs at document_start as per your new manifest)
(() => {
    // Very minimal logging in this outer script, or none in final production.
    // console.log("🛡️ Instagram Content Script (Outer) Loaded - document_start");

    const INSTAGRAM_STYLE_ID = 'block-instagram-reels-style-v3'; // New ID
    const SETTINGS_DATA_ATTRIBUTE = 'data-ig-reels-blocker-settings';
    const SETTINGS_UPDATED_EVENT = 'igReelsBlockerSettingsUpdated';

    // CSS selectors that DO NOT use :has() for immediate, synchronous injection
    // These are applied very early by this outer script.
    const INITIAL_CSS_SELECTORS_TO_HIDE = [
        'a[href="/reels/"][role="link"]',
        'a[href^="/reels/reel/"]',
        'a[href^="/reel/"]',
        'div[role="menuitem"] a[href="/reels/"]',
        'section[aria-label*="Reels feed" i]', // Often an entire section
        'div[role="tablist"] a[href="/reels/"]'  // Tabs on profiles
        // Selectors like 'article:has(a[href^="/reel/"])' are removed from CSS
        // and will be handled by the injected JavaScript.
    ];

    function applyInitialCSS(settings) {
        // Only apply if UI removal is enabled
        if (!settings || !settings.removeInstagramReelsUI) {
            // If there's an old style tag, remove it
            const oldStyleElement = document.getElementById(INSTAGRAM_STYLE_ID);
            if (oldStyleElement) {
                oldStyleElement.remove();
            }
            return;
        }

        let styleElement = document.getElementById(INSTAGRAM_STYLE_ID);
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = INSTAGRAM_STYLE_ID;
            // Try to append to head; if not ready, use observer for the head.
            // This function itself runs at document_start, so document.head might exist.
            (document.head || document.documentElement).appendChild(styleElement);
        }
        
        // Update textContent based on current settings
        // This allows toggling the initial CSS off if user disables the feature
        if (settings.removeInstagramReelsUI) {
            styleElement.textContent = `
                ${INITIAL_CSS_SELECTORS_TO_HIDE.join(',\n')} {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    width: 0 !important;
                    height: 0 !important;
                    overflow: hidden !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                }
            `;
        } else {
            styleElement.textContent = ''; // Clear styles if UI removal is off
        }
    }

    // This function contains the main operational logic.
    // It will be converted to a string and injected into the page's context.
    function pageScript() {
        // --- Start of Injected Page Script ---
        // This code runs in the page's own JavaScript context.
        // It CANNOT directly access 'chrome.*' APIs.
        // Avoid verbose logging here, especially on startup.

        const INJECTED_SETTINGS_DATA_ATTRIBUTE = 'data-ig-reels-blocker-settings';
        const INJECTED_SETTINGS_UPDATED_EVENT = 'igReelsBlockerSettingsUpdated';

        let internalUserSettings = { // Defaults, will be overridden
            redirectInstagramReels: true,
            removeInstagramReelsUI: true,
        };

        let lastAttemptedInstagramRedirectPath_page = null;
        let lastInstagramRedirectAttemptTime_page = 0;
        let lastProcessedInstagramPath_page = window.location.pathname + window.location.search;
        let instagramDomChangeObserver_page = null;
        let persistentCheckInterval_page = null;

        function logPageScript(message, data) {
            // For debugging the injected script; keep disabled in production.
            // console.log(`🛡️ IG Blocker (Page): ${message}`, data || '');
        }

        function debounce_page(func, delay) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), delay);
            };
        }
        
        // Your hideReelsElementsByJS function, adapted for page context
        function hideReelsElementsByJS_page() {
            if (!internalUserSettings.removeInstagramReelsUI) return;

            const mainReelsSelectors = [
                'a[href="/reels/"][role="link"]',
                'svg[aria-label="Reels"]'
            ];

            mainReelsSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(element => {
                    let finalTarget = null;
                    if (element.tagName === 'SVG' && element.getAttribute('aria-label') === 'Reels') {
                        const parent1 = element.parentElement;
                        if (parent1) {
                            const parent2 = parent1.parentElement;
                            if (parent2) {
                                const parent3 = parent2.parentElement;
                                if (parent3 && parent3.tagName === 'DIV') {
                                    finalTarget = parent3;
                                } else if (parent1.tagName === 'DIV') {
                                    finalTarget = parent1;
                                }
                            } else if (parent1.tagName === 'DIV') {
                                finalTarget = parent1;
                            }
                        }
                    } else if (element.matches('a[href="/reels/"][role="link"]')) {
                        const listItem = element.closest('li, div[role="menuitem"], div[role="listitem"]');
                        finalTarget = listItem || element;
                    }

                    if (finalTarget && finalTarget.style.display !== 'none') {
                        if (finalTarget.offsetHeight > 0 || finalTarget.offsetWidth > 0 || !document.body.contains(finalTarget)) {
                            // logPageScript("Hiding main Reels nav element:", finalTarget);
                            finalTarget.style.display = 'none';
                        }
                    }
                });
            });

            // JS logic to replace CSS :has(a[href^="/reel/"]) for articles/listitems
            const feedContainerSelectors = ['article', 'div[role="listitem"]'];
            feedContainerSelectors.forEach(containerSelector => {
                document.querySelectorAll(containerSelector).forEach(item => {
                    const hasReelLink = item.querySelector('a[href^="/reel/"], a[href*="/reels/reel/"]');
                    const hasReelIndicator = item.querySelector('svg[aria-label="Play"], div[aria-label="Reel"]'); // Your existing indicator
                    if (hasReelLink || hasReelIndicator) {
                        if (item.style.display !== 'none') {
                            // logPageScript("Hiding Reel item in feed (JS):", item);
                            item.style.display = 'none';
                        }
                    }
                });
            });
            
            document.querySelectorAll('a[role="tab"][href$="/reels/"]').forEach(tab => {
                if (tab.style.display !== 'none') {
                    // logPageScript("Hiding Reels tab (JS):", tab);
                    tab.style.display = 'none';
                }
            });
        }

        function attemptInstagramReelsRedirect_page() {
            if (!internalUserSettings.redirectInstagramReels) return false;
            const currentPath = window.location.pathname;
            const reelPathRegex = /^\/(reel|reels)\/([a-zA-Z0-9_\-]+)/;
            const match = currentPath.match(reelPathRegex);

            if (match && match[2]) {
                if (lastAttemptedInstagramRedirectPath_page === currentPath && (Date.now() - lastInstagramRedirectAttemptTime_page) < 4000) {
                    return false;
                }
                lastAttemptedInstagramRedirectPath_page = currentPath;
                lastInstagramRedirectAttemptTime_page = Date.now();
                const homeUrl = "/";
                logPageScript("Redirecting Reels URL:", { from: currentPath, to: homeUrl });
                try { window.location.replace(homeUrl); } catch (e) { /* console.error("Redirect error",e) */ }
                return true;
            }
            return false;
        }

        function applyInstagramReelsUIRemoval_page() {
            // The initial static CSS is already applied by the outer script.
            // This function now focuses on JS-based hiding.
            if (internalUserSettings.removeInstagramReelsUI) {
                hideReelsElementsByJS_page();
            }
        }

        function performAllInstagramModifications_page() {
            if (attemptInstagramReelsRedirect_page()) {
                return;
            }
            applyInstagramReelsUIRemoval_page();
        }

        function handleInstagramUrlChange_page() {
            requestAnimationFrame(() => {
                const newPath = window.location.pathname + window.location.search;
                if (newPath !== lastProcessedInstagramPath_page) {
                    lastProcessedInstagramPath_page = newPath;
                    if (attemptInstagramReelsRedirect_page()) return;
                    performAllInstagramModifications_page();
                }
            });
        }

        const debouncedModifications_page = debounce_page(() => {
            if (window.location.pathname.match(/^\/(reel|reels)\//)) {
                if (attemptInstagramReelsRedirect_page()) return;
            }
            performAllInstagramModifications_page();
        }, 250); // Slightly faster debounce as per strategy suggestion (100-300ms)

        function initializeInjectedScript() {
            const settingsJSON = document.documentElement.getAttribute(INJECTED_SETTINGS_DATA_ATTRIBUTE);
            if (settingsJSON) {
                try {
                    const parsedSettings = JSON.parse(settingsJSON);
                    internalUserSettings = { ...internalUserSettings, ...parsedSettings };
                } catch (e) { /* console.warn("Injected: Error parsing settings", e); */ }
            }
            logPageScript("Initialized with settings:", internalUserSettings);

            // Listen for settings updates from the outer content script
            document.addEventListener(INJECTED_SETTINGS_UPDATED_EVENT, (event) => {
                if (event.detail) {
                    const oldRemoveUIPref = internalUserSettings.removeInstagramReelsUI;
                    internalUserSettings = { ...internalUserSettings, ...event.detail };
                    logPageScript("Received settings update:", internalUserSettings);
                    
                    // If removeUI setting changed, re-apply immediately.
                    // The outer script will also update the initial CSS.
                    if (internalUserSettings.removeInstagramReelsUI !== oldRemoveUIPref) {
                        applyInstagramReelsUIRemoval_page();
                    }
                    // Re-check redirect if that setting changed and we're on a reel page
                    if (event.detail.redirectInstagramReels !== undefined && internalUserSettings.redirectInstagramReels) {
                         if (window.location.pathname.match(/^\/(reel|reels)\//)) {
                           attemptInstagramReelsRedirect_page();
                        }
                    }
                }
            });

            if (attemptInstagramReelsRedirect_page()) { return; }
            performAllInstagramModifications_page(); // Initial run

            ['pushState', 'replaceState'].forEach(method => {
                const original = history[method];
                history[method] = function() {
                    const result = original.apply(this, arguments);
                    setTimeout(handleInstagramUrlChange_page, 0); // Use 0 for fastest possible async
                    return result;
                };
            });
            window.addEventListener('popstate', handleInstagramUrlChange_page);

            if (instagramDomChangeObserver_page) { instagramDomChangeObserver_page.disconnect(); }
            instagramDomChangeObserver_page = new MutationObserver(debouncedModifications_page);
            instagramDomChangeObserver_page.observe(document.documentElement, { childList: true, subtree: true });

            // More persistent check using setInterval, as a fallback
            if (persistentCheckInterval_page) clearInterval(persistentCheckInterval_page);
            persistentCheckInterval_page = setInterval(() => {
                if (internalUserSettings.removeInstagramReelsUI) {
                    hideReelsElementsByJS_page();
                }
            }, 750); // Check slightly more often if re-renders are aggressive
        }
        
        // Initial execution for injected script
        // Wait for documentElement to ensure settings attribute can be read
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeInjectedScript);
        } else {
            initializeInjectedScript();
        }
        // --- End of Injected Page Script ---
    }

    // Helper to inject the script into the page context
    function injectScript(fn) {
        const script = document.createElement('script');
        script.textContent = `(${fn.toString()})();`;
        (document.head || document.documentElement).appendChild(script);
        // It's generally safe to remove the script tag after it has executed,
        // as its functions and observers are now part of the page's JS context.
        script.remove();
    }

    // Main execution flow for the outer content script
    let initialSettings = { // Default values
        redirectInstagramReels: true,
        removeInstagramReelsUI: true,
    };

    // Apply initial CSS based on default or quickly loaded settings
    // We apply CSS synchronously if possible.
    // Settings are then loaded asynchronously and can update the CSS/pass to injected script.
    applyInitialCSS(initialSettings);


    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        const settingKeys = ['redirectInstagramReels', 'removeInstagramReelsUI'];
        
        chrome.storage.sync.get(settingKeys, (loadedSettingsResult) => {
            let effectiveSettings = {...initialSettings}; // Start with defaults
            if (chrome.runtime.lastError) {
                // console.warn("🛡️ IG Blocker (Outer): Error loading settings.", chrome.runtime.lastError.message);
            } else {
                if (loadedSettingsResult.redirectInstagramReels !== undefined) {
                    effectiveSettings.redirectInstagramReels = loadedSettingsResult.redirectInstagramReels;
                }
                if (loadedSettingsResult.removeInstagramReelsUI !== undefined) {
                    effectiveSettings.removeInstagramReelsUI = loadedSettingsResult.removeInstagramReelsUI;
                }
            }

            // Re-apply initial CSS with potentially loaded settings
            applyInitialCSS(effectiveSettings);

            // Store settings in a data attribute for the injected script to pick up.
            // Ensure documentElement is available (should be at document_start, but good to be safe)
            const setAttrAndInject = () => {
                if (document.documentElement) {
                    document.documentElement.setAttribute(SETTINGS_DATA_ATTRIBUTE, JSON.stringify(effectiveSettings));
                    injectScript(pageScript); // Inject the main operational script
                } else {
                    // This case should be rare if running at document_start and head exists
                    requestAnimationFrame(setAttrAndInject);
                }
            };
            
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', setAttrAndInject);
            } else {
                setAttrAndInject();
            }
        });

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync') {
                let updatedBlockerSettings = {};
                let changed = false;
                settingKeys.forEach(key => {
                    if (changes[key]) {
                        updatedBlockerSettings[key] = changes[key].newValue;
                        initialSettings[key] = changes[key].newValue; // Update outer script's copy too
                        changed = true;
                    }
                });

                if (changed && document.documentElement) {
                    // Update the data attribute
                    document.documentElement.setAttribute(SETTINGS_DATA_ATTRIBUTE, JSON.stringify(initialSettings));
                    // Notify the injected script via custom event
                    document.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, { detail: updatedBlockerSettings }));
                    // Re-apply initial CSS rules in case UI hiding was toggled
                    applyInitialCSS(initialSettings);
                }
            }
        });

    } else {
        // Fallback if storage API is not available
        // console.warn("🛡️ IG Blocker (Outer): Chrome storage API not available. Using default settings for injection.");
        const setAttrAndInjectDefaults = () => {
            if (document.documentElement) {
                 document.documentElement.setAttribute(SETTINGS_DATA_ATTRIBUTE, JSON.stringify(initialSettings));
                 injectScript(pageScript);
            } else {
                requestAnimationFrame(setAttrAndInjectDefaults);
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setAttrAndInjectDefaults);
        } else {
            setAttrAndInjectDefaults();
        }
    }
})();
