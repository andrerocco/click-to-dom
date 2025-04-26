// Popup script for Next Frame Extension

document.addEventListener("DOMContentLoaded", function () {
  const activateButton = document.getElementById("activate");
  const statusElement = document.getElementById("status");

  activateButton.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const activeTab = tabs[0];

      chrome.scripting
        .executeScript({
          target: { tabId: activeTab.id },
          files: ["content/content.js"],
        })
        .then(() => {
          // Show activation status
          statusElement.classList.add("active");

          // Auto close popup after 1.5 seconds
          setTimeout(() => {
            window.close();
          }, 1500);
        })
        .catch((error) => {
          console.error("Error injecting content script:", error);
        });
    });
  });
});
