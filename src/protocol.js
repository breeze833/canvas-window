// canvas-window: 512-byte SharedArrayBuffer Memory Protocol & Constants

export const INPUT_BUFFER_SIZE = 512;

// Byte Offsets in the 512-byte buffer
export const OFF_WINDOW_WIDTH = 0;       // int32: logical window width
export const OFF_WINDOW_HEIGHT = 4;      // int32: logical window height
export const OFF_RENDER_WIDTH = 8;       // int32: render buffer width
export const OFF_RENDER_HEIGHT = 12;     // int32: render buffer height
export const OFF_DPI_SCALE = 16;         // float32: device pixel ratio
export const OFF_SHOULD_CLOSE = 20;      // int32: 1 if close requested or ESC pressed

export const OFF_MOUSE_X = 24;           // float32: mouse X mapped to canvas coordinates
export const OFF_MOUSE_Y = 28;           // float32: mouse Y mapped to canvas coordinates
export const OFF_MOUSE_WHEEL_X = 32;     // float32: horizontal wheel delta
export const OFF_MOUSE_WHEEL_Y = 36;     // float32: vertical wheel delta
export const OFF_MOUSE_BUTTONS = 40;     // uint32: button bitmask (bit 0=left, 1=right, 2=middle)

export const OFF_KEYS_DOWN = 44;         // uint32[16]: 512-bit active key bitmask (44..107)
export const OFF_KEY_PRESSED_COUNT = 108;// int32: count of queued keypress codes (max 32)
export const OFF_KEY_PRESSED_QUEUE = 112;// int32[32]: queued key codes (112..239)

export const OFF_CHAR_PRESSED_COUNT = 240;// int32: count of queued unicode codepoints (max 32)
export const OFF_CHAR_PRESSED_QUEUE = 244;// int32[32]: queued unicode codepoints (244..371)

export const OFF_FRAME_SYNC = 372;       // int32: synchronization word for Atomics.wait() (372..375)
export const OFF_RESERVED = 376;         // uint8[136]: reserved for future expansion (376..511)

// Mouse Button Bitmasks
export const MOUSE_BUTTON_LEFT = 1;
export const MOUSE_BUTTON_RIGHT = 2;
export const MOUSE_BUTTON_MIDDLE = 4;

export const INPUT_LAYOUT_OFFSETS = {
  windowWidth: OFF_WINDOW_WIDTH,
  windowHeight: OFF_WINDOW_HEIGHT,
  renderWidth: OFF_RENDER_WIDTH,
  renderHeight: OFF_RENDER_HEIGHT,
  dpiScale: OFF_DPI_SCALE,
  shouldClose: OFF_SHOULD_CLOSE,
  mouseX: OFF_MOUSE_X,
  mouseY: OFF_MOUSE_Y,
  mouseWheelX: OFF_MOUSE_WHEEL_X,
  mouseWheelY: OFF_MOUSE_WHEEL_Y,
  mouseButtons: OFF_MOUSE_BUTTONS,
  keysDown: OFF_KEYS_DOWN,
  keyPressedCount: OFF_KEY_PRESSED_COUNT,
  keyPressedQueue: OFF_KEY_PRESSED_QUEUE,
  charPressedCount: OFF_CHAR_PRESSED_COUNT,
  charPressedQueue: OFF_CHAR_PRESSED_QUEUE,
  frameSync: OFF_FRAME_SYNC,
  reserved: OFF_RESERVED
};
