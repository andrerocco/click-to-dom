// Background script to handle extension activation

// When the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed or updated");
});

// The action.onClicked event won't fire if we have a popup,
// but we'll keep this handler for backwards compatibility or future use
chrome.action.onClicked.addListener((tab) => {
    // We'll forward to our popup logic for handling activation
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
