(function () {
    // Global flag to ensure only one instance of the script runs
    if (window._domPaintTrackerActive) return;
    window._domPaintTrackerActive = true;

    class DOMPaintTracker {
        constructor() {
            // State
            this.active = false;
            this.observers = {}; // {'pointerdown': [], 'pointerup': []}

            // Event listeners (used for cleanup)
            this.boundHandlePointerDown = this.handlePointerDown.bind(this);
            this.boundHandlePointerUp = this.handlePointerUp.bind(this);
        }

        activate() {
            if (this.active) return;
            this.active = true;

            document.addEventListener("pointerdown", this.boundHandlePointerDown, true);
            document.addEventListener("pointerup", this.boundHandlePointerUp, true);

            console.log("Tracker event listeners activated");
        }

        deactivate() {
            if (!this.active) return;

            document.removeEventListener("pointerdown", this.boundHandlePointerDown, true);
            document.removeEventListener("pointerup", this.boundHandlePointerUp, true);

            this.active = false;
            this.reset();

            console.log("Tracker event listeners deactivated");
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

        handlePointerDown(event) {
            if (!this.active) return;
            this.reset();
            this.calculateUpdate(event.type);
        }

        handlePointerUp(event) {
            if (!this.active) return;
            this.calculateUpdate(event.type);
        }

        calculateUpdate(key) {
            console.log("Calculating update for event:", key);

            this.reset(key);
            // // Disconnect any existing observer for this key
            // if (this.observers[key]) {
            //     this.observers[key].disconnect();
            //     delete this.observers[key];
            // }

            const startTime = performance.now();

            const observer = new MutationObserver((mutations) => {
                if (!this.active) {
                    observer.disconnect();
                    return;
                }

                const endTime = performance.now();
                const duration = endTime - startTime;
                console.log("DOM update duration:", duration, "ms. for event:", key);

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

    // Handle messaging with background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("Message received:", message.action);

        switch (message.action) {
            case "activate":
                tracker.deactivate(); // First ensure it's clean
                tracker.activate();
                sendResponse({ success: true, isActive: true });
                break;

            case "deactivate":
                tracker.deactivate();
                sendResponse({ success: true, isActive: false });
                break;

            case "getState":
                sendResponse({ isActive: tracker.active });
                break;
        }
        return true; // Required to use sendResponse asynchronously
    });
})();
