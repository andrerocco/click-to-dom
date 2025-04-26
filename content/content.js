// Content script for measuring frame latency
(function () {
  // Check if the script is already running
  if (window.nextFrameExtensionActive) {
    console.log("Next Frame Extension is already running");
    return;
  }

  // Mark extension as active
  window.nextFrameExtensionActive = true;
  console.log("Next Frame Extension activated");

  // Variables to store timing information
  let mousedownTime = null;
  let mouseupTime = null;
  let firstDOMChangeAfterMousedown = null;
  let firstDOMChangeAfterMouseup = null;
  let isWaitingForMousedownChange = false;
  let isWaitingForMouseupChange = false;
  let ignoreMutations = false;

  // Create container for overlay information
  const overlay = document.createElement("div");
  overlay.setAttribute("data-extension-element", "true");
  overlay.style.cssText = `
    position: fixed;
    z-index: 9999;
    padding: 10px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    border-radius: 5px;
    font-family: monospace;
    font-size: 12px;
    pointer-events: none;
    transition: opacity 0.3s;
    opacity: 0;
  `;
  document.body.appendChild(overlay);

  // Create event indicator
  const eventIndicator = document.createElement("div");
  eventIndicator.setAttribute("data-extension-element", "true");
  eventIndicator.style.cssText = `
    position: fixed;
    z-index: 9999;
    padding: 5px;
    background-color: rgba(255, 0, 0, 0.7);
    color: white;
    border-radius: 3px;
    font-family: monospace;
    font-size: 10px;
    pointer-events: none;
    opacity: 0;
  `;
  document.body.appendChild(eventIndicator);

  // Create MutationObserver to detect DOM changes
  const observer = new MutationObserver((mutations) => {
    // Skip if we're currently ignoring mutations
    if (ignoreMutations) return;

    // Check if this mutation is caused by our extension
    const isExtensionMutation = mutations.some((mutation) => {
      // Check if the target is one of our elements
      if (
        mutation.target.hasAttribute &&
        mutation.target.hasAttribute("data-extension-element")
      ) {
        return true;
      }

      // Check added nodes
      if (mutation.addedNodes && mutation.addedNodes.length) {
        for (let node of mutation.addedNodes) {
          if (
            node.hasAttribute &&
            node.hasAttribute("data-extension-element")
          ) {
            return true;
          }
        }
      }

      // Check for our overlay/indicator content changes
      if (
        mutation.target === overlay ||
        mutation.target === eventIndicator ||
        (mutation.target.parentNode &&
          (mutation.target.parentNode === overlay ||
            mutation.target.parentNode === eventIndicator))
      ) {
        return true;
      }

      return false;
    });

    // Skip this mutation if it's caused by our extension
    if (isExtensionMutation) return;

    const now = performance.now();

    if (isWaitingForMousedownChange && !firstDOMChangeAfterMousedown) {
      firstDOMChangeAfterMousedown = now;
      updateOverlay();
    }

    if (isWaitingForMouseupChange && !firstDOMChangeAfterMouseup) {
      firstDOMChangeAfterMouseup = now;
      updateOverlay();
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    attributes: true,
    characterData: true,
    subtree: true,
    attributeOldValue: false,
    characterDataOldValue: false,
  });

  // Handle mousedown event
  document.addEventListener(
    "mousedown",
    (event) => {
      // Reset mousedown timing
      mousedownTime = performance.now();
      firstDOMChangeAfterMousedown = null;
      isWaitingForMousedownChange = true;

      // Temporarily ignore mutations caused by our own UI
      ignoreMutations = true;

      // Show event indicator
      showEventIndicator("mousedown", event.clientX, event.clientY);

      // Position the overlay near the cursor
      positionOverlay(event.clientX, event.clientY);

      // Resume observing mutations after our UI updates
      setTimeout(() => {
        ignoreMutations = false;
      }, 0);
    },
    true
  );

  // Handle mouseup event
  document.addEventListener(
    "mouseup",
    (event) => {
      // Reset mouseup timing
      mouseupTime = performance.now();
      firstDOMChangeAfterMouseup = null;
      isWaitingForMouseupChange = true;

      // Temporarily ignore mutations caused by our own UI
      ignoreMutations = true;

      // Show event indicator
      showEventIndicator("mouseup", event.clientX, event.clientY);

      // Position the overlay near the cursor
      positionOverlay(event.clientX, event.clientY);

      // Resume observing mutations after our UI updates
      setTimeout(() => {
        ignoreMutations = false;
      }, 0);
    },
    true
  );

  // Function to show event indicator
  function showEventIndicator(eventType, x, y) {
    eventIndicator.textContent = eventType;
    eventIndicator.style.left = `${x + 15}px`;
    eventIndicator.style.top = `${y - 15}px`;
    eventIndicator.style.opacity = "1";

    // Hide indicator after a short time
    setTimeout(() => {
      eventIndicator.style.opacity = "0";
    }, 300);
  }

  // Function to position the overlay
  function positionOverlay(x, y) {
    overlay.style.left = `${x + 30}px`;
    overlay.style.top = `${y - 20}px`;
  }

  // Function to update the overlay with timing information
  function updateOverlay() {
    // Temporarily ignore mutations while updating our UI
    ignoreMutations = true;

    // Calculate frame times
    let mousedownMs = firstDOMChangeAfterMousedown
      ? (firstDOMChangeAfterMousedown - mousedownTime).toFixed(2)
      : "---";
    let mouseupMs = firstDOMChangeAfterMouseup
      ? (firstDOMChangeAfterMouseup - mouseupTime).toFixed(2)
      : "---";

    // Calculate frames at 60fps (16.67ms per frame) and 120fps (8.33ms per frame)
    let mousedownFrames60 = firstDOMChangeAfterMousedown
      ? Math.ceil((firstDOMChangeAfterMousedown - mousedownTime) / 16.67)
      : "---";
    let mousedownFrames120 = firstDOMChangeAfterMousedown
      ? Math.ceil((firstDOMChangeAfterMousedown - mousedownTime) / 8.33)
      : "---";
    let mouseupFrames60 = firstDOMChangeAfterMouseup
      ? Math.ceil((firstDOMChangeAfterMouseup - mouseupTime) / 16.67)
      : "---";
    let mouseupFrames120 = firstDOMChangeAfterMouseup
      ? Math.ceil((firstDOMChangeAfterMouseup - mouseupTime) / 8.33)
      : "---";

    // Update overlay content
    overlay.innerHTML = `
      <div><strong>Mousedown → DOM change:</strong></div>
      <div>Time: ${mousedownMs} ms</div>
      <div>Frames@60fps: ${mousedownFrames60}</div>
      <div>Frames@120fps: ${mousedownFrames120}</div>
      <div><strong>Mouseup → DOM change:</strong></div>
      <div>Time: ${mouseupMs} ms</div>
      <div>Frames@60fps: ${mouseupFrames60}</div>
      <div>Frames@120fps: ${mouseupFrames120}</div>
    `;

    // Show overlay
    overlay.style.opacity = "1";

    // Hide overlay after 3 seconds of inactivity
    setTimeout(() => {
      overlay.style.opacity = "0";
    }, 3000);

    // Resume observing mutations after our UI updates
    setTimeout(() => {
      ignoreMutations = false;
    }, 0);
  }

  // Create a button to disable the extension
  const disableButton = document.createElement("button");
  disableButton.setAttribute("data-extension-element", "true");
  disableButton.textContent = "Disable Frame Measurement";
  disableButton.style.cssText = `
    position: fixed;
    z-index: 10000;
    top: 10px;
    right: 10px;
    padding: 5px 10px;
    background-color: #f44336;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
  `;
  disableButton.addEventListener("click", cleanup);
  document.body.appendChild(disableButton);

  // Add cleanup function for when extension is unloaded
  function cleanup() {
    observer.disconnect();
    document.body.removeChild(overlay);
    document.body.removeChild(eventIndicator);
    document.body.removeChild(disableButton);
    window.nextFrameExtensionActive = false;
  }
})();
