/**
 * Next Frame Extension
 *
 * Next Frame is a Chrome extension that tracks pointer events on web pages
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
            this.settings = {
                pointerDownColor: null,
                pointerUpColor: null,
            };
            this.loadSettings();
        }

        async loadSettings() {
            this.settings.pointerDownColor = await getExtensionSettings("pointerDownColor");
            this.settings.pointerUpColor = await getExtensionSettings("pointerUpColor");
        }

        showPointerDown(x, y) {
            // Clear any existing timeout
            if (this.removeTimeout) {
                clearTimeout(this.removeTimeout);
                this.removeTimeout = null;
            }

            // Remove any existing indicator first
            this.removeCurrentIndicator();

            // Create new pointer down indicator
            const element = document.createElement("div");
            element.className = "next-frame-pointer-indicator next-frame-pointer-down";
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
            this.removeCurrentIndicator();

            // Create new pointer up indicator with animation
            const element = document.createElement("div");
            element.className = "next-frame-pointer-indicator next-frame-pointer-up";
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
            this.removeTimeout = setTimeout(() => this.removeCurrentIndicator(), 500);
        }

        removeCurrentIndicator() {
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
            this.dragState = {
                isDragging: false,
                startX: 0,
                startY: 0,
                startLeft: 0,
                startTop: 0,
            };
            this.loadingState = {
                pointerdown: false,
                pointerup: false,
            };
            this.stats = {
                pointerdown: null,
                pointerup: null,
            };
            this.settings = {
                fpsComparisonValue: 60,
                showLastContentPaint: false,
            };
            this.loadSettings();
            this.init();
            this.setupDrag();
            this.render(); // Initial render
        }

        async loadSettings() {
            const settings = await getExtensionSettings("fpsComparisonValue", "showLastContentPaint");

            if (settings) {
                this.settings.fpsComparisonValue = settings.fpsComparisonValue || 60;
                this.settings.showLastContentPaint = settings.showLastContentPaint || false;
            }

            // Update the overlay with the loaded settings
            if (this.element) {
                this.render();
            }
        }

        init() {
            // Create overlay element
            const overlay = document.createElement("div");
            overlay.className = "next-frame-stats-overlay";
            overlay.setAttribute("data-extension-ui", "true"); // Mark as extension UI
            overlay.innerHTML = this.generateHTML();
            document.body.appendChild(overlay);
            this.element = overlay;
            this.hide(); // Start hidden
        }

        generateHTML() {
            return `
                <div class="next-frame-stats-section" data-extension-ui="true">
                    <div class="next-frame-stats-label" data-extension-ui="true">
                        <span class="next-frame-stats-title" data-extension-ui="true">Mouse down ↓</span>
                    </div>
                    <div id="next-frame-pointerdown-fps" class="next-frame-fps-value" data-extension-ui="true">
                        <span id="next-frame-pointerdown-time" class="next-frame-fps-time" data-extension-ui="true">-</span>
                        <span id="next-frame-pointerdown-frames" class="next-frame-fps-frames" data-extension-ui="true"></span>
                    </div>
                </div>
                <div class="next-frame-stats-section" data-extension-ui="true">
                    <div class="next-frame-stats-label" data-extension-ui="true">
                        <span class="next-frame-stats-title" data-extension-ui="true">Mouse up ↑</span>
                    </div>
                    <div id="next-frame-pointerup-fps" class="next-frame-fps-value" data-extension-ui="true">
                        <span id="next-frame-pointerup-time" class="next-frame-fps-time" data-extension-ui="true">-</span>
                        <span id="next-frame-pointerup-frames" class="next-frame-fps-frames" data-extension-ui="true">-</span>
                    </div>
                </div>
                ${
                    this.settings.showLastContentPaint // TODO: Remove
                        ? `
                <div class="next-frame-stats-section" data-extension-ui="true">
                    <div class="next-frame-stats-label" data-extension-ui="true">
                        <span class="next-frame-stats-title" data-extension-ui="true">Last Content Paint</span>
                        <span id="next-frame-contentpaint-value" class="next-frame-stats-value" data-extension-ui="true">-</span>
                    </div>
                </div>`
                        : ""
                }
            `;
        }

        setupDrag() {
            if (!this.element) return;

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

        updateStats(eventType, duration) {
            if (!this.element || typeof duration !== "number") return;

            // Stop loading state for the event type
            this.loadingState[eventType] = false;

            // Update our internal stats
            this.stats[eventType] = duration;

            // Direct DOM element update for guaranteed refresh
            const timeEl = document.getElementById(`next-frame-${eventType}-time`);
            const framesEl = document.getElementById(`next-frame-${eventType}-frames`);

            if (timeEl && framesEl) {
                // Update milliseconds
                const roundedDuration = Math.round(duration);
                timeEl.textContent = `${roundedDuration}ms`;

                // Calculate frames at custom fps value
                const customFps = this.settings.fpsComparisonValue;
                const frames = duration / (1000 / this.settings.fpsComparisonValue);
                const framesCustom = frames > 10 ? Math.ceil(frames) : frames.toFixed(1);
                framesEl.textContent = `${framesCustom}F @ ${customFps}FPS`;
            }

            // Force a render to ensure DOM is updated with correct classes
            this.render();
        }

        render() {
            if (!this.element) return;

            // Update HTML if showLastContentPaint setting changed
            if (this.element.innerHTML !== this.generateHTML()) {
                this.element.innerHTML = this.generateHTML();
            }

            // Update each stat type
            ["pointerdown", "pointerup"].forEach((type) => {
                const value = this.stats[type];
                const timeElement = this.element.querySelector(`#next-frame-${type}-time`);
                const framesElement = this.element.querySelector(`#next-frame-${type}-frames`);

                if (timeElement && framesElement) {
                    // Reset classes first
                    timeElement.classList.remove("next-frame-loading", "next-frame-stale");
                    framesElement.classList.remove("next-frame-loading", "next-frame-stale");

                    if (this.loadingState[type]) {
                        // Show loading state with pulsing animation
                        timeElement.textContent = "Waiting...";
                        framesElement.textContent = "";
                        timeElement.classList.add("next-frame-loading");
                        framesElement.classList.add("next-frame-loading");
                    } else {
                        if (value) {
                            // Update milliseconds
                            const roundedValue = Math.round(value);
                            timeElement.textContent = `${roundedValue}ms`;

                            // Calculate frames at custom fps value
                            const customFps = this.settings.fpsComparisonValue;
                            const framesCustom = (value / (1000 / customFps)).toFixed(1);
                            framesElement.textContent = `${framesCustom}F @ ${customFps}FPS`;
                        } else {
                            // Show as stale/empty state
                            timeElement.textContent = "-";
                            framesElement.textContent = "";
                            timeElement.classList.add("next-frame-stale");
                            framesElement.classList.add("next-frame-stale");
                        }
                    }
                }
            });

            // Update content paint info if enabled
            if (this.settings.showLastContentPaint) {
                const contentPaintEl = this.element.querySelector("#next-frame-contentpaint-value");
                if (contentPaintEl) {
                    // This would be updated with real data when content paint is detected
                    contentPaintEl.textContent = "Waiting...";
                }
            }
        }

        setLoadingState(eventType, isLoading) {
            this.loadingState[eventType] = isLoading;
            this.render();
        }

        show() {
            if (this.element) {
                this.element.style.display = "block";
                this.visible = true;
                this.render(); // Re-render when showing
            }
        }

        hide() {
            if (this.element) {
                this.element.style.display = "none";
                this.visible = false;
            }
        }

        toggle() {
            if (this.visible) {
                this.hide();
            } else {
                this.show();
            }
        }

        isVisible() {
            return this.visible;
        }

        // Method to update settings when they change
        updateSettings(newSettings) {
            if (newSettings) {
                if (newSettings.fpsComparisonValue) {
                    this.settings.fpsComparisonValue = newSettings.fpsComparisonValue;
                }
                if (newSettings.showLastContentPaint !== undefined) {
                    this.settings.showLastContentPaint = newSettings.showLastContentPaint;
                }
                this.render();
            }
        }
    }

    // TODO: Remove for now, feature not implemented
    class Storage {
        static getStorageKey() {
            return `interactions_${window.location.origin}`;
        }

        static async saveInteraction(interaction) {
            try {
                const storageKey = this.getStorageKey();

                return new Promise((resolve, reject) => {
                    chrome.storage.local.get([storageKey], (result) => {
                        const existingData = result[storageKey] || [];
                        const updatedData = [...existingData, interaction];

                        chrome.storage.local.set({ [storageKey]: updatedData }, () => {
                            console.log(`Interaction ${interaction.id} saved to storage`);
                            resolve();
                        });
                    });
                });
            } catch (error) {
                console.error("Error saving interaction:", error);
                throw error;
            }
        }
    }

    /**
     * Represents a single interaction event (click, tap, etc.)
     * Groups related pointer events together and handles persistence
     */
    class InteractionEvent {
        constructor(element, page) {
            this.id = Date.now() + "-" + Math.random().toString(36).substr(2, 9); // Unique ID
            this.timestamp = Date.now();
            this.element = this.getElementInfo(element); // Element info
            this.fromPage = { ...page }; // Current page when interaction started
            this.toPage = null; // Will be populated if navigation happens
            this.interactionDelays = {
                pointerdown: null,
                pointerup: null,
            };
            this.complete = false; // Marks when the interaction is fully recorded
            this.saved = false; // Tracks if this interaction has been saved to storage
        }

        getElementInfo(element) {
            if (!element) return null;

            // Create a useful description of the element
            const tagName = element.tagName?.toLowerCase() || "unknown";
            const id = element.id ? `#${element.id}` : "";

            // Handle className safely (can be string or DOMTokenList for SVG elements)
            let classStr = "";
            if (element.className) {
                if (typeof element.className === "string") {
                    classStr = element.className ? `.${element.className.replace(/\s+/g, ".")}` : "";
                } else if (element.className.baseVal !== undefined) {
                    // SVG elements have className.baseVal
                    classStr = element.className.baseVal ? `.${element.className.baseVal.replace(/\s+/g, ".")}` : "";
                } else if (typeof element.className.value === "string") {
                    classStr = element.className.value ? `.${element.className.value.replace(/\s+/g, ".")}` : "";
                } else if (element.classList && element.classList.length) {
                    // Use classList as fallback
                    classStr = `.${Array.from(element.classList).join(".")}`;
                }
            }

            // Safely get text content
            const text = (element.textContent || "").trim().substring(0, 50);

            return {
                selector: `${tagName}${id}${classStr}`,
                text: text,
                role: element.getAttribute("role") || null,
                type: element.getAttribute("type") || null,
            };
        }

        updateDelay(eventType, duration) {
            this.interactionDelays[eventType] = duration;

            // Consider the interaction complete if we have pointerup data
            if (eventType === "pointerup") {
                this.complete = true;
                this.save(); // Auto-save when complete
            }

            return this;
        }

        checkForNavigation(currentPage) {
            // Check if the URL has changed from when this interaction started
            if (this.fromPage.url !== currentPage.url) {
                this.recordNavigation(currentPage);
                return true;
            }
            return false;
        }

        recordNavigation(toPage) {
            this.toPage = { ...toPage };
            this.complete = true; // Consider the interaction complete when navigation occurs
            this.save(); // Auto-save when navigation occurs
            return this;
        }

        async save() {
            if (this.saved) return;

            try {
                await Storage.saveInteraction(this.toJSON());
                this.saved = true;
                console.log(`Interaction ${this.id} saved`);
            } catch (error) {
                console.error(`Failed to save interaction ${this.id}:`, error);
            }
        }

        toJSON() {
            return {
                id: this.id,
                timestamp: this.timestamp,
                element: this.element,
                fromPage: this.fromPage,
                toPage: this.toPage,
                interactionDelays: this.interactionDelays,
                complete: this.complete,
            };
        }
    }

    class DOMPaintTracker {
        constructor() {
            this.active = false;
            this.recording = false;
            this.currentInteraction = null;
            this.observers = {};
            this.timeouts = {};

            // Settings for mutation timeout
            this.settings = {
                enableMutationTimeout: true,
                mutationTimeoutValue: 5000,
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
            const settings = await getExtensionSettings("enableMutationTimeout", "mutationTimeoutValue");

            if (settings) {
                this.settings.enableMutationTimeout = settings.enableMutationTimeout !== false; // Default to true if not set
                this.settings.mutationTimeoutValue = settings.mutationTimeoutValue || 5000;
            }
        }

        getCurrentPageInfo() {
            return {
                url: window.location.href,
                pathname: window.location.pathname,
                title: document.title,
            };
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

        calculateUpdate(eventType) {
            if (!this.active) return;

            // Set loading state to true and update the UI
            this.statisticsOverlayUI.setLoadingState(eventType, true);
            this.resetObservers(eventType); // Clean up any existing observer
            this.clearTimeouts(eventType); // Clear any existing timeout

            // Start timing and create a new mutation observer
            const startTime = performance.now();
            const observer = new MutationObserver((mutations) => {
                if (!this.active) {
                    observer.disconnect();
                    return;
                }
                if (mutations.every((mutation) => this.isExtensionUIMutation(mutation))) return;

                const duration = performance.now() - startTime;

                // This will update stats and remove the loading animation
                this.statisticsOverlayUI.updateStats(eventType, duration);

                if (this.recording && this.currentInteraction) {
                    // Update interaction with the timing information
                    this.currentInteraction.updateDelay(eventType, duration);

                    // Check if navigation occurred
                    const currentPageInfo = this.getCurrentPageInfo();
                    const navigationOccurred = this.currentInteraction.checkForNavigation(currentPageInfo);

                    // If navigation occurred or the interaction is complete, clear the current interaction
                    if (navigationOccurred || this.currentInteraction.complete) {
                        this.currentInteraction = null;
                    }
                }

                // Disconnect this observer once we've captured the timing
                observer.disconnect();
                delete this.observers[eventType];

                // Clear the safety timeout since we got a valid measurement
                this.clearTimeouts(eventType);

                // EDGE CASE: For sites that navigate on pointerdown, all mutations may happen
                // before pointerup. In this case, we need to set a timeout to clean up the
                // pending pointerup observer.
                if (eventType === "pointerdown" && this.active && !this.observers["pointerup"]) {
                    this.timeouts["pointerup"] = setTimeout(() => {
                        console.log("Safety timeout: cleaning up pending pointerup observer");
                        if (this.observers["pointerup"]) {
                            this.resetObservers("pointerup");
                            this.statisticsOverlayUI.setLoadingState("pointerup", false);
                        }
                    }, 2000); // 2 seconds by default (make this a setting later)
                }
            });

            // Store the observer for later cleanup if needed
            this.observers[eventType] = observer;

            // Only set a safety timeout if enabled in settings
            if (this.settings.enableMutationTimeout) {
                const timeoutValue = this.settings.mutationTimeoutValue;

                this.timeouts[eventType] = setTimeout(() => {
                    console.log(`Safety timeout: no mutations detected for ${eventType} after ${timeoutValue}ms`);
                    if (this.observers[eventType]) {
                        this.resetObservers(eventType);

                        // Reset the loading state and clear the stats
                        this.statisticsOverlayUI.setLoadingState(eventType, false);

                        // Clear any partial data for this event type from the stats
                        this.statisticsOverlayUI.stats[eventType] = null;

                        // Force a render to update UI
                        this.statisticsOverlayUI.render();
                    }
                }, timeoutValue);
            }

            // Start observing all DOM changes
            observer.observe(document, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true,
            });
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

            if (this.recording) {
                this.currentInteraction = new InteractionEvent(event.target, this.getCurrentPageInfo());
                console.log(`New interaction started: ${this.currentInteraction.id}`);
            }

            // Set loading state and calculate update
            this.statisticsOverlayUI.setLoadingState("pointerdown", true);
            this.calculateUpdate(event.type);
        }

        handlePointerUp(event) {
            if (!this.active) return;
            if (this.isExtensionUIEvent(event)) return;

            // Clear any existing pointerup timeout
            this.clearTimeouts("pointerup");

            this.pointerIndicatorUI.switchToPointerUp(event.clientX, event.clientY);

            // Set loading state and calculate update
            this.statisticsOverlayUI.setLoadingState("pointerup", true);
            this.calculateUpdate(event.type);
        }

        activate() {
            if (this.active) return;

            this.active = true;
            document.addEventListener("pointerdown", this.handlePointerDown, true);
            document.addEventListener("pointerup", this.handlePointerUp, true);
            this.statisticsOverlayUI.show();
            console.log("Tracker event listeners activated");
        }

        deactivate() {
            if (!this.active) return;

            document.removeEventListener("pointerdown", this.handlePointerDown, true);
            document.removeEventListener("pointerup", this.handlePointerUp, true);
            this.active = false;
            this.stopRecording();
            this.resetObservers();
            this.clearTimeouts();
            this.statisticsOverlayUI.hide();
            this.pointerIndicatorUI.removeCurrentIndicator();
            console.log("Tracker event listeners deactivated");
        }

        startRecording() {
            if (!this.active || this.recording) return false;

            this.recording = true;
            console.log("Started recording interactions");
            return true;
        }

        stopRecording() {
            if (!this.recording) return;

            this.recording = false;

            // Save current interaction if exists
            if (this.currentInteraction) {
                this.currentInteraction.complete = true;
                this.currentInteraction.save();
                this.currentInteraction = null;
            }

            console.log("Stopped recording interactions");
        }

        isRecording() {
            return this.recording;
        }

        // Method to update settings when they change
        updateSettings(newSettings) {
            if (newSettings) {
                if (newSettings.enableMutationTimeout !== undefined) {
                    this.settings.enableMutationTimeout = newSettings.enableMutationTimeout;
                }
                if (newSettings.mutationTimeoutValue) {
                    this.settings.mutationTimeoutValue = newSettings.mutationTimeoutValue;
                }
            }
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
                        isRecording: tracker.isRecording(),
                    });
                    break;
                case "deactivate":
                    tracker.deactivate();
                    sendResponse({
                        success: true,
                        isActive: false,
                        isRecording: false,
                    });
                    break;
                case "startRecording":
                    const started = tracker.startRecording();
                    sendResponse({
                        success: started,
                        isActive: tracker.active,
                        isRecording: tracker.isRecording(),
                    });
                    break;
                case "stopRecording":
                    tracker.stopRecording();
                    sendResponse({
                        success: true,
                        isActive: tracker.active,
                        isRecording: false,
                    });
                    break;
                case "getState":
                    sendResponse({
                        success: true,
                        isActive: tracker.active,
                        isRecording: tracker.isRecording(),
                    });
                    break;
                case "settingsUpdated":
                    if (message.settings) {
                        // Only update statistics overlay settings which are relevant to it
                        if (tracker.statisticsOverlayUI) {
                            const overlaySettings = {
                                fpsComparisonValue: message.settings.fpsComparisonValue,
                                showLastContentPaint: message.settings.showLastContentPaint,
                            };
                            tracker.statisticsOverlayUI.updateSettings(overlaySettings);
                        }

                        // Update paint tracker settings
                        if (
                            message.settings.enableMutationTimeout !== undefined ||
                            message.settings.mutationTimeoutValue
                        ) {
                            const trackerSettings = {
                                enableMutationTimeout: message.settings.enableMutationTimeout,
                                mutationTimeoutValue: message.settings.mutationTimeoutValue,
                            };
                            tracker.updateSettings(trackerSettings);
                        }

                        sendResponse({
                            success: true,
                        });
                    } else {
                        sendResponse({
                            success: false,
                            error: "Invalid settings",
                        });
                    }
                    break;
            }
            return true; // Required to use sendResponse asynchronously
        });
    }
})();
