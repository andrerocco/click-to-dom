document.addEventListener("DOMContentLoaded", () => {
    const detailedModeToggle = document.getElementById("detailedMode");
    const saveButton = document.getElementById("saveButton");
    const statusElement = document.getElementById("status");

    // Hide status message initially
    statusElement.style.display = "none";

    // Load current settings
    chrome.storage.sync.get(["detailedMode"], (result) => {
        detailedModeToggle.checked = result.detailedMode === true;
    });

    // Save settings when button is clicked
    saveButton.addEventListener("click", () => {
        const detailedMode = detailedModeToggle.checked;

        // Save to chrome.storage.sync
        chrome.storage.sync.set({ detailedMode }, () => {
            // Show success message
            statusElement.textContent = "Settings saved successfully!";
            statusElement.style.display = "block";

            // Hide message after 2 seconds
            setTimeout(() => {
                statusElement.style.display = "none";
            }, 2000);

            // Notify content scripts about the setting change
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "settingsUpdated",
                        settings: { detailedMode },
                    });
                }
            });
        });
    });
});
