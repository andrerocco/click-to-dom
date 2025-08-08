/**
 * Click to DOM
 *
 * Click to DOM is a Chrome extension that tracks pointer events on web pages
 * and calculates the time taken for the DOM to update after these events.
 *
 * It provides a visual indicator for pointer down and up events, and displays
 * the statistics in an overlay on the page.
 */

(function () {
    // Extracts setting else null, preventing error
    async function getExtensionSettings(...keys) {
        try {
            const result = await chrome.storage.sync.get(keys);
            return keys.length > 1 ? result : result[keys[0]] || null;
        } catch (error) {
            // console.error(`Error getting setting ${keys}:`, error);
            return null;
        }
    }

    class PointerIndicatorUI {
        constructor() {
            this.currentIndicator = null;
            this.removeTimeout = null;

            // Settings
            const loadSettings = async () => {
                this.settings.pointerDownColor = await getExtensionSettings("pointerDownColor");
                this.settings.pointerUpColor = await getExtensionSettings("pointerUpColor");
            };
            this.settings = {
                pointerDownColor: null,
                pointerUpColor: null,
            };
            loadSettings();
        }

        showPointerDown(x, y) {
            // console.log("Showing pointer down indicator at", x, y);
            // Clear any existing timeout
            if (this.removeTimeout) {
                clearTimeout(this.removeTimeout);
                this.removeTimeout = null;
            }

            // Remove any existing indicator first
            this.unmount();

            // Create new pointer down indicator
            const element = document.createElement("div");
            element.className = "clicktodom-pointer-indicator clicktodom-pointer-down";
            element.setAttribute("data-extension-ui", "true");
            element.style.left = `${x}px`;
            element.style.top = `${y}px`;

            // Apply custom color if it exists
            if (this.settings.pointerDownColor) {
                element.style.backgroundColor = this.settings.pointerDownColor;
            }

            document.body.appendChild(element);
            this.currentIndicator = element;
        }

        switchToPointerUp(x, y) {
            // Remove existing indicator
            this.unmount();

            // Create new pointer up indicator with animation
            const element = document.createElement("div");
            element.className = "clicktodom-pointer-indicator clicktodom-pointer-up";
            element.setAttribute("data-extension-ui", "true");
            element.style.left = `${x}px`;
            element.style.top = `${y}px`;

            // Apply custom color if it exists
            if (this.settings.pointerUpColor) {
                element.style.backgroundColor = this.settings.pointerUpColor;
            }

            document.body.appendChild(element);
            this.currentIndicator = element;

            // Auto-remove after animation completes
            this.removeTimeout = setTimeout(() => this.unmount(), 500);
        }

        unmount() {
            if (this.currentIndicator) {
                this.currentIndicator.remove();
                this.currentIndicator = null;
            }
        }
    }

    class StatisticsOverlayUI {
        constructor() {
            this.element = null;
            this.visible = false;

            // UI data
            this.stats = {
                pointerdown: { firstDomUpdate: null, lastDomUpdate: null },
                pointerup: { firstDomUpdate: null, lastDomUpdate: null },
            };

            // UI state
            this.dragState = {
                isDragging: false,
                startX: 0,
                startY: 0,
                startLeft: 0,
                startTop: 0,
            };
            this.loadingState = {
                pointerdown: { firstDomUpdate: false, lastDomUpdate: false },
                pointerup: { firstDomUpdate: false, lastDomUpdate: false },
            };
            this.timeoutState = {
                pointerdown: { firstDomUpdate: false, lastDomUpdate: false },
                pointerup: { firstDomUpdate: false, lastDomUpdate: false },
            };

            // Settings with default values
            this.settings = {
                fpsComparisonValue: 60,
                showLastDomUpdate: false,
                emptyStateLabel: "-",
                loadingStateLabel: "Waiting...",
                timeoutStateLabel: "Timed out",
            };
        }

        async mount() {
            const settings = await getExtensionSettings(
                "fpsComparisonValue",
                "showLastDomUpdate",
                "emptyStateLabel",
                "loadingStateLabel",
                "timeoutStateLabel"
            );
            this.settings.fpsComparisonValue = settings?.fpsComparisonValue || this.settings.fpsComparisonValue;
            this.settings.showLastDomUpdate = settings?.showLastDomUpdate || this.settings.showLastDomUpdate;
            this.settings.emptyStateLabel = settings?.emptyStateLabel || this.settings.emptyStateLabel;
            this.settings.loadingStateLabel = settings?.loadingStateLabel || this.settings.loadingStateLabel;
            this.settings.timeoutStateLabel = settings?.timeoutStateLabel || this.settings.timeoutStateLabel;

            // Create overlay element
            const overlay = document.createElement("div");
            overlay.className = "clicktodom-stats-overlay";
            if (this.settings.showLastDomUpdate) {
                overlay.classList.add("clicktodom-show-lastupdate");
            }
            overlay.setAttribute("data-extension-ui", "true"); // Mark as extension UI
            document.body.appendChild(overlay);
            this.element = overlay;

            // Set html content with custom empty state label
            this.element.innerHTML = `
                <div class="clicktodom-stats-section" data-extension-ui="true" >
                    <div class="clicktodom-stats-label" data-extension-ui="true">
                        <span class="clicktodom-stats-title" data-extension-ui="true">Mouse down ↓</span>
                    </div>
                    <div id="clicktodom-pointerdown-firstupdate-delay" class="clicktodom-stats-row" data-extension-ui="true">
                        <div data-extension-ui="true">    
                            <span id="clicktodom-pointerdown-time" class="clicktodom-stats-delay clicktodom-stale" data-extension-ui="true">${
                                this.settings.emptyStateLabel
                            }</span>
                            ${
                                this.settings.showLastDomUpdate
                                    ? `<span class="clicktodom-stats-type" data-extension-ui="true" title="First DOM Update"> (FDU)</span>`
                                    : ""
                            }
                        </div>
                        <span id="clicktodom-pointerdown-frames" class="clicktodom-stats-frames clicktodom-stale" data-extension-ui="true"></span>
                    </div>
                    ${
                        this.settings.showLastDomUpdate
                            ? `
                            <div id="clicktodom-pointerdown-lastupdate-delay" class="clicktodom-stats-row" data-extension-ui="true">
                                <div>
                                    <span id="clicktodom-pointerdown-lastupdate-time" class="clicktodom-stats-delay clicktodom-stale" data-extension-ui="true">${this.settings.emptyStateLabel}</span>
                                    <span class="clicktodom-stats-type" data-extension-ui="true" title="Last DOM Update"> (LDU)</span>
                                </div>
                                <span id="clicktodom-pointerdown-lastupdate-frames" class="clicktodom-stats-frames clicktodom-stale" data-extension-ui="true"></span>
                            </div>
                            `
                            : ""
                    }
                </div>
                <div class="clicktodom-stats-section" data-extension-ui="true">
                    <div class="clicktodom-stats-label" data-extension-ui="true">
                        <span class="clicktodom-stats-title" data-extension-ui="true">Mouse up ↑</span>
                    </div>
                    <div id="clicktodom-pointerup-firstupdate-delay" class="clicktodom-stats-row" data-extension-ui="true">
                        <div data-extension-ui="true">
                            <span id="clicktodom-pointerup-time" class="clicktodom-stats-delay clicktodom-stale" data-extension-ui="true">${
                                this.settings.emptyStateLabel
                            }</span>
                            ${
                                this.settings.showLastDomUpdate
                                    ? `<span class="clicktodom-stats-type" data-extension-ui="true" title="First DOM Update"> (FDU)</span>`
                                    : ""
                            }
                        </div>
                        <span id="clicktodom-pointerup-frames" class="clicktodom-stats-frames clicktodom-stale" data-extension-ui="true"></span>
                    </div>
                    ${
                        this.settings.showLastDomUpdate
                            ? `
                            <div id="clicktodom-pointerup-lastupdate-delay" class="clicktodom-stats-row" data-extension-ui="true">
                                <div data-extension-ui="true">
                                    <span id="clicktodom-pointerup-lastupdate-time" class="clicktodom-stats-delay clicktodom-stale" data-extension-ui="true">${this.settings.emptyStateLabel}</span>
                                    <span class="clicktodom-stats-type" data-extension-ui="true" title="Last DOM Update"> (LDU)</span>
                                </div>
                                <span id="clicktodom-pointerup-lastupdate-frames" class="clicktodom-stats-frames clicktodom-stale" data-extension-ui="true"></span>
                            </div>
                            `
                            : ""
                    }
                </div>
            `;

            // Setup drag
            this.element.addEventListener("mousedown", (e) => {
                this.dragState.isDragging = true;
                this.dragState.startX = e.clientX;
                this.dragState.startY = e.clientY;
                this.dragState.startLeft = parseInt(window.getComputedStyle(this.element).left) || 0;
                this.dragState.startTop = parseInt(window.getComputedStyle(this.element).top) || 0;

                e.preventDefault();
            });
            document.addEventListener("mousemove", (e) => {
                if (!this.dragState.isDragging) return;

                const newLeft = this.dragState.startLeft + e.clientX - this.dragState.startX;
                const newTop = this.dragState.startTop + e.clientY - this.dragState.startY;

                this.element.style.left = `${newLeft}px`;
                this.element.style.top = `${newTop}px`;
            });
            document.addEventListener("mouseup", () => {
                this.dragState.isDragging = false;
            });
        }

        unmount() {
            if (this.element) {
                this.element.remove();
                this.element = null;
            }
        }
        "";
        updateStats(eventType, updateType, duration) {
            if (!this.element || typeof duration !== "number") return;

            // console.log(`Updating stats for ${eventType} - ${updateType}: ${duration}ms`);
            this.stats[eventType][updateType] = duration;
            this.loadingState[eventType][updateType] = false;
            this.timeoutState[eventType][updateType] = false; // Reset timeout state when updating stats
            this.render();
        }

        setLoadingState(eventType, updateType, isLoading) {
            // console.log(`Setting loading state for ${eventType} - ${updateType}: ${isLoading}`);
            this.loadingState[eventType][updateType] = isLoading;
            if (isLoading) {
                this.timeoutState[eventType][updateType] = false; // Reset timeout state when loading
            }
            this.render();
        }

        setTimeoutState(eventType, updateType, isTimedOut) {
            // console.log(`Setting timeout state for ${eventType} - ${updateType}: ${isTimedOut}`);
            this.timeoutState[eventType][updateType] = isTimedOut;
            if (isTimedOut) {
                this.loadingState[eventType][updateType] = false; // Reset loading state when timed out
            }
            this.render();
        }

        render() {
            if (!this.element) return;

            ["pointerdown", "pointerup"].forEach((eventType) => {
                ["firstDomUpdate", "lastDomUpdate"].forEach((updateType) => {
                    if (updateType === "lastDomUpdate" && !this.settings.showLastDomUpdate) return;

                    // Corrected selector to match the HTML structure
                    let timeElId, framesElId;

                    if (updateType === "firstDomUpdate") {
                        timeElId = `clicktodom-${eventType}-time`;
                        framesElId = `clicktodom-${eventType}-frames`;
                    } else {
                        timeElId = `clicktodom-${eventType}-lastupdate-time`;
                        framesElId = `clicktodom-${eventType}-lastupdate-frames`;
                    }

                    const timeEl = this.element.querySelector(`#${timeElId}`);
                    const framesEl = this.element.querySelector(`#${framesElId}`);

                    if (timeEl && framesEl) {
                        const value = this.stats[eventType][updateType];
                        const isLoading = this.loadingState[eventType][updateType];
                        const isTimedOut = this.timeoutState[eventType][updateType];

                        timeEl.classList.remove("clicktodom-loading", "clicktodom-stale", "clicktodom-timeout-label");
                        framesEl.classList.remove("clicktodom-loading", "clicktodom-stale", "clicktodom-timeout-label");

                        if (isLoading) {
                            timeEl.textContent = this.settings.loadingStateLabel;
                            framesEl.textContent = "";
                            timeEl.classList.add("clicktodom-loading");
                            framesEl.classList.add("clicktodom-loading");
                        } else if (isTimedOut) {
                            timeEl.textContent = this.settings.timeoutStateLabel;
                            framesEl.textContent = "";
                            timeEl.classList.add("clicktodom-timeout-label");
                            framesEl.classList.add("clicktodom-timeout-label");
                        } else if (value !== null) {
                            const roundedValue = Math.round(value);
                            timeEl.textContent = `${roundedValue}ms`;

                            // Always ensure we have a valid FPS value (default to 60 if not set)
                            const customFps = this.settings.fpsComparisonValue || 60;
                            const frames = value / (1000 / customFps);
                            const framesText = frames > 10 ? Math.ceil(frames) : frames.toFixed(1);
                            framesEl.textContent = `${framesText}F @ ${customFps}FPS`;
                        } else {
                            timeEl.textContent = this.settings.emptyStateLabel;
                            framesEl.textContent = "";
                            timeEl.classList.add("clicktodom-stale");
                            framesEl.classList.add("clicktodom-stale");
                        }
                    }
                });
            });
        }
    }

    class DOMUpdateTracker {
        constructor() {
            this.active = false;
            this.observers = {};
            this.timeouts = {};
            this.startTimes = {};
            this.hasMutated = {};
            this.lastMutationTimes = {};

            // Settings
            this.settings = {
                enableMutationTimeout: true,
                mutationTimeoutValue: 2500,
                showLastDomUpdate: false,
                timeAfterLastDomUpdate: 1000,
            };

            // Bind the event handlers to preserve context
            this.handlePointerDown = this.handlePointerDown.bind(this);
            this.handlePointerUp = this.handlePointerUp.bind(this);

            // UI elements
            this.pointerIndicatorUI = new PointerIndicatorUI();
            this.statisticsOverlayUI = new StatisticsOverlayUI();

            // Load settings
            this.loadSettings();
        }

        async loadSettings() {
            const settings = await getExtensionSettings(
                "enableMutationTimeout",
                "mutationTimeoutValue",
                "showLastDomUpdate",
                "timeAfterLastDomUpdate"
            );

            if (settings) {
                this.settings.enableMutationTimeout = settings.enableMutationTimeout !== false; // Default to true
                this.settings.mutationTimeoutValue = settings.mutationTimeoutValue || 2500;
                this.settings.showLastDomUpdate = settings.showLastDomUpdate || false;
                this.settings.timeAfterLastDomUpdate = settings.timeAfterLastDomUpdate || 1000; // Default to 1s
            }
            // console.log("DOMUpdateTracker Settings loaded:", this.settings);
        }

        resetObservers(key) {
            if (key) {
                // Clean a specific observer
                if (this.observers[key]) {
                    this.observers[key].disconnect();
                    delete this.observers[key];
                }
            } else {
                // Clean all observers
                Object.values(this.observers).forEach((observer) => observer.disconnect());
                this.observers = {};
            }
        }

        clearTimeouts(key) {
            if (key) {
                // Clear a specific timeout
                if (this.timeouts[key]) {
                    clearTimeout(this.timeouts[key]);
                    delete this.timeouts[key];
                }
            } else {
                // Clear all timeouts
                Object.values(this.timeouts).forEach((timeoutId) => clearTimeout(timeoutId));
                this.timeouts = {};
            }
        }

        isExtensionUINode(node) {
            let current = node;
            if (current.nodeType === Node.ELEMENT_NODE && current.hasAttribute("data-extension-ui")) {
                return true;
            }
            return false;
        }

        isExtensionUIMutation(mutation) {
            if (mutation.type === "childList") {
                return (
                    this.isExtensionUINode(mutation.target) ||
                    (mutation.addedNodes.length > 0 &&
                        Array.from(mutation.addedNodes).some((node) => this.isExtensionUINode(node))) ||
                    (mutation.removedNodes.length > 0 &&
                        Array.from(mutation.removedNodes).some((node) => this.isExtensionUINode(node)))
                );
            } else if (mutation.type === "attributes") {
                return this.isExtensionUINode(mutation.target);
            } else if (mutation.type === "characterData") {
                return this.isExtensionUINode(mutation.target);
            }
            return false;
        }

        /**
         * Calculates and tracks DOM updates after pointer events.
         * This method sets up mutation observers to measure the time between
         * the pointer event and the first/last DOM updates.
         *
         * It handles both first DOM update (initial DOM change) and last DOM update
         * (final DOM change after a settling period), updating the UI accordingly.
         *
         * @param {string} eventType - The type of event ('pointerdown' or 'pointerup')
         */
        calculateUpdate(eventType) {
            if (!this.active) return;

            const startTime = performance.now();
            this.startTimes[eventType] = startTime;
            this.hasMutated[eventType] = false;
            this.lastMutationTimes[eventType] = null;

            // Initialize UI loading states
            this.statisticsOverlayUI.setLoadingState(eventType, "firstDomUpdate", true);
            if (this.settings.showLastDomUpdate) {
                this.statisticsOverlayUI.setLoadingState(eventType, "lastDomUpdate", true);
            }

            this.resetObservers(eventType);
            this.clearTimeouts(eventType);

            // MutationObserver callback handles DOM changes: Tracks first DOM update timing
            // and optionally last DOM update.
            const observer = new MutationObserver((mutations) => {
                // TODO: Check if that is being used at all
                if (!this.active) {
                    observer.disconnect();
                    return;
                }
                // Filters out mutations caused by the extension's own UI
                if (mutations.every((mutation) => this.isExtensionUIMutation(mutation))) return;

                const now = performance.now();

                // Sets the the first DOM update (FDU) delay
                if (!this.hasMutated[eventType]) {
                    this.hasMutated[eventType] = true;
                    const firstDomUpdateDuration = now - startTime;
                    this.statisticsOverlayUI.updateStats(eventType, "firstDomUpdate", firstDomUpdateDuration);
                }

                // Stores the last mutation time
                this.lastMutationTimes[eventType] = now;

                if (this.settings.showLastDomUpdate) {
                    // If the user is tracking last DOM update, sets a timeout to wait for a period
                    // of inactivity before marking the last mutation before this inactivity as the
                    // last DOM update.

                    clearTimeout(this.timeouts[eventType]);
                    this.timeouts[eventType] = setTimeout(() => {
                        const lastDomUpdateDuration = this.lastMutationTimes[eventType] - startTime;
                        this.statisticsOverlayUI.updateStats(eventType, "lastDomUpdate", lastDomUpdateDuration);

                        observer.disconnect();
                        delete this.observers[eventType];
                    }, this.settings.timeAfterLastDomUpdate);
                } else {
                    // If the user is not tracking last DOM update, disconnects the observer
                    // after the first mutation is detected.
                    observer.disconnect();
                    delete this.observers[eventType];
                }
            });

            this.observers[eventType] = observer;

            // Start observing DOM changes
            observer.observe(document, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true,
            });

            // Timeout handlers for no-mutation cases
            if (this.settings.enableMutationTimeout) {
                this.timeouts[`${eventType}_fdu`] = setTimeout(() => {
                    if (!this.hasMutated[eventType]) {
                        this.statisticsOverlayUI.setTimeoutState(eventType, "firstDomUpdate", true);
                        this.statisticsOverlayUI.stats[eventType].firstDomUpdate = null;
                    }
                    // Conditionally disconnect the observer (so that the timeout time set to)
                    if (!this.settings.showLastDomUpdate) {
                        observer.disconnect();
                        delete this.observers[eventType];
                    }
                }, this.settings.mutationTimeoutValue);
            }
            if (this.settings.showLastDomUpdate) {
                this.timeouts[`${eventType}_ldu`] = setTimeout(() => {
                    if (!this.hasMutated[eventType]) {
                        this.statisticsOverlayUI.setTimeoutState(eventType, "lastDomUpdate", true);
                        this.statisticsOverlayUI.stats[eventType].lastDomUpdate = null;
                    }
                    observer.disconnect();
                    delete this.observers[eventType];
                }, this.settings.timeAfterLastDomUpdate);
            }
        }

        isExtensionUIEvent(event) {
            if (!event || !event.target) return false;
            if (this.statisticsOverlayUI.element && this.statisticsOverlayUI.element.contains(event.target)) {
                return true;
            }
            if (event.target.hasAttribute && event.target.hasAttribute("data-extension-ui")) {
                return true;
            }
            return false;
        }

        handlePointerDown(event) {
            if (!this.active) return;
            if (this.isExtensionUIEvent(event)) return;

            this.resetObservers();
            this.clearTimeouts();
            this.pointerIndicatorUI.showPointerDown(event.clientX, event.clientY);

            this.calculateUpdate(event.type);
        }

        handlePointerUp(event) {
            if (!this.active) return;
            if (this.isExtensionUIEvent(event)) return;

            this.clearTimeouts("pointerup");
            this.pointerIndicatorUI.switchToPointerUp(event.clientX, event.clientY);
            this.calculateUpdate(event.type);
        }

        activate() {
            if (this.active) return;

            this.active = true;
            document.addEventListener("pointerdown", this.handlePointerDown, true);
            document.addEventListener("pointerup", this.handlePointerUp, true);
            this.statisticsOverlayUI.mount();
        }

        deactivate() {
            if (!this.active) return;

            document.removeEventListener("pointerdown", this.handlePointerDown, true);
            document.removeEventListener("pointerup", this.handlePointerUp, true);
            this.active = false;
            this.resetObservers();
            this.clearTimeouts();

            // Unmount the overlay and pointer indicator
            this.statisticsOverlayUI.unmount();
            this.pointerIndicatorUI.unmount();
        }

        isActive() {
            return this.active;
        }
    }

    if (window._domUpdateTrackerActive) {
        // console.log("DOMUpdateTracker already initialized, not loading again");
    } else {
        window._domUpdateTrackerActive = true; // Global flag to prevent multiple instances

        const tracker = new DOMUpdateTracker();

        chrome.runtime.sendMessage({ action: "getState" }, (response) => {
            if (response && response.isActive) {
                tracker.activate();
            } else {
                tracker.deactivate();
            }
        });

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // console.log("Message received:", message.action);

            switch (message.action) {
                case "activate":
                    tracker.deactivate(); // First ensure it's clean
                    tracker.activate();
                    sendResponse({
                        success: true,
                        isActive: true,
                    });
                    break;
                case "deactivate":
                    tracker.deactivate();
                    sendResponse({
                        success: true,
                        isActive: false,
                    });
                    break;
                case "getState":
                    sendResponse({
                        success: true,
                        isActive: tracker.isActive(),
                    });
                    break;
            }
            return true; // Required to use sendResponse asynchronously
        });
    }
})();
