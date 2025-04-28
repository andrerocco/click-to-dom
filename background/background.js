// Background script to handle extension activation per tab
// TODO: Remove console.logs in production

// When the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed or updated");

    // Create context menu item for settings
    chrome.contextMenus.create({
        id: "settings",
        title: "Settings",
        contexts: ["action"],
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === "settings") {
        chrome.runtime.openOptionsPage();
    }
});

// Function to check if a tab is an extension page
function isExtensionPage(url) {
    return url.startsWith("chrome-extension://") || url.startsWith("chrome://") || url.startsWith("moz-extension://");
}

// Handle extension icon clicks
chrome.action.onClicked.addListener((tab) => {
    // Skip if this is an extension page (settings, etc.)
    if (isExtensionPage(tab.url)) {
        console.log("Clicked on extension page, not activating content script");
        return;
    }

    const key = "isActive_" + tab.id;
    chrome.storage.local.get([key], (result) => {
        const currentState = result[key] || false;
        const newState = !currentState;

        // Update storage with new state for this tab
        chrome.storage.local.set({ [key]: newState });

        // Update badge for this tab
        updateIcon(tab.id, newState);

        // Send message to content script to activate/deactivate
        chrome.tabs.sendMessage(tab.id, { action: newState ? "activate" : "deactivate" }, (response) => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
                console.error("Error communicating with content script:", lastError.message);
                // If error, revert state in storage since activation failed
                chrome.storage.local.set({ [key]: currentState });
                updateIcon(tab.id, currentState);
            }
        });
    });
});

// Clean up storage when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    const key = "isActive_" + tabId;
    chrome.storage.local.remove(key);
});

// Handle messages from content script to sync state
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getState") {
        const tabId = sender.tab.id;
        const key = "isActive_" + tabId;
        chrome.storage.local.get([key], (result) => {
            const isActive = result[key] || false;
            sendResponse({ isActive: isActive });
            // Ensure badge is consistent
            updateIcon(tabId, isActive);
        });
        return true; // Indicates asynchronous response
    }
});

// Function to update the badge for a specific tab
function updateIcon(tabId, isActive) {
    const badgeText = isActive ? "ON" : "";
    const badgeColor = isActive ? "#4CAF50" : "#ccc"; // Green when active, gray when inactive
    chrome.action.setBadgeText({ text: badgeText, tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId: tabId });
}
