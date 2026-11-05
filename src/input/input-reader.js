// canvas-window: Synchronous Input Reader for Web Workers & Background Tasks
// Reads mouse, keyboard, and window state from the 512-byte SharedArrayBuffer protocol

import {
  OFF_WINDOW_WIDTH,
  OFF_WINDOW_HEIGHT,
  OFF_RENDER_WIDTH,
  OFF_RENDER_HEIGHT,
  OFF_DPI_SCALE,
  OFF_SHOULD_CLOSE,
  OFF_MOUSE_X,
  OFF_MOUSE_Y,
  OFF_MOUSE_WHEEL_X,
  OFF_MOUSE_WHEEL_Y,
  OFF_MOUSE_BUTTONS,
  OFF_KEYS_DOWN,
  OFF_KEY_PRESSED_COUNT,
  OFF_KEY_PRESSED_QUEUE,
  OFF_CHAR_PRESSED_COUNT,
  OFF_CHAR_PRESSED_QUEUE,
  OFF_FRAME_SYNC,
  MOUSE_BUTTON_LEFT,
  MOUSE_BUTTON_RIGHT,
  MOUSE_BUTTON_MIDDLE
} from '../protocol.js';

export class InputReader {
  /**
   * @param {SharedArrayBuffer | ArrayBuffer | { sharedBuffer?: SharedArrayBuffer, buffer?: SharedArrayBuffer | ArrayBuffer } | null} [bufferOrOptions]
   */
  constructor(bufferOrOptions = null) {
    this.buffer = null;
    this.sharedView = null;
    this.int32View = null;

    if (bufferOrOptions) {
      if (bufferOrOptions instanceof SharedArrayBuffer || bufferOrOptions instanceof ArrayBuffer) {
        this.setBuffer(bufferOrOptions);
      } else if (typeof bufferOrOptions === 'object') {
        const buf = bufferOrOptions.sharedBuffer || bufferOrOptions.buffer || null;
        if (buf) this.setBuffer(buf);
      }
    }
  }

  /**
   * Attach or update the underlying SharedArrayBuffer or ArrayBuffer
   * @param {SharedArrayBuffer | ArrayBuffer | null} buffer
   */
  setBuffer(buffer) {
    if (buffer && (buffer instanceof SharedArrayBuffer || buffer instanceof ArrayBuffer)) {
      this.buffer = buffer;
      this.sharedView = new DataView(buffer);
      this.int32View = new Int32Array(buffer);
    } else {
      this.buffer = null;
      this.sharedView = null;
      this.int32View = null;
    }
  }

  /**
   * @returns {boolean} Whether an active buffer is attached
   */
  hasBuffer() {
    return this.sharedView !== null;
  }

  // --- Window & Lifecycle Queries ---

  /**
   * @returns {boolean} True if the window close was requested (or ESC was pressed)
   */
  shouldClose() {
    if (!this.sharedView) return false;
    return this.sharedView.getInt32(OFF_SHOULD_CLOSE, true) !== 0;
  }

  /**
   * @returns {{ windowWidth: number, windowHeight: number, renderWidth: number, renderHeight: number, dpiScale: number }}
   */
  getDimensions() {
    return {
      windowWidth: this.getWindowWidth(),
      windowHeight: this.getWindowHeight(),
      renderWidth: this.getRenderWidth(),
      renderHeight: this.getRenderHeight(),
      dpiScale: this.getDpiScale()
    };
  }

  /**
   * @returns {number} Logical window width in pixels
   */
  getWindowWidth() {
    return this.sharedView ? this.sharedView.getInt32(OFF_WINDOW_WIDTH, true) : 0;
  }

  /**
   * @returns {number} Logical window height in pixels
   */
  getWindowHeight() {
    return this.sharedView ? this.sharedView.getInt32(OFF_WINDOW_HEIGHT, true) : 0;
  }

  /**
   * @returns {number} Render buffer width in pixels
   */
  getRenderWidth() {
    return this.sharedView ? this.sharedView.getInt32(OFF_RENDER_WIDTH, true) : 0;
  }

  /**
   * @returns {number} Render buffer height in pixels
   */
  getRenderHeight() {
    return this.sharedView ? this.sharedView.getInt32(OFF_RENDER_HEIGHT, true) : 0;
  }

  /**
   * @returns {number} Device pixel ratio / display scaling factor
   */
  getDpiScale() {
    return this.sharedView ? this.sharedView.getFloat32(OFF_DPI_SCALE, true) : 1.0;
  }

  // --- Mouse Queries ---

  /**
   * Returns a complete snapshot of current mouse coordinates, buttons, and wheel
   * @returns {{ x: number, y: number, buttons: number, wheelX: number, wheelY: number }}
   */
  getMouse() {
    return {
      x: this.getMouseX(),
      y: this.getMouseY(),
      buttons: this.getMouseButtons(),
      wheelX: this.getMouseWheelX(),
      wheelY: this.getMouseWheelY()
    };
  }

  /**
   * @returns {number} Mouse X coordinate mapped to render canvas space (-1 if outside or uninitialized)
   */
  getMouseX() {
    return this.sharedView ? this.sharedView.getFloat32(OFF_MOUSE_X, true) : -1;
  }

  /**
   * @returns {number} Mouse Y coordinate mapped to render canvas space (-1 if outside or uninitialized)
   */
  getMouseY() {
    return this.sharedView ? this.sharedView.getFloat32(OFF_MOUSE_Y, true) : -1;
  }

  /**
   * @returns {number} Raw mouse button bitmask (1 = Left, 2 = Right, 4 = Middle)
   */
  getMouseButtons() {
    return this.sharedView ? this.sharedView.getUint32(OFF_MOUSE_BUTTONS, true) : 0;
  }

  /**
   * Checks if a mouse button is actively down.
   * Supports bitmasks (MOUSE_BUTTON_LEFT=1, RIGHT=2, MIDDLE=4) or DOM index 0 for primary button.
   * @param {number} button
   * @returns {boolean}
   */
  isMouseButtonDown(button) {
    if (!this.sharedView) return false;
    const buttons = this.sharedView.getUint32(OFF_MOUSE_BUTTONS, true);
    if (button === 0) return (buttons & MOUSE_BUTTON_LEFT) !== 0;
    return (buttons & button) !== 0;
  }

  /**
   * @returns {boolean} True if left / primary mouse button is pressed
   */
  isMouseLeftDown() {
    return this.isMouseButtonDown(MOUSE_BUTTON_LEFT);
  }

  /**
   * @returns {boolean} True if right / secondary mouse button is pressed
   */
  isMouseRightDown() {
    return this.isMouseButtonDown(MOUSE_BUTTON_RIGHT);
  }

  /**
   * @returns {boolean} True if middle / auxiliary mouse button is pressed
   */
  isMouseMiddleDown() {
    return this.isMouseButtonDown(MOUSE_BUTTON_MIDDLE);
  }

  /**
   * @returns {number} Accumulated horizontal mouse wheel delta
   */
  getMouseWheelX() {
    return this.sharedView ? this.sharedView.getFloat32(OFF_MOUSE_WHEEL_X, true) : 0;
  }

  /**
   * @returns {number} Accumulated vertical mouse wheel delta
   */
  getMouseWheelY() {
    return this.sharedView ? this.sharedView.getFloat32(OFF_MOUSE_WHEEL_Y, true) : 0;
  }

  // --- Keyboard Queries ---

  /**
   * Checks whether the specified virtual keycode is currently held down
   * @param {number} key Key code (e.g. 65 for KeyA, 32 for Space, 265 for ArrowUp)
   * @returns {boolean}
   */
  isKeyDown(key) {
    if (!this.sharedView || key < 0 || key >= 512) return false;
    const word = Math.floor(key / 32);
    const bit = key % 32;
    const val = this.sharedView.getUint32(OFF_KEYS_DOWN + word * 4, true);
    return ((val >>> bit) & 1) === 1;
  }

  /**
   * @returns {number[]} Array of all currently held down keycodes
   */
  getKeysDown() {
    if (!this.sharedView) return [];
    const keys = [];
    for (let word = 0; word < 16; word++) {
      const val = this.sharedView.getUint32(OFF_KEYS_DOWN + word * 4, true);
      if (val === 0) continue;
      for (let bit = 0; bit < 32; bit++) {
        if (((val >>> bit) & 1) === 1) {
          keys.push(word * 32 + bit);
        }
      }
    }
    return keys;
  }

  /**
   * @returns {number[]} Key codes pressed since last poll
   */
  getKeyPressedQueue() {
    if (!this.sharedView) return [];
    const count = Math.min(32, Math.max(0, this.sharedView.getInt32(OFF_KEY_PRESSED_COUNT, true)));
    const queue = [];
    for (let i = 0; i < count; i++) {
      queue.push(this.sharedView.getInt32(OFF_KEY_PRESSED_QUEUE + i * 4, true));
    }
    return queue;
  }

  /**
   * @returns {number[]} Unicode codepoints typed since last poll
   */
  getCharPressedQueue() {
    if (!this.sharedView) return [];
    const count = Math.min(32, Math.max(0, this.sharedView.getInt32(OFF_CHAR_PRESSED_COUNT, true)));
    const queue = [];
    for (let i = 0; i < count; i++) {
      queue.push(this.sharedView.getInt32(OFF_CHAR_PRESSED_QUEUE + i * 4, true));
    }
    return queue;
  }

  // --- Synchronization ---

  /**
   * Performs an Atomics.wait on the frame synchronization word
   * @param {number} [expectedSync=0]
   * @param {number} [timeoutMs=100]
   * @returns {'ok' | 'not-equal' | 'timed-out'}
   */
  waitFrame(expectedSync = 0, timeoutMs = 100) {
    if (!this.int32View || typeof Atomics === 'undefined' || typeof Atomics.wait !== 'function') {
      return 'timed-out';
    }
    try {
      return Atomics.wait(this.int32View, OFF_FRAME_SYNC / 4, expectedSync, timeoutMs);
    } catch (_) {
      return 'timed-out';
    }
  }
}
