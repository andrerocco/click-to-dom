(function () {
    // Use a global flag to ensure only one instance of the script is active
    if (window._domPaintTrackerActive) {
        console.log("DOMPaintTracker already initialized, not loading again");
        return;
    }
    window._domPaintTrackerActive = true;

    /**
     * Element and DOM Utils - Handles DOM element selection and information extraction
     */
    class ElementUtils {
        static getElementInfo(element) {
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
    }

    /**
     * Storage manager for interaction events
     */
    class StorageManager {
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
            this.element = ElementUtils.getElementInfo(element);
            this.fromPage = { ...page }; // Current page when interaction started
            this.toPage = null; // Will be populated if navigation happens
            this.interactionDelays = {
                pointerdown: null,
                pointerup: null,
            };
            this.complete = false; // Marks when the interaction is fully recorded
            this.saved = false; // Tracks if this interaction has been saved to storage
        }

        /**
         * Update the interaction with timing information for a specific event type
         */
        updateDelay(eventType, duration) {
            this.interactionDelays[eventType] = duration;

            // Consider the interaction complete if we have pointerup data
            if (eventType === "pointerup") {
                this.complete = true;
                this.save(); // Auto-save when complete
            }

            return this;
        }

        /**
         * Check if navigation occurred and record it
         */
        checkForNavigation(currentPage) {
            // Check if the URL has changed from when this interaction started
            if (this.fromPage.url !== currentPage.url) {
                this.recordNavigation(currentPage);
                return true;
            }
            return false;
        }

        /**
         * Record a navigation that resulted from this interaction
         */
        recordNavigation(toPage) {
            this.toPage = { ...toPage };
            this.complete = true; // Consider the interaction complete when navigation occurs
            this.save(); // Auto-save when navigation occurs
            return this;
        }

        /**
         * Save this interaction to storage
         */
        async save() {
            if (this.saved) return;

            try {
                await StorageManager.saveInteraction(this.toJSON());
                this.saved = true;
                console.log(`Interaction ${this.id} saved`);
            } catch (error) {
                console.error(`Failed to save interaction ${this.id}:`, error);
            }
        }

        /**
         * Convert to a plain object for storage
         */
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

    /**
     * Main DOMPaintTracker class - Coordinates the other components
     */
    class DOMPaintTracker {
        constructor() {
            this.active = false;
            this.recording = false;
            this.currentInteraction = null;
            this.observers = {};

            // Bind the event handlers to preserve context
            this.handlePointerDown = this.handlePointerDown.bind(this);
            this.handlePointerUp = this.handlePointerUp.bind(this);
        }

        getCurrentPageInfo() {
            return {
                url: window.location.href,
                pathname: window.location.pathname,
                title: document.title,
            };
        }

        resetObservers(key) {
            // console.log("Resetting observers", key);
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

        observeDOMChanges(key, onUpdate) {
            this.resetObservers(key);

            const startTime = performance.now();
            const observer = new MutationObserver((mutations) => {
                if (!this.active) {
                    observer.disconnect();
                    return;
                }

                const duration = performance.now() - startTime;
                console.log("DOM update duration:", duration, "ms. for event:", key);

                // Call the update callback with the duration
                onUpdate(duration, key);
                this.resetObservers(key);
            });

            this.observers[key] = observer;
            observer.observe(document, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true,
            });
        }

        calculateUpdate(eventType) {
            if (!this.active) return;
            console.log("Calculating update for event:", eventType);

            this.observeDOMChanges(eventType, (duration, eventType) => {
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
            });
        }

        handlePointerDown(event) {
            if (!this.active) return;

            this.resetObservers();

            if (this.recording) {
                this.currentInteraction = new InteractionEvent(event.target, this.getCurrentPageInfo());
                console.log(`New interaction started: ${this.currentInteraction.id}`);
            }

            this.calculateUpdate(event.type);
        }

        handlePointerUp(event) {
            if (!this.active) return;
            this.calculateUpdate(event.type);
        }

        activate() {
            if (this.active) return;

            this.active = true;
            document.addEventListener("pointerdown", this.handlePointerDown, true);
            document.addEventListener("pointerup", this.handlePointerUp, true);
            console.log("Tracker event listeners activated");
        }

        deactivate() {
            if (!this.active) return;

            document.removeEventListener("pointerdown", this.handlePointerDown, true);
            document.removeEventListener("pointerup", this.handlePointerUp, true);
            this.active = false;
            this.stopRecording();
            this.resetObservers();
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
    }

    // Create a single persistent instance
    const tracker = new DOMPaintTracker();

    // Handle messaging with background script and popup
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
        }
        return true; // Required to use sendResponse asynchronously
    });
})();
