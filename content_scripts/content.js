(function () {
    class PointerIndicatorUI {
        constructor() {
            this.currentIndicator = null;
        }

        showPointerDown(x, y) {
            // Remove any existing indicator first
            this.removeCurrentIndicator();

            // Create new pointer down indicator (red)
            const element = document.createElement("div");
            element.className = "next-frame-pointer-indicator next-frame-pointer-down";
            element.setAttribute("data-extension-ui", "true");
            element.style.left = `${x}px`;
            element.style.top = `${y}px`;
            document.body.appendChild(element);

            this.currentIndicator = element;
        }

        switchToPointerUp(x, y) {
            // Remove existing indicator
            this.removeCurrentIndicator();

            // Create new pointer up indicator (yellow with animation)
            const element = document.createElement("div");
            element.className = "next-frame-pointer-indicator next-frame-pointer-up";
            element.setAttribute("data-extension-ui", "true");
            element.style.left = `${x}px`;
            element.style.top = `${y}px`;
            document.body.appendChild(element);

            this.currentIndicator = element;

            // Auto-remove after animation completes
            setTimeout(() => this.removeCurrentIndicator(), 500);
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

            this.stats = {
                pointerdown: null,
                pointerup: null,
            };

            this.init();
            this.setupDrag();
            this.render(); // Initial render
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
                <div class="next-frame-stats-header" data-extension-ui="true">
                    <span class="next-frame-stats-title" data-extension-ui="true">Next Frame Stats</span>
                </div>
                <div class="next-frame-stats-section" data-extension-ui="true">
                    <div class="next-frame-stats-label" data-extension-ui="true">
                        <span data-extension-ui="true">Pointer down</span>
                        <span id="next-frame-pointerdown-value" class="next-frame-stats-value" data-extension-ui="true">-</span>
                    </div>
                    <div id="next-frame-pointerdown-fps" class="next-frame-fps-value" data-extension-ui="true"></div>
                </div>
                <div class="next-frame-stats-section" data-extension-ui="true">
                    <div class="next-frame-stats-label" data-extension-ui="true">
                        <span data-extension-ui="true">Pointer up</span>
                        <span id="next-frame-pointerup-value" class="next-frame-stats-value" data-extension-ui="true">-</span>
                    </div>
                    <div id="next-frame-pointerup-fps" class="next-frame-fps-value" data-extension-ui="true"></div>
                </div>
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

            // Update our internal stats
            this.stats[eventType] = duration;

            // Direct DOM element update for guaranteed refresh
            const valueEl = document.getElementById(`next-frame-${eventType}-value`);
            const fpsEl = document.getElementById(`next-frame-${eventType}-fps`);

            if (valueEl && fpsEl) {
                // Update milliseconds
                valueEl.textContent = `${Math.round(duration)}ms`;

                // Calculate frames at different refresh rates
                const frames60fps = Math.ceil(duration / (1000 / 60));
                const frames120fps = Math.ceil(duration / (1000 / 120));

                fpsEl.innerHTML = `
                    ${frames60fps}f @ 60fps<br>
                    ${frames120fps}f @ 120fps
                `;
            }
        }

        render() {
            if (!this.element) return;

            // Update each stat type
            ["pointerdown", "pointerup"].forEach((type) => {
                const value = this.stats[type];
                const valueElement = this.element.querySelector(`#next-frame-${type}-value`);
                const fpsElement = this.element.querySelector(`#next-frame-${type}-fps`);

                if (valueElement && fpsElement) {
                    // Update milliseconds
                    valueElement.textContent = value ? `${Math.round(value)}ms` : "-";

                    if (value) {
                        // Calculate frames at different refresh rates
                        const frames60fps = Math.ceil(value / (1000 / 60));
                        const frames120fps = Math.ceil(value / (1000 / 120));

                        fpsElement.innerHTML = `
                            ${frames60fps}f @ 60fps<br>
                            ${frames120fps}f @ 120fps
                        `;
                    } else {
                        fpsElement.innerHTML = "";
                    }
                }
            });
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
    }

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

        /**
         * Save this interaction to storage
         */
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

            // Bind the event handlers to preserve context
            this.handlePointerDown = this.handlePointerDown.bind(this);
            this.handlePointerUp = this.handlePointerUp.bind(this);

            // UI elements
            this.pointerIndicatorUI = new PointerIndicatorUI();
            this.statisticsOverlayUI = new StatisticsOverlayUI();
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
            console.log("Calculating update for event:", eventType);

            // Clean up any existing observer for this event type
            this.resetObservers(eventType);

            // Start timing and create a new mutation observer
            const startTime = performance.now();
            const observer = new MutationObserver((mutations) => {
                // TODO: Stop if mutation comes from extension UI
                if (!this.active) {
                    observer.disconnect();
                    return;
                }
                if (mutations.some((mutation) => this.isExtensionUIMutation(mutation))) {
                    console.log(">>> Mutation " + mutations[0].nextSibling + " is within extension UI, ignoring");
                    observer.disconnect();
                    return;
                }

                const duration = performance.now() - startTime;
                console.log(`DOM update for ${eventType}: ${duration}ms`);

                // Update the statistics overlay with the timing info
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
            });

            // Store the observer for later cleanup if needed
            this.observers[eventType] = observer;

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
            this.pointerIndicatorUI.showPointerDown(event.clientX, event.clientY);

            if (this.recording) {
                this.currentInteraction = new InteractionEvent(event.target, this.getCurrentPageInfo());
                console.log(`New interaction started: ${this.currentInteraction.id}`);
            }

            this.calculateUpdate(event.type);
        }

        handlePointerUp(event) {
            if (!this.active) return;
            if (this.isExtensionUIEvent(event)) return;

            this.pointerIndicatorUI.switchToPointerUp(event.clientX, event.clientY);
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
            this.statisticsOverlayUI.hide();
            this.pointerIndicatorUI.removeCurrentIndicator(); // Updated call
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

    if (window._domPaintTrackerActive) {
        console.log("DOMPaintTracker already initialized, not loading again");
    } else {
        window._domPaintTrackerActive = true; // Global flag to prevent multiple instances

        const tracker = new DOMPaintTracker();

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
    }
})();
