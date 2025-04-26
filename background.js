// Background script for Next Frame Extension

// Listen for extension button clicks to activate the content script
chrome.action.onClicked.addListener((tab) => {
  // Execute the content script on the current tab
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content/content.js"],
  });
});
