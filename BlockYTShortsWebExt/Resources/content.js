// content.js - For YouTube pages

(function() {
    console.log("🛡️ BlockYTShorts & Visual Modifier: content.js starting on:", window.location.href);

    // --- Configuration ---
    let currentUserSettings = {
        redirectShorts: true,
        removeShortsUI: true,              // For general Shorts UI elements
        removeAdditionalShortsShelves: true, // For specific 'is-shorts' shelves (e.g., in search)
        grayscaleThumbnails: false,
        modifyTitles: false,
        removeYouTubeLogo: false,
        // Assuming Instagram settings are handled by a different content script or not relevant here
        // redirectInstagramReels: true,
        // removeInstagramReelsUI: true
    };
    let iapUnlockStatus = {
        isRemoveYouTubeLogoEnabled: false,
        isBetaAccessEnabled: false
    };
    const CHROME_STORAGE_IAP_STATUS_KEY = "extension_iap_status";
    const BLOCKYT_STYLE_ID = 'blockyt-logo-hide-style';

    const EMOJI_REGEX = /[\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u{200D}\p{Extended_Pictographic}\p{So}\p{Sk}]/gu;
    const PROCESSED_TITLE_MARKER = 'data-title-modified';
    const PROCESSED_THUMBNAIL_MARKER = 'data-thumbnail-modified';

    let lastAttemptedRedirectPath = null;
    let lastRedirectAttemptTime = 0;
    let lastProcessedPath = window.location.pathname + window.location.search;
    let domChangeObserver = null;

    function manageLogoHidingStyle(shouldHide) {
        let styleElement = document.getElementById(BLOCKYT_STYLE_ID);
        if (shouldHide) {
            if (!styleElement) {
                styleElement = document.createElement('style');
                styleElement.id = BLOCKYT_STYLE_ID;
                (document.head || document.documentElement).appendChild(styleElement);
            }
            const selectorsToHide = [
                'ytd-topbar-logo-renderer#logo', '#logo-icon-container', 'a#logo yt-icon',
                '#masthead #logo', 'ytm-home-logo', '.ytmusic-nav-bar ytmusic-logo',
                '.ytp-chrome-top .ytp-youtube-button'
            ];
            styleElement.textContent = `${selectorsToHide.join(',\n')} { display: none !important; visibility: hidden !important; }`;
        } else {
            if (styleElement) styleElement.textContent = '';
        }
    }

    function applyYouTubeLogoVisibility() {
        const shouldRemoveLogo = iapUnlockStatus.isRemoveYouTubeLogoEnabled && currentUserSettings.removeYouTubeLogo;
        console.log('🛡️ BlockYTShorts: Logo Visibility Check -> IAP Unlocked:', iapUnlockStatus.isRemoveYouTubeLogoEnabled, '| User Toggle On:', currentUserSettings.removeYouTubeLogo, '| ==> Should Hide Logo:', shouldRemoveLogo);
        manageLogoHidingStyle(shouldRemoveLogo);
    }

    function attemptShortsRedirect() {
        if (!currentUserSettings.redirectShorts) return false;
        const currentPath = window.location.pathname;
        if (currentPath.startsWith("/shorts/") && currentPath.split("/").filter(Boolean).length > 1) {
            const videoId = currentPath.split("/")[2];
            if (videoId && videoId.trim() !== "") {
                if (lastAttemptedRedirectPath === currentPath && (Date.now() - lastRedirectAttemptTime) < 4000) return false;
                lastAttemptedRedirectPath = currentPath;
                lastRedirectAttemptTime = Date.now();
                const watchUrl = "/watch?v=" + videoId;
                console.log("🛡️ BlockYTShorts: Redirecting Shorts URL:", currentPath, "to:", watchUrl);
                try { window.location.replace(watchUrl); } catch (e) { console.error("🛡️ BlockYTShorts: Redirect error:", e); }
                return true;
            }
        }
        return false;
    }

    function removeElement(element, type) {
        if (element && typeof element.remove === 'function') {
            console.log(`🛡️ BlockYTShorts: Removing ${type}`, element.outerHTML.substring(0,100));
            element.remove();
        }
    }

    function removeSidebarShorts() {
        if (!currentUserSettings.removeShortsUI) return;
        document.querySelectorAll('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer').forEach(entry => {
            const titleElement = entry.querySelector('a#endpoint .title, yt-formatted-string#title, span#title');
            if (titleElement && titleElement.textContent?.trim().toLowerCase() === 'shorts') {
                removeElement(entry.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer') || entry, "sidebar Shorts entry");
            }
            const link = entry.querySelector('a#endpoint');
            if (link && link.getAttribute('href') === '/shorts') {
                removeElement(entry.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer') || entry, "sidebar Shorts link");
            }
        });
    }

    function removeGeneralShortsShelvesAndCards() {
        if (!currentUserSettings.removeShortsUI) return;

        document.querySelectorAll('ytd-rich-shelf-renderer:not([is-shorts]), ytd-reel-shelf-renderer:not([is-shorts])').forEach(shelf => {
            const headerElement = shelf.querySelector('#title-container #title, #title.ytd-reel-shelf-renderer, h2.ytd-rich-shelf-renderer span#title, h2.ytd-rich-shelf-renderer yt-icon + div #title');
            if (headerElement) {
                const headerText = headerElement.textContent?.trim().toLowerCase();
                const isShortsContentDominant = shelf.querySelector('ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"], ytd-reel-item-renderer') !== null;
                if (headerText === 'shorts' || headerText === 'youtube shorts' || (headerText && headerText.includes('shorts') && isShortsContentDominant)) {
                    removeElement(shelf, "General Desktop Shorts shelf (not 'is-shorts' type): " + headerText);
                }
            }
        });
        document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-reel-item-renderer').forEach(card => {
            if (card.querySelector('ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]') ||
                card.tagName.toLowerCase() === 'ytd-reel-item-renderer' ||
                card.querySelector('a#thumbnail[href^="/shorts/"]')) {
                // Avoid removing items within a shelf that is *itself* a Shorts shelf handled by another function
                if (!card.closest('ytd-rich-shelf-renderer[is-shorts]')) {
                     removeElement(card, "General Desktop Shorts card/item");
                }
            }
        });
        const mobileShelfSelectors = 'ytm-reel-shelf-renderer:not([is-shorts]), ytm-item-section-renderer[data-identifier*="shorts"]:not([is-shorts]), ytm-shelf-renderer[shelf-style="REELS"]:not([is-shorts])';
        document.querySelectorAll(mobileShelfSelectors).forEach(shelf => {
            const headerElement = shelf.querySelector('.shelf-title, .title-container .title, .section-title, h3');
            let headerText = headerElement ? headerElement.textContent?.trim().toLowerCase() : "";
            if (headerText.includes('shorts') || shelf.querySelector('ytm-reel-item-renderer') || shelf.getAttribute('shelf-style')?.toUpperCase() === 'REELS' || shelf.getAttribute('data-identifier')?.includes('shorts')) {
                removeElement(shelf, "General Mobile Shorts shelf (not 'is-shorts' type)");
            }
        });
    }

    function removeSpecificIsShortsShelves() {
        if (!currentUserSettings.removeAdditionalShortsShelves) return;

        document.querySelectorAll('ytd-rich-shelf-renderer[is-shorts]').forEach(shelf => {
            const titleElement = shelf.querySelector('#rich-shelf-header #title-text #title');
            const hasShortsIcon = shelf.querySelector('#rich-shelf-header yt-icon path[d^="m19.45,3.88"]');

            if (hasShortsIcon || (titleElement && titleElement.textContent?.trim().toLowerCase() === 'shorts')) {
                removeElement(shelf, "Specific 'is-shorts' Shelf (e.g., Search/Home)");
            }
        });
    }
    
    function removeMobileSpecificShortsElements() {
        if (!currentUserSettings.removeShortsUI) return;
        document.querySelectorAll('ytm-pivot-bar-item-renderer').forEach(item => {
            if (item.querySelector('.pivot-shorts') && item.textContent?.trim().toLowerCase() === "shorts") {
                removeElement(item, "Mobile Shorts pivot tab");
            }
        });
        document.querySelectorAll('ytm-navigation-item-renderer a[href="/shorts"], ytm-compact-link-renderer a[href="/shorts"]').forEach(a => {
            removeElement(a.closest('ytm-navigation-item-renderer, ytm-compact-link-renderer, li'), "Mobile Shorts nav link");
        });
    }

    function makeThumbnailsGrayscale() {
        const applyGrayscale = currentUserSettings.grayscaleThumbnails;
        const selectors = [
            'yt-image > img.yt-core-image:not(.yt-core-image--content-mode-scale-to-fill)', 'ytd-thumbnail img#img',
            'ytm-media-item .media-item-thumbnail-container img', 'ytm-thumbnail-renderer img',
            'ytm-video-with-context-renderer .media-item-thumbnail-container img', 'ytm-playlist-video-renderer .media-item-thumbnail-container img'
        ];
        document.querySelectorAll(`[${PROCESSED_THUMBNAIL_MARKER}]`).forEach(markerElement => {
            const img = markerElement.matches('img') ? markerElement : markerElement.querySelector('img');
            if (!applyGrayscale && img) img.style.filter = '';
            if (!applyGrayscale) markerElement.removeAttribute(PROCESSED_THUMBNAIL_MARKER);
        });
        if (!applyGrayscale) return;
        const unprocessedSelector = selectors.map(sel => `${sel}:not([${PROCESSED_THUMBNAIL_MARKER}])`).join(', ');
        document.querySelectorAll(unprocessedSelector).forEach(img => {
            const parentThumbnailWrapper = img.closest('ytd-thumbnail, ytm-media-item, ytm-thumbnail-renderer, .media-item-thumbnail-container, ytm-video-with-context-renderer');
            const markerElement = parentThumbnailWrapper || img;
            if (markerElement.hasAttribute(PROCESSED_THUMBNAIL_MARKER)) return;
            img.style.filter = 'grayscale(100%)';
            markerElement.setAttribute(PROCESSED_THUMBNAIL_MARKER, 'true');
        });
    }

    function modifyVideoTitles() {
        const applyModification = currentUserSettings.modifyTitles;
        if (!applyModification) return;
        const titleSelectors = [
            'yt-formatted-string#video-title', 'a#video-title yt-formatted-string', 'ytd-rich-grid-media #video-title.yt-formatted-string',
            'ytd-video-renderer #video-title yt-formatted-string', 'ytd-compact-video-renderer #video-title yt-formatted-string',
            'ytd-playlist-panel-video-renderer #video-title', 'ytd-watch-metadata h1.title yt-formatted-string',
            'span#video-title.ytd-playlist-video-renderer',
            'ytm-video-with-context-renderer .media-item-metadata .media-item-title',
            'ytm-compact-video-renderer .compact-media-item-headline', 'ytm-slim-video-metadata-renderer .slim-video-title',
            'ytm-playlist-video-renderer .playlist-video-title', 'h3.media-item-title', '.title.ytm-slim-video-metadata-renderer'
        ];
        const combinedSelector = titleSelectors.map(sel => `${sel}:not([${PROCESSED_TITLE_MARKER}])`).join(', ');
        document.querySelectorAll(combinedSelector).forEach(titleEl => {
            if (titleEl.hasAttribute(PROCESSED_TITLE_MARKER)) return;
            let originalText = titleEl.textContent || "";
            let newText = originalText.replace(EMOJI_REGEX, '').trim().toLowerCase();
            if (newText !== originalText.trim().toLowerCase()) titleEl.textContent = newText;
            titleEl.setAttribute(PROCESSED_TITLE_MARKER, 'true');
        });
    }

    function performAllRemovalsAndModifications() {
        if (attemptShortsRedirect()) return;
        removeSidebarShorts();                   // Controlled by removeShortsUI
        removeGeneralShortsShelvesAndCards();    // Controlled by removeShortsUI
        removeMobileSpecificShortsElements();    // Controlled by removeShortsUI
        removeSpecificIsShortsShelves();         // Controlled by removeAdditionalShortsShelves
        makeThumbnailsGrayscale();
        modifyVideoTitles();
        applyYouTubeLogoVisibility();
    }

    function handleUrlChange() {
        requestAnimationFrame(() => {
            const newPath = window.location.pathname + window.location.search;
            if (newPath !== lastProcessedPath) {
                console.log("🛡️ BlockYTShorts: URL changed to", newPath, ". Re-evaluating page.");
                lastProcessedPath = newPath;
                document.querySelectorAll(`[${PROCESSED_TITLE_MARKER}],[${PROCESSED_THUMBNAIL_MARKER}]`).forEach(el => {
                    el.removeAttribute(PROCESSED_TITLE_MARKER);
                    el.removeAttribute(PROCESSED_THUMBNAIL_MARKER);
                    if (el.style.filter === 'grayscale(100%)') el.style.filter = '';
                });
                if (attemptShortsRedirect()) return;
                performAllRemovalsAndModifications();
            }
        });
    }

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    function main() {
        if (attemptShortsRedirect()) return;
        performAllRemovalsAndModifications();

        ['pushState', 'replaceState'].forEach(method => {
            const original = history[method];
            history[method] = function() {
                const result = original.apply(this, arguments);
                setTimeout(handleUrlChange, 0);
                return result;
            };
        });
        window.addEventListener('popstate', handleUrlChange);

        if (domChangeObserver) domChangeObserver.disconnect();
        domChangeObserver = new MutationObserver(debounce(() => {
            if (window.location.pathname.startsWith("/shorts/") && window.location.pathname.split("/").filter(Boolean).length > 1) {
                if (attemptShortsRedirect()) return;
            }
            performAllRemovalsAndModifications();
        }, 300));
        domChangeObserver.observe(document.documentElement, { childList: true, subtree: true });
        console.log("🛡️ BlockYTShorts: Initial setup complete. Settings:", JSON.parse(JSON.stringify(currentUserSettings)), "IAP:", iapUnlockStatus);
    }
    
    function loadAllSettingsAndRun() {
        if (chrome && chrome.storage && chrome.storage.sync) {
            const keysToFetch = [CHROME_STORAGE_IAP_STATUS_KEY, ...Object.keys(currentUserSettings)];
            chrome.storage.sync.get(keysToFetch, (result) => {
                if (chrome.runtime.lastError) {
                    console.error('🛡️ BlockYTShorts (Content): Error loading from sync storage:', chrome.runtime.lastError.message, ". Using defaults.");
                } else {
                    if (result[CHROME_STORAGE_IAP_STATUS_KEY]) {
                        iapUnlockStatus = { ...iapUnlockStatus, ...result[CHROME_STORAGE_IAP_STATUS_KEY] };
                    }
                    for (const key in currentUserSettings) {
                        if (result.hasOwnProperty(key)) {
                           if (typeof currentUserSettings[key] === typeof result[key] || typeof result[key] === 'undefined' || result[key] === null) {
                                currentUserSettings[key] = result[key];
                           } else {
                               console.warn(`🛡️ BlockYTShorts (Content): Type mismatch for setting '${key}'. Loaded type: ${typeof result[key]}, Default type: ${typeof currentUserSettings[key]}. Value:`, result[key], `. Using default value: ${currentUserSettings[key]}`);
                           }
                        }
                    }
                }
                console.log('🛡️ BlockYTShorts (Content): Effective User Settings After Load:', JSON.parse(JSON.stringify(currentUserSettings)));
                console.log('🛡️ BlockYTShorts (Content): Effective IAP Status After Load:', iapUnlockStatus);
                main();
            });
        } else {
            console.warn('🛡️ BlockYTShorts (Content): Storage API not found. Using defaults.');
            main();
        }
    }

    if (chrome && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(function(changes, namespace) {
            if (namespace === 'sync') {
                let needsReapply = false;
                console.log("🛡️ BlockYTShorts (Content): chrome.storage.onChanged detected changes:", changes);
                if (changes[CHROME_STORAGE_IAP_STATUS_KEY]) {
                    const newIAP = changes[CHROME_STORAGE_IAP_STATUS_KEY].newValue;
                    if (newIAP && (newIAP.isRemoveYouTubeLogoEnabled !== iapUnlockStatus.isRemoveYouTubeLogoEnabled || newIAP.isBetaAccessEnabled !== iapUnlockStatus.isBetaAccessEnabled) ) {
                        iapUnlockStatus = { ...iapUnlockStatus, ...newIAP };
                        needsReapply = true;
                    }
                }
                for (let key in currentUserSettings) {
                    if (changes[key] && currentUserSettings[key] !== changes[key].newValue) {
                        currentUserSettings[key] = changes[key].newValue;
                        needsReapply = true;
                    }
                }
                if (needsReapply) {
                    console.log('🛡️ BlockYTShorts (Content): Settings or IAP changed, re-applying. New Settings:', JSON.parse(JSON.stringify(currentUserSettings)), "New IAP:", iapUnlockStatus);
                    performAllRemovalsAndModifications();
                }
            }
        });
    }

    loadAllSettingsAndRun();

})();
