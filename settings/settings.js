document.addEventListener("DOMContentLoaded", () => {
    // Get all elements
    const fpsComparisonValueInput = document.getElementById("fpsComparisonValue");
    const showLastContentPaintToggle = document.getElementById("showLastContentPaint");
    const timeAfterLastContentPaintInput = document.getElementById("timeAfterLastContentPaint");

    // Replace the single save button with two separate buttons
    const saveBehaviorButton = document.getElementById("saveBehaviorButton");
    const saveAppearanceButton = document.getElementById("saveAppearanceButton");
    const behaviorStatus = document.getElementById("behaviorStatus");
    const appearanceStatus = document.getElementById("appearanceStatus");

    // Mutation timeout elements
    const enableMutationTimeoutToggle = document.getElementById("enableMutationTimeout");
    const mutationTimeoutValueInput = document.getElementById("mutationTimeoutValue");

    // Color picker elements
    const pointerDownColorInput = document.getElementById("pointerDownColor");
    const pointerUpColorInput = document.getElementById("pointerUpColor");
    const resetPointerDownColorButton = document.getElementById("resetPointerDownColor");
    const resetPointerUpColorButton = document.getElementById("resetPointerUpColor");

    // Label customization elements
    const emptyStateLabelInput = document.getElementById("emptyStateLabel");
    const loadingStateLabelInput = document.getElementById("loadingStateLabel");
    const timeoutStateLabelInput = document.getElementById("timeoutStateLabel");
    const resetEmptyStateLabelButton = document.getElementById("resetEmptyStateLabel");
    const resetLoadingStateLabelButton = document.getElementById("resetLoadingStateLabel");
    const resetTimeoutStateLabelButton = document.getElementById("resetTimeoutStateLabel");

    // Default values
    const DEFAULT_POINTER_DOWN_COLOR = "#0066FF"; // Bright blue
    const DEFAULT_POINTER_UP_COLOR = "#FFFF00"; // Yellow
    const DEFAULT_EMPTY_STATE_LABEL = "-";
    const DEFAULT_LOADING_STATE_LABEL = "Waiting...";
    const DEFAULT_TIMEOUT_STATE_LABEL = "Timed out";

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
            "emptyStateLabel",
            "loadingStateLabel",
            "timeoutStateLabel",
        ],
        (result) => {
            // Set default values if settings don't exist yet
            fpsComparisonValueInput.value = result.fpsComparisonValue || 60;
            showLastContentPaintToggle.checked = result.showLastContentPaint || false;
            timeAfterLastContentPaintInput.value = result.timeAfterLastContentPaint || 5000;

            // Set color pickers to stored values or defaults
            pointerDownColorInput.value = result.pointerDownColor || DEFAULT_POINTER_DOWN_COLOR;
            pointerUpColorInput.value = result.pointerUpColor || DEFAULT_POINTER_UP_COLOR;

            // Set label inputs to stored values or defaults
            emptyStateLabelInput.value = result.emptyStateLabel || DEFAULT_EMPTY_STATE_LABEL;
            loadingStateLabelInput.value = result.loadingStateLabel || DEFAULT_LOADING_STATE_LABEL;
            timeoutStateLabelInput.value = result.timeoutStateLabel || DEFAULT_TIMEOUT_STATE_LABEL;

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

    // Add reset buttons functionality for colors
    resetPointerDownColorButton.addEventListener("click", () => {
        pointerDownColorInput.value = DEFAULT_POINTER_DOWN_COLOR;
    });

    resetPointerUpColorButton.addEventListener("click", () => {
        pointerUpColorInput.value = DEFAULT_POINTER_UP_COLOR;
    });

    // Add reset buttons functionality for labels
    resetEmptyStateLabelButton.addEventListener("click", () => {
        emptyStateLabelInput.value = DEFAULT_EMPTY_STATE_LABEL;
    });

    resetLoadingStateLabelButton.addEventListener("click", () => {
        loadingStateLabelInput.value = DEFAULT_LOADING_STATE_LABEL;
    });

    resetTimeoutStateLabelButton.addEventListener("click", () => {
        timeoutStateLabelInput.value = DEFAULT_TIMEOUT_STATE_LABEL;
    });

    // Helper function to show success message
    const showSuccessMessage = (statusElement) => {
        statusElement.classList.add("visible");
        setTimeout(() => {
            statusElement.classList.remove("visible");
        }, 5000);
    };

    // Save behavior settings when behavior save button is clicked
    saveBehaviorButton.addEventListener("click", () => {
        // Get behavior values from form
        const showLastContentPaint = showLastContentPaintToggle.checked;
        const timeAfterLastContentPaint = parseInt(timeAfterLastContentPaintInput.value, 10);
        const enableMutationTimeout = enableMutationTimeoutToggle.checked;
        const mutationTimeoutValue = parseInt(mutationTimeoutValueInput.value, 10);

        // Validate inputs
        if (isNaN(timeAfterLastContentPaint) || timeAfterLastContentPaint < 0) {
            alert("Time After Last Content Paint must be a positive number");
            return;
        }

        if (isNaN(mutationTimeoutValue) || mutationTimeoutValue < 100) {
            alert("Mutation Timeout Value must be at least 100ms");
            return;
        }

        // Save behavior settings to chrome.storage.sync
        chrome.storage.sync.set(
            {
                showLastContentPaint,
                timeAfterLastContentPaint,
                enableMutationTimeout,
                mutationTimeoutValue,
            },
            () => {
                // Update the status message
                showSuccessMessage(behaviorStatus);
            }
        );
    });

    // Save appearance settings when appearance save button is clicked
    saveAppearanceButton.addEventListener("click", () => {
        // Get appearance values from form
        const fpsComparisonValue = parseInt(fpsComparisonValueInput.value, 10);
        const pointerDownColor = pointerDownColorInput.value;
        const pointerUpColor = pointerUpColorInput.value;
        const emptyStateLabel = emptyStateLabelInput.value || DEFAULT_EMPTY_STATE_LABEL;
        const loadingStateLabel = loadingStateLabelInput.value || DEFAULT_LOADING_STATE_LABEL;
        const timeoutStateLabel = timeoutStateLabelInput.value || DEFAULT_TIMEOUT_STATE_LABEL;

        // Validate inputs
        if (isNaN(fpsComparisonValue) || fpsComparisonValue < 1 || fpsComparisonValue > 240) {
            alert("FPS Comparison Value must be between 1 and 240");
            return;
        }

        // Validate label inputs
        if (emptyStateLabel.length === 0 || loadingStateLabel.length === 0 || timeoutStateLabel.length === 0) {
            alert("Label fields cannot be empty");
            return;
        }

        // Save appearance settings to chrome.storage.sync
        chrome.storage.sync.set(
            {
                fpsComparisonValue,
                pointerDownColor,
                pointerUpColor,
                emptyStateLabel,
                loadingStateLabel,
                timeoutStateLabel,
            },
            () => {
                // Update the status message
                showSuccessMessage(appearanceStatus);
            }
        );
    });
});
