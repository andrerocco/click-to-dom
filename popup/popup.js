document.addEventListener("DOMContentLoaded", async () => {
    const enableSwitch = document.getElementById("enableExtension");
    const recordSwitch = document.getElementById("recordInteractions");
    const statusElement = document.getElementById("status");

    // Get the current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    // Function to update UI based on extension state
    const updateUI = (isActive, isRecording) => {
        enableSwitch.checked = isActive;
        recordSwitch.checked = isRecording;
        recordSwitch.disabled = !isActive;

        if (isActive) {
            statusElement.textContent = isRecording ? "Extension active and recording" : "Extension active";
        } else {
            statusElement.textContent = "Extension inactive";
        }
    };

    // Get initial state from content script
    try {
        chrome.tabs.sendMessage(currentTab.id, { action: "getState" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error getting state:", chrome.runtime.lastError);
                updateUI(false, false);
                return;
            }

            if (response) {
                updateUI(response.isActive, response.isRecording || false);
            } else {
                updateUI(false, false);
            }
        });
    } catch (error) {
        console.error("Error:", error);
        updateUI(false, false);
    }

    // Handle enabling/disabling the extension
    enableSwitch.addEventListener("change", () => {
        const action = enableSwitch.checked ? "activate" : "deactivate";

        chrome.tabs.sendMessage(currentTab.id, { action }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error toggling extension:", chrome.runtime.lastError);
                return;
            }

            if (response) {
                // If we're disabling the extension, also disable recording
                if (!enableSwitch.checked) {
                    recordSwitch.checked = false;
                }

                updateUI(response.isActive, response.isRecording || false);
            }
        });
    });

    // Handle recording toggle
    recordSwitch.addEventListener("change", () => {
        if (!enableSwitch.checked) {
            recordSwitch.checked = false;
            return;
        }

        const action = recordSwitch.checked ? "startRecording" : "stopRecording";

        chrome.tabs.sendMessage(currentTab.id, { action }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error toggling recording:", chrome.runtime.lastError);
                return;
            }

            if (response) {
                updateUI(response.isActive, response.isRecording);
            }
        });
    });
});
