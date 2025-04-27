document.addEventListener("DOMContentLoaded", () => {
    // Get all elements
    const fpsComparisonValueInput = document.getElementById("fpsComparisonValue");
    const showLastContentPaintToggle = document.getElementById("showLastContentPaint");
    const timeAfterLastContentPaintInput = document.getElementById("timeAfterLastContentPaint");
    const saveButton = document.getElementById("saveButton");
    const statusElement = document.getElementById("status");

    // Hide status message initially
    statusElement.style.display = "none";

    // Load current settings
    chrome.storage.sync.get(["fpsComparisonValue", "showLastContentPaint", "timeAfterLastContentPaint"], (result) => {
        // Set default values if settings don't exist yet
        fpsComparisonValueInput.value = result.fpsComparisonValue || 60;
        showLastContentPaintToggle.checked = result.showLastContentPaint || false;
        timeAfterLastContentPaintInput.value = result.timeAfterLastContentPaint || 100;

        // Update the disabled state of the time input based on toggle
        timeAfterLastContentPaintInput.disabled = !showLastContentPaintToggle.checked;
    });

    // Add a listener for the showLastContentPaint toggle to enable/disable the time input
    showLastContentPaintToggle.addEventListener("change", () => {
        timeAfterLastContentPaintInput.disabled = !showLastContentPaintToggle.checked;
    });

    // Save settings when button is clicked
    saveButton.addEventListener("click", () => {
        // Get values from form
        const fpsComparisonValue = parseInt(fpsComparisonValueInput.value, 10);
        const showLastContentPaint = showLastContentPaintToggle.checked;
        const timeAfterLastContentPaint = parseInt(timeAfterLastContentPaintInput.value, 10);

        // Validate number inputs
        if (isNaN(fpsComparisonValue) || fpsComparisonValue < 1 || fpsComparisonValue > 240) {
            alert("FPS Comparison Value must be between 1 and 240");
            return;
        }

        if (isNaN(timeAfterLastContentPaint) || timeAfterLastContentPaint < 0) {
            alert("Time After Last Content Paint must be a positive number");
            return;
        }

        // Save to chrome.storage.sync
        chrome.storage.sync.set(
            {
                fpsComparisonValue,
                showLastContentPaint,
                timeAfterLastContentPaint,
            },
            () => {
                // Show success message
                statusElement.textContent = "Settings saved successfully!";
                statusElement.style.display = "block";

                // Hide message after 2 seconds
                setTimeout(() => {
                    statusElement.style.display = "none";
                }, 2000);

                // Notify content scripts about the setting changes
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: "settingsUpdated",
                            settings: {
                                fpsComparisonValue,
                                showLastContentPaint,
                                timeAfterLastContentPaint,
                            },
                        });
                    }
                });
            }
        );
    });
});
