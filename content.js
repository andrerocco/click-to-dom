(function () {
    class DOMUpdateMetrics {
        constructor() {
            // this.running = false; // Disables the extension
            this.observers = {}; // {'pointerdown': [], 'pointerup': []}
            this.init();
        }

        init() {
            // TODO: Check if better capturing phase or bubbling phase
            document.addEventListener("pointerdown", this.handlePointerDown.bind(this), true);
            document.addEventListener("pointerup", this.handlePointerUp.bind(this), true);
        }

        reset(key) {
            console.log("Resetting observers", key);
            if (key) {
                // Clean a specific event
                // ...
            } else {
                // Clean all
                for (const key in this.observers) {
                    const observer = this.observers[key];
                    observer.disconnect();
                    delete this.observers[key];
                }
            }
        }

        handlePointerDown(event) {
            this.reset();
            this.calculateUpdate(event.type);
        }

        handlePointerUp(event) {
            this.calculateUpdate(event.type);
        }

        calculateUpdate(key) {
            console.log("Calculating update for event:", key);

            const startTime = performance.now();

            const observer = new MutationObserver((mutations) => {
                const endTime = performance.now();
                const duration = endTime - startTime;
                console.log("DOM update duration:", duration, "ms. for event:", key);
            });

            this.observers[key] = observer;

            observer.observe(document, {
                childList: true,
                subtree: true,
                // TODO: What else to observe?
                attributes: true,
                characterData: true,
            });
        }
    }

    let metrics = null;
    let isActive = false;

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "activate") {
            if (!metrics) {
                metrics = new DOMUpdateMetrics();
                isActive = true;
            }
            sendResponse({ success: true });
        } else if (message.action === "deactivate") {
            if (metrics && metrics.reset) {
                metrics.reset();
            }
            metrics = null;
            isActive = false;
            sendResponse({ success: true });
        } else if (message.action === "getState") {
            sendResponse({ isActive: isActive });
        }
        return true; // Required to use sendResponse asynchronously
    });
})();
