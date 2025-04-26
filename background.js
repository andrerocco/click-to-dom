// Background script to handle extension activation

// When the user clicks on the extension icon
chrome.action.onClicked.addListener((tab) => {
    // Check the current state of the extension for this tab
    chrome.tabs.sendMessage(tab.id, { action: "getState" }, (response) => {
        const lastError = chrome.runtime.lastError;

        // If there's an error, the content script might not be ready yet or has an error
        if (lastError) {
            console.error("Error communicating with content script:", lastError);
            return;
        }

        // Toggle the state based on the response
        if (!response || !response.isActive) {
            chrome.tabs.sendMessage(tab.id, { action: "activate" });
        } else {
            chrome.tabs.sendMessage(tab.id, { action: "deactivate" });
        }
    });
});
