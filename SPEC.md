# SPEC.md: Technical Specification for `canvas-window`

`canvas-window` is a zero-dependency, modular canvas display and input subsystem for browser-based runtimes, Web Workers, and WebAssembly instances. It provides:
1. An interactive draggable, resizable, minimizable, and pop-out floating window UI.
2. Low-latency synchronous mouse, touch, and keyboard input coordination via a standardized 512-byte `SharedArrayBuffer` memory layout.
3. High-performance frame presentation supporting zero-copy `ImageBitmapRenderingContext` and pixel buffer fallbacks.
4. Universal compatibility for consumer runtimes (`canvas-wasi`, `canvas-js`, Pyodide, QuickJS, and custom worker engines).

---

## 1. Architecture Overview

`canvas-window` establishes a clean separation of concerns between the main thread browser DOM and background execution runtimes (Web Workers, WebAssembly modules, or sandboxed JS engines).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Main Browser Thread                             │
│                                                                        │
│   ┌───────────────────────────┐      ┌──────────────────────────────┐  │
│   │       CanvasWindow        │      │       InputCoordinator       │  │
│   │                           │      │                              │  │
│   │  - In-Page Floating Window│      │  - DOM Mouse/Wheel Listeners │  │
│   │  - External Popup Window  │◄────►│  - DOM Keyboard Keymap       │  │
│   │  - ImageBitmap Renderer   │      │  - Coordinate & DPI Scaling  │  │
│   │  - FPS & Resolution Badge │      │  - ShouldClose State         │  │
│   │  - Dynamic Focus Binding  │      │  - Event Subscriptions       │  │
│   └─────────────▲─────────────┘      └──────────────┬───────────────┘  │
└─────────────────┼───────────────────────────────────┼──────────────────┘
                  │ postMessage (ImageBitmap / frame) │ 512-byte SharedArrayBuffer
┌─────────────────┼───────────────────────────────────┼──────────────────┐
│                 │                                   ▼                  │
│   ┌─────────────┴─────────────┐      ┌──────────────────────────────┐  │
│   │   Consumer Host Bridge    │      │         InputReader          │  │
│   │   (canvas-wasi / worker)  │      │  (Zero-DOM Worker Consumer)  │  │
│   │                           │      │                              │  │
│   │  - OffscreenCanvas / 2D   │◄────►│  - Synchronous Key/Mouse Poll│  │
│   │  - Frame Pacing & Timing  │      │  - 512-bit Bitmask Decoding  │  │
│   │  - Pixel Buffer Packing   │      │  - ESC / Window Close Flag   │  │
│   └─────────────▲─────────────┘      └──────────────┬───────────────┘  │
│                 │ Runtimes (C/C++, JS, Python, etc.)│                  │
│   ┌─────────────┴───────────────────────────────────▼──────────────┐  │
│   │               Worker Execution Sandbox / Instance              │  │
│   └────────────────────────────────────────────────────────────────┘  │
│                         Web Worker Thread                              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Input Memory Map & Protocol Specification

### 2.1 512-Byte SharedArrayBuffer Memory Map

When running in cross-origin isolated contexts (`window.crossOriginIsolated === true`), a fixed 512-byte `SharedArrayBuffer` coordinates input state between the main thread UI and background worker runtimes with sub-millisecond latency.

| Byte Offset | Type | Constant Name | Description |
|---|---|---|---|
| `0` | `int32` | `OFF_WINDOW_WIDTH` | Logical window display width in pixels |
| `4` | `int32` | `OFF_WINDOW_HEIGHT` | Logical window display height in pixels |
| `8` | `int32` | `OFF_RENDER_WIDTH` | Render buffer width in pixels |
| `12` | `int32` | `OFF_RENDER_HEIGHT` | Render buffer height in pixels |
| `16` | `float32` | `OFF_DPI_SCALE` | Device pixel ratio / display scaling factor |
| `20` | `int32` | `OFF_SHOULD_CLOSE` | `1` if close requested or ESC pressed, `0` otherwise |
| `24` | `float32` | `OFF_MOUSE_X` | Mouse X coordinate mapped to canvas coordinate space |
| `28` | `float32` | `OFF_MOUSE_Y` | Mouse Y coordinate mapped to canvas coordinate space |
| `32` | `float32` | `OFF_MOUSE_WHEEL_X` | Accumulated horizontal wheel delta |
| `36` | `float32` | `OFF_MOUSE_WHEEL_Y` | Accumulated vertical wheel delta |
| `40` | `uint32` | `OFF_MOUSE_BUTTONS` | Button bitmask: Bit 0 = Left, Bit 1 = Right, Bit 2 = Middle |
| `44 .. 107` | `uint32[16]` | `OFF_KEYS_DOWN` | 512-bit bitmask of active keyboard keys (`DOM_KEY_MAP`) |
| `108` | `int32` | `OFF_KEY_PRESSED_COUNT` | Number of queued key events (max 32) |
| `112 .. 239` | `int32[32]` | `OFF_KEY_PRESSED_QUEUE` | Key codes pressed since last poll |
| `240` | `int32` | `OFF_CHAR_PRESSED_COUNT` | Number of queued Unicode codepoints (max 32) |
| `244 .. 371` | `int32[32]` | `OFF_CHAR_PRESSED_QUEUE` | Unicode codepoints typed since last poll |
| `372 .. 375` | `int32` | `OFF_FRAME_SYNC` | Synchronization word for `Atomics.wait()` pacing |
| `376 .. 511` | `uint8[136]` | `OFF_RESERVED` | Reserved for future extensions (gamepad, audio, touch multi-point) |

### 2.2 Button Bitmasks

```javascript
export const MOUSE_BUTTON_LEFT = 1;   // Bit 0: Primary (Left)
export const MOUSE_BUTTON_RIGHT = 2;  // Bit 1: Secondary (Right)
export const MOUSE_BUTTON_MIDDLE = 4; // Bit 2: Auxiliary (Middle)
```

### 2.3 Direct Buffer Polling (`pollToBuffer`)

For execution engines that poll input directly into a linear memory buffer or `ArrayBuffer`:
```javascript
inputCoordinator.pollToBuffer(destPtr, targetBufferOrMemory);
```
- Copies 372 bytes of active input state directly into `destPtr` of the destination buffer.
- Automatically flushes transient deltas (`mouseWheelX`, `mouseWheelY`, `keyPressedQueue`, `charPressedQueue`).
- Maintains `pollToWasm(destPtr, wasmMemory)` as a backward-compatible alias.

### 2.4 Keyboard Key Mapping (`DOM_KEY_MAP`)

Keyboard keys are mapped into a 512-bit bitmask (`keysDown[16]`) using standard virtual keycodes:
- `KeyA` – `KeyZ`: 65–90
- `Digit0` – `Digit9`: 48–57
- `Space`: 32, `Escape`: 256, `Enter`: 257, `Tab`: 258, `Backspace`: 259
- `Insert`: 260, `Delete`: 261, `ArrowRight`: 262, `ArrowLeft`: 263, `ArrowDown`: 264, `ArrowUp`: 265
- `PageUp`: 266, `PageDown`: 267, `Home`: 268, `End`: 269
- `CapsLock`: 280, `ScrollLock`: 281, `NumLock`: 282, `PrintScreen`: 283, `Pause`: 284
- `F1` – `F12`: 290–301
- Modifiers: `ShiftLeft` (340), `ControlLeft` (341), `AltLeft` (342), `MetaLeft` (343), etc.
- Numpad: `Numpad0` – `Numpad9`: 320–329

---

## 3. Window Lifecycle & User Interface

### 3.1 DOM Hierarchy

When instantiated in a browser document, `CanvasWindow` manages `#graphics-window`:

```html
<div id="graphics-window" class="graphics-window">
  <div class="graphics-header" id="graphics-header">
    <div class="graphics-title">
      <span class="graphics-icon">🎮</span>
      <span id="graphics-title-text">Canvas Display</span>
      <span class="graphics-badge" id="graphics-res-badge">800x450</span>
      <span class="graphics-badge fps-badge" id="graphics-fps-badge">60 FPS</span>
    </div>
    <div class="graphics-actions">
      <button id="btn-graphics-popout" class="graphics-btn" title="Pop out into separate window" data-tooltip="Pop Out Window">↗</button>
      <button id="btn-graphics-min" class="graphics-btn" title="Minimize" data-tooltip="Minimize">_</button>
      <button id="btn-graphics-close" class="graphics-btn" title="Close Window" data-tooltip="Close">&times;</button>
    </div>
  </div>
  <div class="graphics-body" id="graphics-body">
    <canvas id="graphics-canvas" width="800" height="450" tabindex="0"></canvas>
  </div>
</div>
```

### 3.2 Draggable Window & Canvas Focus

1. **Header Dragging**: Dragging `#graphics-header` updates `.style.left` and `.style.top` with viewport boundary clamping.
2. **Click-to-Focus**: Clicking anywhere on the window frame or title bar automatically focuses the active canvas element, ensuring keyboard inputs are received immediately without requiring the user to explicitly click the drawing surface.

### 3.3 Multi-Window Pop-Out & Docking Protocol

1. **Pop-out (`popOut`)**:
   - Opens an external popup window (`window.open`) with a dedicated dark container and canvas `#graphics-popup-canvas`.
   - Hides the in-page window.
   - Automatically rebinds `InputCoordinator.attachListeners()` to the popup canvas and popup window target.
   - Injects a "↙ Dock into page" control.
2. **Dock-back (`dockBack`)**:
   - Closes the popup window.
   - Restores the in-page floating window.
   - Rebinds `InputCoordinator.attachListeners()` back to the in-page canvas and focuses it.
3. **External Window Close Handling**:
   - If the user closes the popup window directly via the OS close button, the `unload` handler automatically catches the event and restores the in-page window cleanly without losing state or disconnecting input.

---

## 4. Frame Presentation Pipeline

`CanvasWindow` supports two high-performance rendering pipelines:

1. **ImageBitmap Presentation (`renderBitmap` / `renderFrame`)**:
   - Primary: Uses an `ImageBitmapRenderingContext` (`ctx.transferFromImageBitmap(bitmap)`), transferring the bitmap directly to the compositor with zero memory copies.
   - Fallback: Uses 2D canvas context `drawImage(bitmap, 0, 0)` when `bitmaprenderer` is unavailable, closing the bitmap immediately afterwards.
2. **Pixel Buffer Presentation (`renderFrameBuffer`)**:
   - Ingests raw RGBA pixel byte buffers (`ArrayBuffer` or `ArrayBufferView`).
   - Uses `ImageData` and `putImageData` (or `createImageBitmap(imgData)`).
3. **Background Activity Tracking**:
   - If frames arrive while the window is hidden or minimized, `CanvasWindow` invokes `onFrameActivity(true)`.
   - Restoring or opening the window clears background activity (`onFrameActivity(false)`).

---

## 5. API Reference

### 5.1 `CanvasWindow` (`GraphicsWindowUI`)

```typescript
class CanvasWindow {
  constructor(options?: CanvasWindowOptions);

  width: number;
  height: number;
  title: string;
  isPoppedOut: boolean;
  isMinimized: boolean;

  open(width?: number, height?: number, title?: string): void;
  close(): void;
  focus(): void;
  show(): void;
  hide(): void;
  toggle(): void;
  toggleMinimize(): void;
  togglePopOut(): void;
  popOut(): void;
  dockBack(): void;

  isOpen(): boolean;
  isCanvasVisible(): boolean;

  renderBitmap(bitmap: ImageBitmap): void;
  renderFrame(bitmap: ImageBitmap): void;
  renderFrameBuffer(buffer: ArrayBuffer | ArrayBufferView, width: number, height: number): void;

  updateFps(fps: number): void;
  updateFPS(fps: number): void;
  setInputCoordinator(inputCoordinator: InputCoordinator): void;

  setActivity(active: boolean): void;
  clearActivity(): void;
}
```

### 5.2 `InputCoordinator`

```typescript
class InputCoordinator {
  constructor(options?: InputCoordinatorOptions);

  windowWidth: number;
  windowHeight: number;
  renderWidth: number;
  renderHeight: number;
  dpiScale: number;
  shouldClose: boolean;

  mouseX: number;
  mouseY: number;
  mouseButtons: number;
  mouseWheelX: number;
  mouseWheelY: number;
  keysDown: Uint32Array; // 16 words = 512 bits

  attachListeners(canvas: HTMLCanvasElement, windowTarget?: Window | null): void;
  detach(): void;
  reset(): void;
  updateSharedState(): void;

  pollToBuffer(destPtr: number, target: ArrayBuffer | { buffer: ArrayBuffer }): void;
  pollToWasm(destPtr: number, mem: { buffer: ArrayBuffer }): void;

  addListener(fn: (event: any) => void): () => void;
}
```

### 5.3 `InputReader` (Worker Consumer API)

Zero-DOM input consumer designed for Web Workers and background JS execution contexts reading synchronously from a 512-byte `SharedArrayBuffer` (or `ArrayBuffer`).

```typescript
interface InputReaderOptions {
  sharedBuffer?: SharedArrayBuffer | ArrayBuffer | null;
  buffer?: SharedArrayBuffer | ArrayBuffer | null;
}

interface MouseState {
  x: number;
  y: number;
  buttons: number;
  wheelX: number;
  wheelY: number;
}

interface WindowDimensions {
  windowWidth: number;
  windowHeight: number;
  renderWidth: number;
  renderHeight: number;
  dpiScale: number;
}

class InputReader {
  constructor(bufferOrOptions?: SharedArrayBuffer | ArrayBuffer | InputReaderOptions | null);

  setBuffer(buffer: SharedArrayBuffer | ArrayBuffer | null): void;
  hasBuffer(): boolean;

  // Window & Lifecycle queries
  shouldClose(): boolean;
  getDimensions(): WindowDimensions;
  getWindowWidth(): number;
  getWindowHeight(): number;
  getRenderWidth(): number;
  getRenderHeight(): number;
  getDpiScale(): number;

  // Mouse queries
  getMouse(): MouseState;
  getMouseX(): number;
  getMouseY(): number;
  getMouseButtons(): number;
  isMouseButtonDown(button: number): boolean;
  isMouseLeftDown(): boolean;
  isMouseRightDown(): boolean;
  isMouseMiddleDown(): boolean;
  getMouseWheelX(): number;
  getMouseWheelY(): number;

  // Keyboard queries
  isKeyDown(key: number): boolean;
  getKeysDown(): number[];
  getKeyPressedQueue(): number[];
  getCharPressedQueue(): number[];

  // Synchronization
  waitFrame(expectedSync?: number, timeoutMs?: number): 'ok' | 'not-equal' | 'timed-out';
}
```

---

## 6. Package Exports

| Subpath | Target | Purpose |
|---|---|---|
| `canvas-window` (`.`) | `./src/index.js` | Main package entry: `CanvasWindow`, `GraphicsWindowUI`, `InputCoordinator`, `InputReader`, `DOM_KEY_MAP`, and protocol constants |
| `canvas-window/worker` (`./worker`) | `./src/worker.js` | Lightweight worker entry: `InputReader`, `DOM_KEY_MAP`, protocol constants (zero DOM dependencies) |
| `canvas-window/window` (`./window`) | `./src/ui/canvas-window.js` | Standalone window UI component |
| `canvas-window/input` (`./input`) | `./src/input/input-coordinator.js` | Standalone input coordinator, input reader, and key map |
| `canvas-window/protocol` (`./protocol`) | `./src/protocol.js` | 512-byte SharedArrayBuffer layout constants and masks |
| `canvas-window/style.css` (`./style.css`) | `./src/ui/style.css` | Stylesheet for the floating window UI |

