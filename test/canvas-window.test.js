// test/canvas-window.test.js
// Standalone unit tests for canvas-window

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CanvasWindow,
  GraphicsWindowUI,
  InputCoordinator,
  InputReader,
  DOM_KEY_MAP,
  INPUT_BUFFER_SIZE,
  INPUT_LAYOUT_OFFSETS,
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
  OFF_RESERVED,
  MOUSE_BUTTON_LEFT,
  MOUSE_BUTTON_RIGHT,
  MOUSE_BUTTON_MIDDLE
} from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('--- Running canvas-window Test Suite ---');

// Test 1: Verify Protocol Constants & Offsets
assert.strictEqual(INPUT_BUFFER_SIZE, 512, 'Buffer size must be 512 bytes');
assert.strictEqual(OFF_WINDOW_WIDTH, 0);
assert.strictEqual(OFF_WINDOW_HEIGHT, 4);
assert.strictEqual(OFF_RENDER_WIDTH, 8);
assert.strictEqual(OFF_RENDER_HEIGHT, 12);
assert.strictEqual(OFF_DPI_SCALE, 16);
assert.strictEqual(OFF_SHOULD_CLOSE, 20);
assert.strictEqual(OFF_MOUSE_X, 24);
assert.strictEqual(OFF_MOUSE_Y, 28);
assert.strictEqual(OFF_MOUSE_WHEEL_X, 32);
assert.strictEqual(OFF_MOUSE_WHEEL_Y, 36);
assert.strictEqual(OFF_MOUSE_BUTTONS, 40);
assert.strictEqual(OFF_KEYS_DOWN, 44);
assert.strictEqual(OFF_KEY_PRESSED_COUNT, 108);
assert.strictEqual(OFF_KEY_PRESSED_QUEUE, 112);
assert.strictEqual(OFF_CHAR_PRESSED_COUNT, 240);
assert.strictEqual(OFF_CHAR_PRESSED_QUEUE, 244);
assert.strictEqual(OFF_FRAME_SYNC, 372);
assert.strictEqual(OFF_RESERVED, 376);

assert.strictEqual(MOUSE_BUTTON_LEFT, 1);
assert.strictEqual(MOUSE_BUTTON_RIGHT, 2);
assert.strictEqual(MOUSE_BUTTON_MIDDLE, 4);

assert.strictEqual(INPUT_LAYOUT_OFFSETS.mouseX, 24);
assert.strictEqual(INPUT_LAYOUT_OFFSETS.frameSync, 372);

console.log('✓ Protocol constants and memory map offsets verified');

// Test 2: Verify Package Exports & Aliases
assert.strictEqual(typeof CanvasWindow, 'function', 'CanvasWindow must be exported as class');
assert.strictEqual(GraphicsWindowUI, CanvasWindow, 'GraphicsWindowUI must be alias of CanvasWindow');
assert.strictEqual(typeof InputCoordinator, 'function', 'InputCoordinator must be exported as class');
assert.strictEqual(typeof DOM_KEY_MAP, 'object', 'DOM_KEY_MAP must be exported');
assert.strictEqual(DOM_KEY_MAP.Space, 32);
assert.strictEqual(DOM_KEY_MAP.Escape, 256);
assert.strictEqual(DOM_KEY_MAP.KeyA, 65);
assert.strictEqual(DOM_KEY_MAP.ArrowUp, 265);

console.log('✓ Package exports and backward compatibility aliases verified');

// Test 3: InputCoordinator & SharedArrayBuffer Synchronization
const sharedBuf = new SharedArrayBuffer(512);
const coord = new InputCoordinator({
  sharedBuffer: sharedBuf,
  width: 800,
  height: 450
});

const listeners = new Map();
const mockCanvas = {
  width: 800,
  height: 450,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 450 }),
  addEventListener: (name, fn) => listeners.set(name, fn),
  removeEventListener: (name) => listeners.delete(name)
};

coord.attachListeners(mockCanvas);

// Simulate mouse movement
const moveFn = listeners.get('mousemove');
assert.strictEqual(typeof moveFn, 'function', 'mousemove listener must be registered');
moveFn({ clientX: 250, clientY: 150, buttons: 1 });

const sView = new DataView(sharedBuf);
assert.strictEqual(Math.round(sView.getFloat32(OFF_MOUSE_X, true)), 250, 'Shared buffer mouseX must be 250');
assert.strictEqual(Math.round(sView.getFloat32(OFF_MOUSE_Y, true)), 150, 'Shared buffer mouseY must be 150');
assert.strictEqual(sView.getUint32(OFF_MOUSE_BUTTONS, true), 1, 'Shared buffer mouseButtons must be 1');

// Simulate keydown (Space = 32)
const keydownFn = listeners.get('keydown');
assert.strictEqual(typeof keydownFn, 'function', 'keydown listener must be registered');
keydownFn({ code: 'Space', keyCode: 32, preventDefault() {} });

const keyWord1 = sView.getUint32(OFF_KEYS_DOWN + 4, true);
assert.strictEqual((keyWord1 & 1), 1, 'Key 32 (Space) must be set in keymask word 1');

// Simulate wheel event
const wheelFn = listeners.get('wheel');
assert.strictEqual(typeof wheelFn, 'function', 'wheel listener must be registered');
wheelFn({ deltaX: 0, deltaY: 10, preventDefault() {} });
assert.strictEqual(sView.getFloat32(OFF_MOUSE_WHEEL_Y, true), -1, 'wheel Y must register delta');

console.log('✓ InputCoordinator and SharedArrayBuffer synchronization verified');

// Test 4: pollToBuffer and pollToWasm
const destBuf = new ArrayBuffer(512);
coord.pollToBuffer(0, destBuf);

const destView = new DataView(destBuf);
assert.strictEqual(destView.getInt32(OFF_WINDOW_WIDTH, true), 800);
assert.strictEqual(destView.getInt32(OFF_WINDOW_HEIGHT, true), 450);
assert.strictEqual(Math.round(destView.getFloat32(OFF_MOUSE_X, true)), 250);
assert.strictEqual(Math.round(destView.getFloat32(OFF_MOUSE_Y, true)), 150);

// Test pollToWasm alias
const wasmMemMock = { buffer: new ArrayBuffer(512) };
coord.pollToWasm(0, wasmMemMock);
const wasmView = new DataView(wasmMemMock.buffer);
assert.strictEqual(wasmView.getInt32(OFF_WINDOW_WIDTH, true), 800);

console.log('✓ pollToBuffer and pollToWasm serialization verified');

// Test 5: InputReader Verification
const reader = new InputReader(sharedBuf);
assert.strictEqual(reader.hasBuffer(), true, 'InputReader should report hasBuffer() === true');

const mouseSnapshot = reader.getMouse();
assert.strictEqual(Math.round(mouseSnapshot.x), 250, 'reader.getMouse().x should match');
assert.strictEqual(Math.round(mouseSnapshot.y), 150, 'reader.getMouse().y should match');
assert.strictEqual(mouseSnapshot.buttons, 1, 'reader.getMouse().buttons should match');
assert.strictEqual(mouseSnapshot.wheelY, 0, 'reader.getMouse().wheelY should be 0 after pollToBuffer flush');

// Trigger new wheel event and verify reader picks it up
wheelFn({ deltaX: 0, deltaY: 10, preventDefault() {} });
assert.strictEqual(reader.getMouseWheelY(), -1, 'reader.getMouseWheelY() should be -1 after new wheel event');

assert.strictEqual(reader.isMouseButtonDown(MOUSE_BUTTON_LEFT), true, 'Left button should be down via mask');
assert.strictEqual(reader.isMouseButtonDown(0), true, 'Left button should be down via DOM index 0');
assert.strictEqual(reader.isMouseButtonDown(MOUSE_BUTTON_RIGHT), false, 'Right button should not be down');

assert.strictEqual(reader.isKeyDown(32), true, 'Key 32 (Space) should be down');
assert.strictEqual(reader.isKeyDown(65), false, 'Key 65 (KeyA) should not be down');
const keysDown = reader.getKeysDown();
assert.strictEqual(keysDown.includes(32), true, 'getKeysDown() should include 32');

const dims = reader.getDimensions();
assert.strictEqual(dims.windowWidth, 800);
assert.strictEqual(dims.windowHeight, 450);
assert.strictEqual(dims.renderWidth, 800);
assert.strictEqual(dims.renderHeight, 450);
assert.strictEqual(dims.dpiScale, 1.0);
assert.strictEqual(reader.shouldClose(), false, 'shouldClose should be false');

// Verify close flag propagation
coord.shouldClose = true;
coord.updateSharedState();
assert.strictEqual(reader.shouldClose(), true, 'shouldClose should be true when close is set');

// Verify worker entry point export
const workerMod = await import('../src/worker.js');
assert.strictEqual(typeof workerMod.InputReader, 'function', 'worker.js should export InputReader');
assert.strictEqual(typeof workerMod.DOM_KEY_MAP, 'object', 'worker.js should export DOM_KEY_MAP');
assert.strictEqual(workerMod.INPUT_BUFFER_SIZE, 512, 'worker.js should export protocol constants');

console.log('✓ InputReader and worker entrypoint verified');

// Test 6: CanvasWindow DOM Lifecycle Mock
let appendChildCalled = false;
let canvasFocused = false;

const mockDocument = {
  getElementById: (id) => null,
  createElement: (tag) => {
    return {
      id: '',
      className: '',
      style: {},
      innerHTML: '',
      querySelector: (selector) => {
        if (selector === '#graphics-canvas') {
          return {
            getContext: () => ({ transferFromImageBitmap() {} }),
            focus: () => { canvasFocused = true; },
            addEventListener: () => {},
            removeEventListener: () => {},
            style: {},
            width: 800,
            height: 450
          };
        }
        return {
          textContent: '',
          addEventListener: () => {},
          removeEventListener: () => {},
          setAttribute: () => {},
          style: {}
        };
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      classList: { add() {}, remove() {} }
    };
  },
  body: {
    appendChild: (el) => { appendChildCalled = true; }
  }
};

globalThis.document = mockDocument;
globalThis.window = {
  innerWidth: 1920,
  innerHeight: 1080,
  addEventListener: () => {},
  removeEventListener: () => {}
};

const win = new CanvasWindow({
  width: 800,
  height: 450,
  title: 'Test Window'
});

assert.strictEqual(appendChildCalled, true, 'CanvasWindow must inject container element into document.body');
win.open(800, 450, 'Opened Test Window');
assert.strictEqual(win.isOpen(), true, 'Window should report isOpen() === true');
assert.strictEqual(win.isCanvasVisible(), true, 'Canvas should report isCanvasVisible() === true');

win.toggleMinimize();
assert.strictEqual(win.isMinimized, true, 'Window should be minimized');
assert.strictEqual(win.isCanvasVisible(), false, 'Canvas should report isCanvasVisible() === false when minimized');

win.toggleMinimize();
assert.strictEqual(win.isMinimized, false, 'Window should be restored from minimization');
assert.strictEqual(win.isCanvasVisible(), true, 'Canvas should report isCanvasVisible() === true after restore');

win.updateFps(60);
win.close();
assert.strictEqual(win.isOpen(), false, 'Window should report isOpen() === false after close()');

console.log('✓ CanvasWindow DOM lifecycle, minimize, and focus verified');

// Test 7: Verify TypeScript Declarations
const dtsContent = fs.readFileSync(path.join(__dirname, '../types/index.d.ts'), 'utf8');
assert.strictEqual(dtsContent.includes('export class CanvasWindow'), true);
assert.strictEqual(dtsContent.includes('export const GraphicsWindowUI'), true);
assert.strictEqual(dtsContent.includes('export class InputCoordinator'), true);
assert.strictEqual(dtsContent.includes('export class InputReader'), true);
assert.strictEqual(dtsContent.includes('export const INPUT_BUFFER_SIZE: 512'), true);
assert.strictEqual(dtsContent.includes('pollToBuffer'), true);
assert.strictEqual(dtsContent.includes('pollToWasm'), true);

console.log('✓ TypeScript declarations verified');
console.log('--- All canvas-window tests passed successfully! ---');
