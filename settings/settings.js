document.addEventListener("DOMContentLoaded", () => {
    // Get all elements
    const fpsComparisonValueInput = document.getElementById("fpsComparisonValue");
    const showLastContentPaintToggle = document.getElementById("showLastContentPaint");
    const timeAfterLastContentPaintInput = document.getElementById("timeAfterLastContentPaint");
    const saveButton = document.getElementById("saveButton");
    const saveStatus = document.getElementById("status");

    // Mutation timeout elements
    const enableMutationTimeoutToggle = document.getElementById("enableMutationTimeout");
    const mutationTimeoutValueInput = document.getElementById("mutationTimeoutValue");

    // Color picker elements
    const pointerDownColorInput = document.getElementById("pointerDownColor");
    const pointerUpColorInput = document.getElementById("pointerUpColor");
    const resetPointerDownColorButton = document.getElementById("resetPointerDownColor");
    const resetPointerUpColorButton = document.getElementById("resetPointerUpColor");

    // Default colors
    const DEFAULT_POINTER_DOWN_COLOR = "#FF0000"; // Red
    const DEFAULT_POINTER_UP_COLOR = "#FFFF00"; // Yellow

    // Load current settings
    chrome.storage.sync.get(
        [
            "fpsComparisonValue",
            "showLastContentPaint",
            "timeAfterLastContentPaint",
            "pointerDownColor",
            "pointerUpColor",
            "enableMutationTimeout",
            "mutationTimeoutValue",
        ],
        (result) => {
            // Set default values if settings don't exist yet
            fpsComparisonValueInput.value = result.fpsComparisonValue || 60;
            showLastContentPaintToggle.checked = result.showLastContentPaint || false;
            timeAfterLastContentPaintInput.value = result.timeAfterLastContentPaint || 5000;

            // Set color pickers to stored values or defaults
            pointerDownColorInput.value = result.pointerDownColor || DEFAULT_POINTER_DOWN_COLOR;
            pointerUpColorInput.value = result.pointerUpColor || DEFAULT_POINTER_UP_COLOR;

            // Set mutation timeout settings (default: enabled with 2500ms timeout)
            enableMutationTimeoutToggle.checked = result.enableMutationTimeout !== false; // Default to true if not set
            mutationTimeoutValueInput.value = result.mutationTimeoutValue || 2500;

            // Update the disabled state of the time input based on toggle
            timeAfterLastContentPaintInput.disabled = !showLastContentPaintToggle.checked;
            mutationTimeoutValueInput.disabled = !enableMutationTimeoutToggle.checked;
        }
    );

    // Add a listener for the showLastContentPaint toggle to enable/disable the time input
    showLastContentPaintToggle.addEventListener("change", () => {
        timeAfterLastContentPaintInput.disabled = !showLastContentPaintToggle.checked;
    });

    // Add a listener for the enableMutationTimeout toggle
    enableMutationTimeoutToggle.addEventListener("change", () => {
        mutationTimeoutValueInput.disabled = !enableMutationTimeoutToggle.checked;
    });

    // Add reset buttons functionality
    resetPointerDownColorButton.addEventListener("click", () => {
        pointerDownColorInput.value = DEFAULT_POINTER_DOWN_COLOR;
    });

    resetPointerUpColorButton.addEventListener("click", () => {
        pointerUpColorInput.value = DEFAULT_POINTER_UP_COLOR;
    });

    // Save settings when button is clicked
    saveButton.addEventListener("click", () => {
        // Get values from form
        const fpsComparisonValue = parseInt(fpsComparisonValueInput.value, 10);
        const showLastContentPaint = showLastContentPaintToggle.checked;
        const timeAfterLastContentPaint = parseInt(timeAfterLastContentPaintInput.value, 10);
        const enableMutationTimeout = enableMutationTimeoutToggle.checked;
        const mutationTimeoutValue = parseInt(mutationTimeoutValueInput.value, 10);

        // Get color values directly from the color pickers
        const pointerDownColor = pointerDownColorInput.value;
        const pointerUpColor = pointerUpColorInput.value;

        // Validate number inputs
        if (isNaN(fpsComparisonValue) || fpsComparisonValue < 1 || fpsComparisonValue > 240) {
            alert("FPS Comparison Value must be between 1 and 240");
            return;
        }

        if (isNaN(timeAfterLastContentPaint) || timeAfterLastContentPaint < 0) {
            alert("Time After Last Content Paint must be a positive number");
            return;
        }

        if (isNaN(mutationTimeoutValue) || mutationTimeoutValue < 100) {
            alert("Mutation Timeout Value must be at least 100ms");
            return;
        }

        // Save to chrome.storage.sync
        chrome.storage.sync.set(
            {
                fpsComparisonValue,
                showLastContentPaint,
                timeAfterLastContentPaint,
                pointerDownColor,
                pointerUpColor,
                enableMutationTimeout,
                mutationTimeoutValue,
            },
            () => {
                // Update the status message to indicate a refresh is needed
                saveStatus.textContent =
                    "Settings saved. Refresh the pages where the extension is active to apply changes.";
                saveStatus.classList.add("visible");

                // Hide message after 5 seconds
                setTimeout(() => {
                    saveStatus.classList.remove("visible");
                }, 5000);
            }
        );
    });
});
