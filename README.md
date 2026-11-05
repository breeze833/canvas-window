# canvas-window

Zero-dependency floating draggable canvas window and input coordinator for Web Workers, WebAssembly, and browser runtimes.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/breeze833/canvas-window?include_prereleases)](https://github.com/breeze833/canvas-window/releases)

---

## Highlights

- 🪟 **Floating Draggable Window**: Integrated header dragging, minimization, resolution and FPS badges, and dark theme styling.
- ↗️ **Detachable Pop-Out Window**: One-click detachment into an external browser popup window (`window.open`) with dedicated canvas and seamless dock-back restoration.
- ⚡ **Zero-Latency Synchronous Input**: 512-byte `SharedArrayBuffer` memory layout coordinating mouse, touch, wheel, and keyboard states with background workers.
- 🕹️ **Zero-DOM Worker InputReader**: High-level, ergonomic query methods (`isKeyDown()`, `getMouse()`, `isMouseButtonDown()`) for background Web Workers.
- 🚀 **High-Performance Presentation**: Zero-copy `ImageBitmapRenderingContext` frame transfers directly to the browser compositor with pixel buffer fallbacks.
- 🎯 **Click-to-Focus**: Automatically focuses the active canvas on window frame or header interactions, ensuring keyboard events are never missed.
- 📦 **Zero External Runtime Dependencies**: Pure standard vanilla ES modules and standard browser APIs.

---

## Installation

Install directly from GitHub via npm:

```bash
npm install github:breeze833/canvas-window
# or specify a tag, branch, or commit:
npm install github:breeze833/canvas-window#main
```

Or download prepackaged release assets (`canvas-window-*.tgz`, `canvas-window.tar.gz`, `canvas-window.zip`) directly from [GitHub Releases](https://github.com/breeze833/canvas-window/releases).


---

## Quick Start

### 1. Main Thread Setup

```javascript
import { CanvasWindow, InputCoordinator } from 'canvas-window';
import 'canvas-window/style.css';

// 1. Allocate 512-byte shared buffer for zero-latency input (if crossOriginIsolated)
const sharedBuffer = typeof SharedArrayBuffer !== 'undefined'
  ? new SharedArrayBuffer(512)
  : null;

// 2. Instantiate Input Coordinator
const inputCoordinator = new InputCoordinator({
  sharedBuffer,
  width: 800,
  height: 450
});

// 3. Instantiate Canvas Window UI
const win = new CanvasWindow({
  width: 800,
  height: 450,
  title: 'My Game / Sandbox',
  sharedBuffer,
  inputCoordinator,
  onCloseRequested: () => console.log('Window closed')
});

win.open();

// 4. Start Web Worker
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
worker.postMessage({ type: 'start', sharedBuffer });

worker.onmessage = (e) => {
  if (e.data.type === 'frame') {
    win.renderFrame(e.data.bitmap);
  } else if (e.data.type === 'fps') {
    win.updateFps(e.data.fps);
  }
};
```

### 2. Web Worker Setup

```javascript
// worker.js
import { InputReader } from 'canvas-window/worker';

const input = new InputReader();
const canvas = new OffscreenCanvas(800, 450);
const ctx = canvas.getContext('2d');

self.onmessage = (e) => {
  if (e.data.type === 'start') {
    input.setBuffer(e.data.sharedBuffer);
    requestAnimationFrame(renderLoop);
  }
};

function renderLoop() {
  // 1. Read input synchronously with zero latency via InputReader
  const mouse = input.getMouse();
  const isMoving = input.isKeyDown(87) || input.isKeyDown(265); // W or ArrowUp

  // 2. Render graphics
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, 800, 450);

  ctx.fillStyle = input.isMouseLeftDown() ? '#ff4081' : '#00e5ff';
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, 20, 0, Math.PI * 2);
  ctx.fill();

  // 3. Transfer frame to main thread
  const bitmap = canvas.transferToImageBitmap();
  self.postMessage({ type: 'frame', bitmap }, [bitmap]);

  requestAnimationFrame(renderLoop);
}
```

---

## 512-Byte Input Memory Map

In cross-origin isolated contexts, `InputCoordinator` continuously synchronizes state to a 512-byte `SharedArrayBuffer`:

| Offset | Type | Constant | Description |
|---|---|---|---|
| `0` | `int32` | `OFF_WINDOW_WIDTH` | Logical window display width in pixels |
| `4` | `int32` | `OFF_WINDOW_HEIGHT` | Logical window display height in pixels |
| `8` | `int32` | `OFF_RENDER_WIDTH` | Render buffer width in pixels |
| `12` | `int32` | `OFF_RENDER_HEIGHT` | Render buffer height in pixels |
| `16` | `float32` | `OFF_DPI_SCALE` | Device pixel ratio / display scaling factor |
| `20` | `int32` | `OFF_SHOULD_CLOSE` | `1` if close requested or ESC pressed |
| `24` | `float32` | `OFF_MOUSE_X` | Mouse X coordinate mapped to canvas space |
| `28` | `float32` | `OFF_MOUSE_Y` | Mouse Y coordinate mapped to canvas space |
| `32` | `float32` | `OFF_MOUSE_WHEEL_X` | Horizontal wheel delta accumulated |
| `36` | `float32` | `OFF_MOUSE_WHEEL_Y` | Vertical wheel delta accumulated |
| `40` | `uint32` | `OFF_MOUSE_BUTTONS` | Button bitmask: Bit 0=Left, Bit 1=Right, Bit 2=Middle |
| `44..107` | `uint32[16]` | `OFF_KEYS_DOWN` | 512-bit bitmask of active keys (`DOM_KEY_MAP`) |
| `108` | `int32` | `OFF_KEY_PRESSED_COUNT` | Number of queued key events (max 32) |
| `112..239`| `int32[32]` | `OFF_KEY_PRESSED_QUEUE` | Key codes pressed since last poll |
| `240` | `int32` | `OFF_CHAR_PRESSED_COUNT`| Number of queued Unicode codepoints (max 32) |
| `244..371`| `int32[32]` | `OFF_CHAR_PRESSED_QUEUE`| Unicode codepoints typed since last poll |
| `372..375`| `int32` | `OFF_FRAME_SYNC` | Synchronization word for `Atomics.wait()` pacing |

---

## API Summary

### `CanvasWindow`
- `open(width, height, title)`: Initializes and shows the window.
- `close()`: Closes window, notifies listeners, resets input.
- `focus()`: Brings window to front and focuses the active canvas.
- `toggleMinimize()`: Collapses window to titlebar only with dynamic icon toggle (`_` vs `□`).
- `togglePopOut()` / `popOut()`: Pops canvas out into separate browser window.
- `dockBack()`: Restores detached canvas back to the in-page window.
- `renderFrame(bitmap)`: Renders `ImageBitmap` with zero copy and tracks background activity.
- `renderFrameBuffer(buffer, width, height)`: Fallback renderer for raw RGBA pixel arrays.
- `updateFps(fps)`: Updates real-time FPS badge in header.

*(Note: `GraphicsWindowUI` is exported as an alias for full compatibility with existing `canvas-wasi` code).*

### `InputCoordinator`
- `attachListeners(canvas, windowTarget)`: Binds mouse, keyboard, touch, and wheel listeners.
- `detach()`: Removes active event listeners.
- `reset()`: Resets mouse positions, button masks, and key queues to zero.
- `pollToBuffer(destPtr, target)`: Copies 372 bytes of active input state directly into linear memory or an `ArrayBuffer`.
- `addListener(fn)`: Subscribe to input events directly on the main thread.

### `InputReader` (Worker Consumer)
- `setBuffer(buffer)`: Attach or swap the 512-byte `SharedArrayBuffer` or `ArrayBuffer`.
- `getMouse()`: Snapshot of `{ x, y, buttons, wheelX, wheelY }`.
- `getMouseX()` / `getMouseY()`: Pointer coordinates mapped to render canvas space.
- `getMouseButtons()`: Raw mouse button bitmask (1=Left, 2=Right, 4=Middle).
- `isMouseButtonDown(button)`: Tests bitmask or DOM index 0.
- `isMouseLeftDown()`, `isMouseRightDown()`, `isMouseMiddleDown()`: Convenience button checkers.
- `getMouseWheelX()`, `getMouseWheelY()`: Accumulated wheel deltas.
- `isKeyDown(keyCode)`: Synchronously queries 512-bit keymask (`DOM_KEY_MAP` virtual key codes).
- `getKeysDown()`: Returns array of all actively held key codes.
- `shouldClose()`: Returns true if the window close or ESC flag was triggered.
- `getDimensions()`: Returns `{ windowWidth, windowHeight, renderWidth, renderHeight, dpiScale }`.
- `waitFrame(expectedSync, timeoutMs)`: Pacing helper via `Atomics.wait`.

---

## Package Subpath Exports

| Subpath | Target | Description |
|---|---|---|
| `canvas-window` | `./src/index.js` | Main bundle: `CanvasWindow`, `InputCoordinator`, `InputReader`, protocol |
| `canvas-window/worker` | `./src/worker.js` | Worker bundle: `InputReader`, `DOM_KEY_MAP`, protocol (zero DOM code) |
| `canvas-window/window` | `./src/ui/canvas-window.js` | Standalone UI window component |
| `canvas-window/input` | `./src/input/input-coordinator.js` | Standalone input coordinator, reader, and keymap |
| `canvas-window/protocol` | `./src/protocol.js` | Protocol constants and memory offsets |
| `canvas-window/style.css` | `./src/ui/style.css` | Window stylesheets |

---

## Cross-Origin Isolation (COOP / COEP)

To utilize zero-latency `SharedArrayBuffer` memory synchronization, configure your server with:
```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

---

## License

MIT © [breeze833](https://github.com/breeze833)
