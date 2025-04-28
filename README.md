# Click to DOM: mouse interaction to DOM update delay calculator

Click to DOM is a Chrome Extension that measures the time it takes for the DOM to update (First Paint, Last Content Paint) after pointer events (e.g., mouse clicks, taps).

Download (Chrome Web Store): _link soon._

https://github.com/user-attachments/assets/f65af4bf-0e96-480f-b40c-94173b2895e3

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" in the top-right corner.
4. Click "Load unpacked" and select the folder containing this extension.

## How it works

You can toggle the extension on and off by clicking the extension icon.

While the extension is on:

-   `pointerdown` and `pointerup` events on the page trigger makes the extension start waiting for DOM mutations. When they happen (if they do), the time (in milliseconds) it took from the `pointerdown`/`pointerup` event to the first DOM mutation is shown on the extension overlay - with the respective amount of frames that this equates to at a certain FPS (that can be changed in the settings).
-   Notice that there may be cases where a DOM mutation never happens after a mouse interaction. To prevent the extension from just "hang" forever, we have set a maximum amount of time that the extension waits for an updated. This can be disabled or modified in the extension settings.
-   Also notice that any DOM mutation (even the ones that may not have been caused by the mouse click but by an element hover or keyboard click) are captured by the extension. So, for precise results, keep your mouse and keyboard still after the mouse click.

## Settings

You can open the extension settings by right clicking the extension icon and accessing "Settings".

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests to improve the extension.
