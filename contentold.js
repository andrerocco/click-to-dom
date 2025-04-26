// Next Frame Extension - Content Script
(function () {
  const PRIMARY_COLOR = "#32CD32"; // Green color for visual elements

  class FrameMeasurement {
    constructor() {
      this.isActive = false;
      this.timingDisplay = null;
      this.cursorIndicator = null;
      this.domObserver = null;
      this.pointerDownTime = null;
      this.pointerUpTime = null;
      this.activeObservers = new Map();
      this.activeTimeouts = new Map();
      this.setupMessageListener();
    }

    setupMessageListener() {
      chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
        if (message.action === "getState") {
          sendResponse({ isActive: this.isActive });
          return true;
        } else if (message.action === "activate") {
          this.activate();
          sendResponse({ success: true });
          return true;
        } else if (message.action === "deactivate") {
          this.deactivate();
          sendResponse({ success: true });
          return true;
        }
      });
    }

    activate() {
      if (this.isActive) return;
      this.isActive = true;

      // Initialize UI components if they don't exist
      this.timingDisplay = this.timingDisplay || new TimingDisplay();
      this.cursorIndicator = this.cursorIndicator || new CursorIndicator();

      // Show the timing display
      this.timingDisplay.show();

      // Add event listeners
      document.addEventListener(
        "pointerdown",
        this.handlePointerDown.bind(this)
      );
      document.addEventListener("pointerup", this.handlePointerUp.bind(this));

      console.log("Frame Measurement Extension activated");
    }

    deactivate() {
      if (!this.isActive) return;
      this.isActive = false;

      // Remove event listeners
      document.removeEventListener(
        "pointerdown",
        this.handlePointerDown.bind(this)
      );
      document.removeEventListener(
        "pointerup",
        this.handlePointerUp.bind(this)
      );

      // Clean up observers and timeouts
      this.cleanupAllObservers();

      // Remove UI components
      if (this.timingDisplay) {
        this.timingDisplay.remove();
        this.timingDisplay = null;
      }

      if (this.cursorIndicator) {
        this.cursorIndicator.remove();
        this.cursorIndicator = null;
      }

      console.log("Frame Measurement Extension deactivated");
    }

    handlePointerDown(event) {
      // Ignore if not left click or if clicking on our UI elements
      if (
        event.button !== 0 ||
        (this.timingDisplay &&
          this.timingDisplay.element.contains(event.target))
      ) {
        return;
      }

      // Clean up any existing measurements
      this.cleanupObserver("pointerdown");

      // Show indicator at cursor position
      this.cursorIndicator.show(event.clientX, event.clientY, "pointerdown");

      // Start measuring
      this.startMeasurement("pointerdown");
    }

    handlePointerUp(event) {
      // Show indicator at cursor position
      this.cursorIndicator.show(event.clientX, event.clientY, "pointerup");

      // Clean up existing measurement for pointerup
      this.cleanupObserver("pointerup");

      // Start a new measurement for pointerup
      this.startMeasurement("pointerup");
    }

    startMeasurement(eventType) {
      // Update the display to show loading state
      this.timingDisplay.setLoading(eventType);

      const startTime = performance.now();

      // Create a new observer
      const observer = new MutationObserver((mutations) => {
        // Ignore mutations in our UI elements
        if (
          mutations.some(
            (m) =>
              (this.timingDisplay &&
                this.timingDisplay.element.contains(m.target)) ||
              (this.cursorIndicator &&
                this.cursorIndicator.element.contains(m.target))
          )
        ) {
          return;
        }

        // Calculate timing
        const endTime = performance.now();
        const elapsedMs = endTime - startTime;

        // Calculate frames at different refresh rates
        const frames = this.calculateFrames(elapsedMs);

        // Update the display
        this.timingDisplay.updateTiming(eventType, elapsedMs, frames);

        // Stop observing after we've detected a change
        this.cleanupObserver(eventType);
      });

      // Start observing
      observer.observe(document, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });

      // Store the observer
      this.activeObservers.set(eventType, observer);

      // Set a timeout to stop measuring if no change is detected
      const timeout = setTimeout(() => {
        this.cleanupObserver(eventType);
        this.timingDisplay.showNoChangeMessage(eventType);
      }, 2000);

      this.activeTimeouts.set(eventType, timeout);
    }

    calculateFrames(ms) {
      return {
        fps60: (ms / 16.6667).toFixed(2),
        fps120: (ms / 8.3333).toFixed(2),
      };
    }

    cleanupObserver(eventType) {
      // Disconnect observer if exists
      if (this.activeObservers.has(eventType)) {
        this.activeObservers.get(eventType).disconnect();
        this.activeObservers.delete(eventType);
      }

      // Clear timeout if exists
      if (this.activeTimeouts.has(eventType)) {
        clearTimeout(this.activeTimeouts.get(eventType));
        this.activeTimeouts.delete(eventType);
      }
    }

    cleanupAllObservers() {
      for (const [eventType, _] of this.activeObservers) {
        this.cleanupObserver(eventType);
      }
    }
  }

  class TimingDisplay {
    constructor() {
      this.element = this.createDisplayElement();
      this.sections = {
        pointerdown: this.createSection("pointerdown"),
        pointerup: this.createSection("pointerup"),
      };
      this.initDisplay();
    }

    createDisplayElement() {
      const display = document.createElement("div");
      display.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: ${PRIMARY_COLOR};
        padding: 12px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 9999999;
        min-width: 220px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        cursor: move;
        user-select: none;
        display: none;
      `;
      display.setAttribute("data-frame-measurement", "timing-display");
      return display;
    }

    createSection(eventType) {
      const section = document.createElement("div");
      section.style.marginBottom = "8px";

      const header = document.createElement("div");
      header.textContent = eventType;
      header.style.cssText = `
        color: white;
        font-weight: bold;
        margin-bottom: 4px;
      `;

      const msValue = document.createElement("div");
      msValue.textContent = "Waiting for input...";

      const fps60Value = document.createElement("div");
      const fps120Value = document.createElement("div");

      section.appendChild(header);
      section.appendChild(msValue);
      section.appendChild(fps60Value);
      section.appendChild(fps120Value);

      return {
        element: section,
        header,
        msValue,
        fps60Value,
        fps120Value,
      };
    }

    initDisplay() {
      // Add pulsing animation style
      const style = document.createElement("style");
      style.textContent = `
        @keyframes frame-measurement-pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        .frame-measurement-pulse {
          animation: frame-measurement-pulse 1s infinite;
        }
      `;
      document.head.appendChild(style);

      // Add sections to display
      this.element.appendChild(this.sections.pointerdown.element);

      const divider = document.createElement("hr");
      divider.style.cssText = `
        border: none;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        margin: 8px 0;
      `;
      this.element.appendChild(divider);

      this.element.appendChild(this.sections.pointerup.element);

      document.body.appendChild(this.element);
      this.makeDraggable();
    }

    makeDraggable() {
      let isDragging = false;
      let offsetX = 0;
      let offsetY = 0;

      this.element.addEventListener("mousedown", (e) => {
        isDragging = true;
        offsetX = e.clientX - this.element.getBoundingClientRect().left;
        offsetY = e.clientY - this.element.getBoundingClientRect().top;
      });

      document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        const x = e.clientX - offsetX;
        const y = e.clientY - offsetY;

        this.element.style.left = `${x}px`;
        this.element.style.right = "auto";
        this.element.style.top = `${y}px`;
        this.element.style.bottom = "auto";
      });

      document.addEventListener("mouseup", () => {
        isDragging = false;
      });
    }

    show() {
      this.element.style.display = "block";
    }

    remove() {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
    }

    setLoading(eventType) {
      const section = this.sections[eventType];
      if (!section) return;

      section.header.classList.add("frame-measurement-pulse");
      section.msValue.textContent = "Measuring...";
      section.fps60Value.textContent = "";
      section.fps120Value.textContent = "";
    }

    updateTiming(eventType, ms, frames) {
      const section = this.sections[eventType];
      if (!section) return;

      section.header.classList.remove("frame-measurement-pulse");
      section.msValue.textContent = `${ms.toFixed(2)}ms`;
      section.fps60Value.textContent = `${frames.fps60} frames @60fps`;
      section.fps120Value.textContent = `${frames.fps120} frames @120fps`;
    }

    showNoChangeMessage(eventType) {
      const section = this.sections[eventType];
      if (!section) return;

      section.header.classList.remove("frame-measurement-pulse");
      section.msValue.textContent = "No DOM changes detected";
      section.fps60Value.textContent = "";
      section.fps120Value.textContent = "";
    }
  }

  class CursorIndicator {
    constructor() {
      this.element = this.createIndicatorElement();
      this.textElement = document.createElement("div");
      this.element.appendChild(this.textElement);
      document.body.appendChild(this.element);
    }

    createIndicatorElement() {
      const indicator = document.createElement("div");
      indicator.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 9999998;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s;
        white-space: nowrap;
      `;
      return indicator;
    }

    show(x, y, eventType) {
      // Position the indicator
      this.element.style.left = `${x}px`;
      this.element.style.top = `${y}px`;

      // Update text and style
      this.textElement.textContent = eventType;
      this.textElement.style.cssText = `
        background-color: ${
          eventType === "pointerdown" ? "white" : PRIMARY_COLOR
        };
        color: ${eventType === "pointerdown" ? "black" : "white"};
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        font-family: Arial, sans-serif;
        transform: translate(10px, 0);
      `;

      // Show the indicator
      this.element.style.opacity = "1";

      // Hide after a short time
      setTimeout(() => {
        this.element.style.opacity = "0";
      }, 1000);
    }

    remove() {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
    }
  }

  // Initialize the extension
  let frameMeasurement = null;

  // Only create the instance when activated by the extension
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!frameMeasurement) {
      frameMeasurement = new FrameMeasurement();
    }

    // Let the instance handle the message
    return true;
  });
})();
