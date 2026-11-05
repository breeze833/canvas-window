// Type definitions for canvas-window

export interface CanvasWindowOptions {
  width?: number;
  height?: number;
  title?: string;
  onCloseRequested?: () => void;
  onFocusChange?: (focused: boolean) => void;
  onFrameActivity?: (active: boolean) => void;
  sharedBuffer?: SharedArrayBuffer | null;
  inputCoordinator?: InputCoordinator | null;
}

export type GraphicsWindowUIOptions = CanvasWindowOptions;

export class CanvasWindow {
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

export const GraphicsWindowUI: typeof CanvasWindow;

export interface InputCoordinatorOptions {
  sharedBuffer?: SharedArrayBuffer | null;
  canvas?: HTMLCanvasElement | null;
  width?: number;
  height?: number;
  dpiScale?: number;
}

export class InputCoordinator {
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
  keysDown: Uint32Array;
  attachListeners(canvas: HTMLCanvasElement, windowTarget?: Window | null): void;
  detach(): void;
  reset(): void;
  updateSharedState(): void;
  pollToBuffer(destPtr: number, target: ArrayBuffer | { buffer: ArrayBuffer }): void;
  pollToWasm(destPtr: number, mem: { buffer: ArrayBuffer }): void;
  addListener(fn: (event: any) => void): () => void;
}

export interface InputReaderOptions {
  sharedBuffer?: SharedArrayBuffer | ArrayBuffer | null;
  buffer?: SharedArrayBuffer | ArrayBuffer | null;
}

export interface MouseState {
  x: number;
  y: number;
  buttons: number;
  wheelX: number;
  wheelY: number;
}

export interface WindowDimensions {
  windowWidth: number;
  windowHeight: number;
  renderWidth: number;
  renderHeight: number;
  dpiScale: number;
}

export class InputReader {
  constructor(bufferOrOptions?: SharedArrayBuffer | ArrayBuffer | InputReaderOptions | null);
  buffer: SharedArrayBuffer | ArrayBuffer | null;
  setBuffer(buffer: SharedArrayBuffer | ArrayBuffer | null): void;
  hasBuffer(): boolean;
  shouldClose(): boolean;
  getDimensions(): WindowDimensions;
  getWindowWidth(): number;
  getWindowHeight(): number;
  getRenderWidth(): number;
  getRenderHeight(): number;
  getDpiScale(): number;
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
  isKeyDown(key: number): boolean;
  getKeysDown(): number[];
  getKeyPressedQueue(): number[];
  getCharPressedQueue(): number[];
  waitFrame(expectedSync?: number, timeoutMs?: number): 'ok' | 'not-equal' | 'timed-out';
}

export const DOM_KEY_MAP: Record<string, number>;

// Protocol Constants
export const INPUT_BUFFER_SIZE: 512;
export const OFF_WINDOW_WIDTH: number;
export const OFF_WINDOW_HEIGHT: number;
export const OFF_RENDER_WIDTH: number;
export const OFF_RENDER_HEIGHT: number;
export const OFF_DPI_SCALE: number;
export const OFF_SHOULD_CLOSE: number;
export const OFF_MOUSE_X: number;
export const OFF_MOUSE_Y: number;
export const OFF_MOUSE_WHEEL_X: number;
export const OFF_MOUSE_WHEEL_Y: number;
export const OFF_MOUSE_BUTTONS: number;
export const OFF_KEYS_DOWN: number;
export const OFF_KEY_PRESSED_COUNT: number;
export const OFF_KEY_PRESSED_QUEUE: number;
export const OFF_CHAR_PRESSED_COUNT: number;
export const OFF_CHAR_PRESSED_QUEUE: number;
export const OFF_FRAME_SYNC: number;
export const OFF_RESERVED: number;

export const MOUSE_BUTTON_LEFT: 1;
export const MOUSE_BUTTON_RIGHT: 2;
export const MOUSE_BUTTON_MIDDLE: 4;

export const INPUT_LAYOUT_OFFSETS: Record<string, number>;
