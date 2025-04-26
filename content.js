(function () {
    // Use a global flag to ensure only one instance of the script is active
    if (window._domPaintTrackerActive) {
        console.log("DOMPaintTracker already initialized, not loading again");
        return;
    }
    window._domPaintTrackerActive = true;

    class DOMPaintTracker {
        constructor() {
            this.observers = {}; // {'pointerdown': [], 'pointerup': []}
            this.active = false;
            this.recording = false;
            this.interactions = [];
            this.currentPage = {
                url: window.location.href,
                pathname: window.location.pathname,
            };

            // Store elements that were interacted with
            this.lastInteractedElement = null;

            // Define event handlers with arrow functions to preserve 'this' context
            this.handlePointerDown = (event) => {
                if (!this.active) return;
                this.reset();
                this.captureInteraction("pointerdown", event);
                this.calculateUpdate(event.type);
            };

            this.handlePointerUp = (event) => {
                if (!this.active) return;
                this.captureInteraction("pointerup", event);
                this.calculateUpdate(event.type);
            };

            // Listen for navigation/route changes
            window.addEventListener("popstate", this.handleRouteChange.bind(this));

            // Monitor for hash changes (common in SPA routing)
            window.addEventListener("hashchange", this.handleRouteChange.bind(this));

            // Regular check for URL changes (for pushState/replaceState)
            this.lastUrl = window.location.href;
            this.urlCheckInterval = setInterval(() => {
                const currentUrl = window.location.href;
                if (this.lastUrl !== currentUrl) {
                    this.handleRouteChange();
                    this.lastUrl = currentUrl;
                }
            }, 500);
        }

        handleRouteChange() {
            if (!this.active || !this.recording) return;

            const newPage = {
                url: window.location.href,
                pathname: window.location.pathname,
            };

            // Record the page transition if we have a previous interaction
            if (this.lastInteractedElement) {
                this.recordTransition(this.currentPage, newPage);
            }

            this.currentPage = newPage;
        }

        recordTransition(fromPage, toPage) {
            const transition = {
                timestamp: Date.now(),
                fromPage,
                toPage,
                element: this.getElementInfo(this.lastInteractedElement),
                duration: this.lastTransitionDuration || 0,
            };

            console.log("Page transition recorded:", transition);
            this.interactions.push(transition);

            // Save to storage
            this.saveInteractions();
        }

        getElementInfo(element) {
            if (!element) return null;

            // Create a useful description of the element
            const tagName = element.tagName?.toLowerCase() || "unknown";
            const id = element.id ? `#${element.id}` : "";
            const classes = element.className ? `.${element.className.replace(/\s+/g, ".")}` : "";
            const text = element.textContent?.trim().substring(0, 50) || "";

            return {
                selector: `${tagName}${id}${classes}`,
                text: text,
                role: element.getAttribute("role") || null,
                type: element.getAttribute("type") || null,
            };
        }

        captureInteraction(eventType, event) {
            if (!this.active || !this.recording) return;

            const element = event.target;
            this.lastInteractedElement = element;

            const interaction = {
                timestamp: Date.now(),
                type: eventType,
                page: { ...this.currentPage },
                element: this.getElementInfo(element),
            };

            this.interactions.push(interaction);
            console.log("Interaction recorded:", interaction);

            // Save every few interactions or on important events
            if (this.interactions.length % 5 === 0) {
                this.saveInteractions();
            }
        }

        saveInteractions() {
            if (!this.recording || this.interactions.length === 0) return;

            try {
                // Use the URL origin as a key to group interactions by website
                const storageKey = `interactions_${window.location.origin}`;

                chrome.storage.local.get([storageKey], (result) => {
                    const existingData = result[storageKey] || [];
                    const updatedData = [...existingData, ...this.interactions];

                    chrome.storage.local.set({ [storageKey]: updatedData }, () => {
                        console.log("Interactions saved to storage");
                        // Clear the local array after saving
                        this.interactions = [];
                    });
                });
            } catch (error) {
                console.error("Error saving interactions:", error);
            }
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
            this.reset();
            console.log("Tracker event listeners deactivated");
        }

        startRecording() {
            if (!this.active || this.recording) return;

            this.recording = true;
            this.interactions = [];

            // Reset the current page info
            this.currentPage = {
                url: window.location.href,
                pathname: window.location.pathname,
            };

            console.log("Started recording interactions");
        }

        stopRecording() {
            if (!this.recording) return;

            this.recording = false;

            // Save any remaining interactions
            this.saveInteractions();

            console.log("Stopped recording interactions");
        }

        reset(key) {
            console.log("Resetting observers", key);
            if (key) {
                // Clean a specific event
                if (this.observers[key]) {
                    this.observers[key].disconnect();
                    delete this.observers[key];
                }
            } else {
                // Clean all
                for (const key in this.observers) {
                    if (this.observers[key]) {
                        this.observers[key].disconnect();
                        delete this.observers[key];
                    }
                }
                this.observers = {};
            }
        }

        calculateUpdate(key) {
            if (!this.active) return;
            console.log("Calculating update for event:", key);

            // Disconnect any existing observer for this key
            if (this.observers[key]) {
                this.observers[key].disconnect();
                delete this.observers[key];
            }

            const startTime = performance.now();

            const observer = new MutationObserver((mutations) => {
                if (!this.active) {
                    observer.disconnect();
                    return;
                }

                const endTime = performance.now();
                const duration = endTime - startTime;
                console.log("DOM update duration:", duration, "ms. for event:", key);

                // Save the last transition duration for recording
                this.lastTransitionDuration = duration;

                // If we're recording, store this interaction's duration
                if (this.recording && this.lastInteractedElement) {
                    // Find the most recent interaction for this element
                    for (let i = this.interactions.length - 1; i >= 0; i--) {
                        const interaction = this.interactions[i];
                        if (
                            interaction.element &&
                            interaction.element.selector === this.getElementInfo(this.lastInteractedElement).selector
                        ) {
                            interaction.updateDuration = duration;
                            break;
                        }
                    }
                }

                this.reset(key);
            });

            this.observers[key] = observer;

            observer.observe(document, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true,
            });
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
                sendResponse({ success: true, isActive: true, isRecording: tracker.recording });
                break;

            case "deactivate":
                tracker.deactivate();
                sendResponse({ success: true, isActive: false, isRecording: false });
                break;

            case "startRecording":
                if (tracker.active) {
                    tracker.startRecording();
                }
                sendResponse({ success: true, isActive: tracker.active, isRecording: tracker.recording });
                break;

            case "stopRecording":
                tracker.stopRecording();
                sendResponse({ success: true, isActive: tracker.active, isRecording: false });
                break;

            case "getState":
                sendResponse({
                    success: true,
                    isActive: tracker.active,
                    isRecording: tracker.recording,
                });
                break;
        }
        return true; // Required to use sendResponse asynchronously
    });

    // Clean up when the page unloads
    window.addEventListener("unload", () => {
        if (tracker.recording) {
            tracker.saveInteractions(); // Save any pending interactions
        }
        tracker.deactivate();
        clearInterval(tracker.urlCheckInterval);
        window._domPaintTrackerActive = false;
    });
})();
