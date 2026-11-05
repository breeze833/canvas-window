// canvas-window: Lightweight Web Worker Entrypoint
// Zero DOM dependencies - exports InputReader, DOM_KEY_MAP, and protocol constants

export { InputReader } from './input/input-reader.js';
export { DOM_KEY_MAP } from './input/input-coordinator.js';
export * from './protocol.js';
