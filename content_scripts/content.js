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
            console.error(`Error getting setting ${keys}:`, error);
            return null;
        }
    }

    class PointerIndicatorUI {
        constructor() {
            this.currentIndicator = null;
            this.removeTimeout = null;

            // Settings // TODO: Check if this code is stupid
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
            console.log("Showing pointer down indicator at", x, y);
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
                pointerdown: { firstPaint: null, lastContentPaint: null },
                pointerup: { firstPaint: null, lastContentPaint: null },
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
                pointerdown: { firstPaint: false, lastContentPaint: false },
                pointerup: { firstPaint: false, lastContentPaint: false },
            };
            this.timeoutState = {
                pointerdown: { firstPaint: false, lastContentPaint: false },
                pointerup: { firstPaint: false, lastContentPaint: false },
            };

            // Settings with default values
            this.settings = {
                fpsComparisonValue: 60,
                showLastContentPaint: false,
            };
        }

        async mount() {
            const settings = await getExtensionSettings("fpsComparisonValue", "showLastContentPaint");
            this.settings.fpsComparisonValue = settings?.fpsComparisonValue || this.settings.fpsComparisonValue;
            this.settings.showLastContentPaint = settings?.showLastContentPaint || this.settings.showLastContentPaint;
            console.log("StatisticsOverlayUI Settings loaded:", this.settings);

            // Create overlay element
            const overlay = document.createElement("div");
            overlay.className = "clicktodom-stats-overlay";
            overlay.setAttribute("data-extension-ui", "true"); // Mark as extension UI
            document.body.appendChild(overlay);
            this.element = overlay;

            // Set html content
            this.element.innerHTML = `
                <div class="clicktodom-stats-section" data-extension-ui="true">
                    <div class="clicktodom-stats-label" data-extension-ui="true">
                        <span class="clicktodom-stats-title" data-extension-ui="true">Mouse down ↓</span>
                    </div>
                    <div id="clicktodom-pointerdown-firstpaint-delay" class="clicktodom-stats-row" data-extension-ui="true">
                        <div data-extension-ui="true">    
                            <span id="clicktodom-pointerdown-time" class="clicktodom-stats-delay clicktodom-stale" data-extension-ui="true">-</span>
                            ${
                                this.settings.showLastContentPaint
                                    ? `<span class="clicktodom-stats-type" data-extension-ui="true"> (FP)</span>`
                                    : ""
                            }
                        </div>
                        <span id="clicktodom-pointerdown-frames" class="clicktodom-stats-frames clicktodom-stale" data-extension-ui="true"></span>
                    </div>
                    ${
                        this.settings.showLastContentPaint
                            ? `
                            <div id="clicktodom-pointerdown-lastpaint-delay" class="clicktodom-stats-row" data-extension-ui="true">
                                <div>
                                    <span id="clicktodom-pointerdown-lastpaint-time" class="clicktodom-stats-delay clicktodom-stale" data-extension-ui="true">-</span>
                                    <span class="clicktodom-stats-type" data-extension-ui="true"> (LCP)</span>
                                </div>
                                <span id="clicktodom-pointerdown-lastpaint-frames" class="clicktodom-stats-frames clicktodom-stale" data-extension-ui="true"></span>
                            </div>
                            `
                            : ""
                    }
                </div>
                <div class="clicktodom-stats-section" data-extension-ui="true">
                    <div class="clicktodom-stats-label" data-extension-ui="true">
                        <span class="clicktodom-stats-title" data-extension-ui="true">Mouse up ↑</span>
                    </div>
                    <div id="clicktodom-pointerup-firstpaint-delay" class="clicktodom-stats-row" data-extension-ui="true">
                        <div data-extension-ui="true">
                            <span id="clicktodom-pointerup-time" class="clicktodom-stats-delay clicktodom-stale" data-extension-ui="true">-</span>
                            ${
                                this.settings.showLastContentPaint
                                    ? `<span class="clicktodom-stats-type" data-extension-ui="true"> (FP)</span>`
                                    : ""
                            }
                        </div>
                        <span id="clicktodom-pointerup-frames" class="clicktodom-stats-frames clicktodom-stale" data-extension-ui="true"></span>
                    </div>
                    ${
                        this.settings.showLastContentPaint
                            ? `
                            <div id="clicktodom-pointerup-lastpaint-delay" class="clicktodom-stats-row" data-extension-ui="true">
                                <div data-extension-ui="true">
                                    <span id="clicktodom-pointerup-lastpaint-time" class="clicktodom-stats-delay clicktodom-stale" data-extension-ui="true">-</span>
                                    <span class="clicktodom-stats-type" data-extension-ui="true"> (LCP)</span>
                                </div>
                                <span id="clicktodom-pointerup-lastpaint-frames" class="clicktodom-stats-frames clicktodom-stale" data-extension-ui="true"></span>
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

        updateStats(eventType, paintType, duration) {
            if (!this.element || typeof duration !== "number") return;

            console.log(`Updating stats for ${eventType} - ${paintType}: ${duration}ms`);
            this.stats[eventType][paintType] = duration;
            this.loadingState[eventType][paintType] = false;
            this.timeoutState[eventType][paintType] = false; // Reset timeout state when updating stats
            this.render();
        }

        setLoadingState(eventType, paintType, isLoading) {
            console.log(`Setting loading state for ${eventType} - ${paintType}: ${isLoading}`);
            this.loadingState[eventType][paintType] = isLoading;
            if (isLoading) {
                this.timeoutState[eventType][paintType] = false; // Reset timeout state when loading
            }
            this.render();
        }

        setTimeoutState(eventType, paintType, isTimedOut) {
            console.log(`Setting timeout state for ${eventType} - ${paintType}: ${isTimedOut}`);
            this.timeoutState[eventType][paintType] = isTimedOut;
            if (isTimedOut) {
                this.loadingState[eventType][paintType] = false; // Reset loading state when timed out
            }
            this.render();
        }

        render() {
            console.log("Rendering overlay");
            if (!this.element) return;

            ["pointerdown", "pointerup"].forEach((eventType) => {
                ["firstPaint", "lastContentPaint"].forEach((paintType) => {
                    if (paintType === "lastContentPaint" && !this.settings.showLastContentPaint) return;

                    // Corrected selector to match the HTML structure
                    let timeElId, framesElId;

                    if (paintType === "firstPaint") {
                        timeElId = `clicktodom-${eventType}-time`;
                        framesElId = `clicktodom-${eventType}-frames`;
                    } else {
                        timeElId = `clicktodom-${eventType}-lastpaint-time`;
                        framesElId = `clicktodom-${eventType}-lastpaint-frames`;
                    }

                    const timeEl = this.element.querySelector(`#${timeElId}`);
                    const framesEl = this.element.querySelector(`#${framesElId}`);

                    if (timeEl && framesEl) {
                        const value = this.stats[eventType][paintType];
                        const isLoading = this.loadingState[eventType][paintType];
                        const isTimedOut = this.timeoutState[eventType][paintType];

                        timeEl.classList.remove("clicktodom-loading", "clicktodom-stale", "clicktodom-timeout-label");
                        framesEl.classList.remove("clicktodom-loading", "clicktodom-stale", "clicktodom-timeout-label");

                        if (isLoading) {
                            timeEl.textContent = "Waiting...";
                            framesEl.textContent = "";
                            timeEl.classList.add("clicktodom-loading");
                            framesEl.classList.add("clicktodom-loading");
                        } else if (isTimedOut) {
                            timeEl.textContent = "Timed out";
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
                            timeEl.textContent = "-";
                            framesEl.textContent = "";
                            timeEl.classList.add("clicktodom-stale");
                            framesEl.classList.add("clicktodom-stale");
                        }
                    } else {
                        console.log(`Element not found for ${eventType} - ${paintType}`);
                    }
                });
            });
        }
    }

    class DOMPaintTracker {
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
                showLastContentPaint: false,
                timeAfterLastContentPaint: 1000,
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
                "showLastContentPaint",
                "timeAfterLastContentPaint"
            );

            if (settings) {
                this.settings.enableMutationTimeout = settings.enableMutationTimeout !== false; // Default to true
                this.settings.mutationTimeoutValue = settings.mutationTimeoutValue || 2500;
                this.settings.showLastContentPaint = settings.showLastContentPaint || false;
                this.settings.timeAfterLastContentPaint = settings.timeAfterLastContentPaint || 1000; // Default to 1s
            }
            console.log("DOMPaintTracker Settings loaded:", this.settings);
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
         * It handles both first paint (initial DOM change) and last content paint
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
            this.statisticsOverlayUI.setLoadingState(eventType, "firstPaint", true);
            if (this.settings.showLastContentPaint) {
                this.statisticsOverlayUI.setLoadingState(eventType, "lastContentPaint", true);
            }

            this.resetObservers(eventType);
            this.clearTimeouts(eventType);

            // MutationObserver callback handles DOM changes: Tracks first paint timing
            // and optionally last content paint.
            const observer = new MutationObserver((mutations) => {
                // TODO: Check if that is being used at all
                if (!this.active) {
                    observer.disconnect();
                    return;
                }
                // Filters out mutations caused by the extension's own UI
                if (mutations.every((mutation) => this.isExtensionUIMutation(mutation))) return;

                const now = performance.now();

                // Sets the the first paint (FP) delay
                if (!this.hasMutated[eventType]) {
                    this.hasMutated[eventType] = true;
                    const firstPaintDuration = now - startTime;
                    this.statisticsOverlayUI.updateStats(eventType, "firstPaint", firstPaintDuration);
                }

                // Stores the last mutation time
                this.lastMutationTimes[eventType] = now;

                if (this.settings.showLastContentPaint) {
                    // If the user is tracking last content paint, sets a timeout to wait for a period
                    // of inactivity before marking the last mutation before this inactivity as the
                    // last content paint.

                    clearTimeout(this.timeouts[eventType]);
                    this.timeouts[eventType] = setTimeout(() => {
                        const lastContentPaintDuration = this.lastMutationTimes[eventType] - startTime;
                        this.statisticsOverlayUI.updateStats(eventType, "lastContentPaint", lastContentPaintDuration);

                        observer.disconnect();
                        delete this.observers[eventType];
                    }, this.settings.timeAfterLastContentPaint);
                } else {
                    // If the user is not tracking last content paint, disconnects the observer
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

            // Set up timeout handlers for no-mutation cases.
            if (this.settings.showLastContentPaint) {
                this.timeouts[eventType] = setTimeout(() => {
                    if (!this.hasMutated[eventType]) {
                        this.statisticsOverlayUI.setTimeoutState(eventType, "firstPaint", true);
                        this.statisticsOverlayUI.setTimeoutState(eventType, "lastContentPaint", true);
                        this.statisticsOverlayUI.stats[eventType].firstPaint = null;
                        this.statisticsOverlayUI.stats[eventType].lastContentPaint = null;
                    }
                    observer.disconnect();
                    delete this.observers[eventType];
                }, this.settings.timeAfterLastContentPaint);
            } else if (this.settings.enableMutationTimeout) {
                this.timeouts[eventType] = setTimeout(() => {
                    console.log("Mutation timeout reached, resetting observers", eventType);
                    if (this.observers[eventType]) {
                        this.resetObservers(eventType);
                        this.statisticsOverlayUI.setTimeoutState(eventType, "firstPaint", true);
                        this.statisticsOverlayUI.stats[eventType].firstPaint = null;
                        this.statisticsOverlayUI.render();
                    }
                }, this.settings.mutationTimeoutValue);
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
            console.log("Tracker event listeners activated");
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

            console.log("Tracker event listeners deactivated");
        }

        isActive() {
            return this.active;
        }
    }

    if (window._domPaintTrackerActive) {
        console.log("DOMPaintTracker already initialized, not loading again");
    } else {
        window._domPaintTrackerActive = true; // Global flag to prevent multiple instances

        const tracker = new DOMPaintTracker();

        chrome.runtime.sendMessage({ action: "getState" }, (response) => {
            if (response && response.isActive) {
                tracker.activate();
            } else {
                tracker.deactivate();
            }
        });

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log("Message received:", message.action);

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
