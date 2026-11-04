# AGENTS.md: Developer and AI Agent Guidelines for `canvas-window`

This document provides architectural context, design invariants, coding conventions, and maintenance procedures for AI agents and human contributors working on `canvas-window`.

---

## 1. Project Mission & Architecture

`canvas-window` is a zero-dependency canvas window and input coordination subsystem designed for WebAssembly runtimes, Web Workers, and browser-based sandboxes (including `canvas-wasi` and `canvas-js`).

### Multi-Tier Architecture

- **Main Browser Thread**:
  - `CanvasWindow` (`src/ui/canvas-window.js`): DOM lifecycle, dragging, minimization, pop-out external window (`window.open`), dock-back restoration, and frame presentation.
  - `InputCoordinator` (`src/input/input-coordinator.js`): Captures mouse, keyboard, wheel, and focus events, translates DOM coordinates to render buffer coordinates, and writes state to shared memory or event listeners.
- **Protocol Layer**:
  - `protocol.js` (`src/protocol.js`): Byte offsets, buffer size (`512` bytes), and button bitmasks for the SharedArrayBuffer memory layout.
- **Worker / Consumer Thread**:
  - Host bridge or consumer runtime reads mouse/keyboard state synchronously from `SharedArrayBuffer` using protocol constants, generates graphics, and transfers `ImageBitmap` frames to `CanvasWindow.renderFrame()`.

---

## 2. Core Design Invariants

When modifying or extending the codebase, strictly adhere to these fundamental invariants:

1. **Zero External Runtime Dependencies**:
   - Do not introduce runtime npm packages. All source code must be vanilla ES modules and standard browser APIs.
2. **512-Byte Input Protocol Invariance**:
   - The 512-byte `SharedArrayBuffer` memory layout is a binary contract shared across runtimes (`canvas-wasi`, `canvas-js`, etc.).
   - Field offsets `0..375` must not be shifted or modified without cross-repository coordination. Offsets `376..511` are reserved for backward-compatible additions.
3. **Thread Safety & Clean Detachment**:
   - When the user pops out the window into a separate browser window, `InputCoordinator` listeners and canvas contexts must dynamically re-bind between the in-page canvas and popup canvas, restoring cleanly when docked or closed.
4. **Canvas Focus Invariant**:
   - Clicking on the window frame, titlebar, or non-canvas area of `#graphics-window` must bring the active canvas into focus so keyboard navigation and hotkeys work immediately.
5. **Cross-Origin Isolation Fallbacks**:
   - While synchronous input uses `SharedArrayBuffer`, the library must function gracefully in non-isolated environments via `addListener` event routing and transferable `ArrayBuffer` rendering.

---

## 3. Developer Collaboration & Revision Workflow

All agent-assisted development in this repository must strictly adhere to the developer's 4-phase revision workflow:

```
┌──────────────────────────────────────────────────────────────┐
│  Phase 1: Specification Revision & Developer Confirmation     │
│  - Propose/update SPEC.md changes first                      │
│  - Await explicit developer review & approval                │
└──────────────────────────────┬───────────────────────────────┘
                               │ Approved
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 2: Specification-Compliant Implementation             │
│  - Strictly implement according to the confirmed SPEC.md     │
│  - Verify automated tests (npm test) with zero failures      │
└──────────────────────────────┬───────────────────────────────┘
                               │ Verified
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 3: Developer Manual Verification                      │
│  - Prompt developer to perform interactive verification      │
│  - Developer tests UI/input via npm run demo / examples      │
└──────────────────────────────┬───────────────────────────────┘
                               │ Developer Confirmed
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 4: Explicitly Instructed Document Alignment & Commit  │
│  - Await developer's explicit instruction                    │
│  - Align secondary docs (README.md, types, etc.)             │
│  - Stage and commit changes to git repository                │
└──────────────────────────────────────────────────────────────┘
```

### Detailed Workflow Protocol

1. **Specification First**:
   - For any architectural change, protocol modification, API addition, or bug fix, first formulate the design in `SPEC.md`.
   - The developer must review and explicitly confirm the specification change before any source code is modified.
2. **Strict Specification Compliance**:
   - During implementation, agents must strictly conform to the confirmed `SPEC.md`. No unauthorized deviations or undocumented side-effects are permitted.
3. **Developer Manual Verification**:
   - Following automated test validation (`npm test`), the agent must pause and request the developer to conduct manual verification using the local interactive environment (`npm run demo` -> `examples/index.html`).
   - The agent should provide clear, concise instructions on what interactive flows to test (e.g. window dragging, minimization icon toggling, pop-out detachment, SharedArrayBuffer input latency, and docking).
4. **Explicit Instruction for Document Alignment & Repo Commit**:
   - Agents must **not** unilaterally perform bulk document alignment or git commits without direct instruction.
   - The developer will explicitly instruct the agent when manual verification has succeeded and direct the document alignment (e.g., updating `README.md`, `types/index.d.ts`, etc.) and repository commit (`git add`, `git commit`).

---

## 4. Directory Structure & Key Files

```
canvas-window/
├── SPEC.md                    # Technical specification & memory layout
├── README.md                  # User-facing documentation & quick start
├── AGENTS.md                  # Developer & AI agent maintenance guidelines
├── LICENSE                    # MIT License
├── package.json               # Package metadata and subpath export definitions
├── src/
│   ├── index.js               # Main package export (CanvasWindow, InputCoordinator, protocol)
│   ├── protocol.js            # 512-byte SharedArrayBuffer layout constants & masks
│   ├── input/
│   │   └── input-coordinator.js# DOM event handling & SharedArrayBuffer synchronization
│   └── ui/
│       ├── canvas-window.js   # Floating draggable & pop-out window controller
│       └── style.css          # CSS styles for floating window
├── types/
│   └── index.d.ts             # TypeScript definitions for all exports
├── examples/
│   ├── index.html             # Interactive browser demo for manual testing
│   ├── demo-worker.js         # Off-thread animation worker reading SharedArrayBuffer
│   └── serve.js               # Zero-dependency local dev server with COOP/COEP
└── test/
    └── canvas-window.test.js  # Standalone unit test suite
```

---

## 5. Development & Testing Commands

All commands are zero-dependency standard Node.js:

```bash
# Run unit test suite
npm test
# (Equivalent to: node test/canvas-window.test.js)

# Start local interactive demo server (http://localhost:3001)
npm run demo
# or: npm start

# Validate npm package contents
npm pack --dry-run
```

---

## 6. Agent Modification Procedures

### 6.1 Modifying or Extending the Input Memory Protocol

1. **Verify Layout in `SPEC.md`**:
   - Offsets `0..375` are active fields. Any additions must use the reserved range `376..511`.
   - Developer confirms the revised `SPEC.md` before coding.
2. **Update Protocol Constants**:
   - Add new offset constants to `src/protocol.js` and export them in `INPUT_LAYOUT_OFFSETS`.
3. **Update Coordinator**:
   - Update `updateSharedState()`, `pollToBuffer()`, and `reset()` in `src/input/input-coordinator.js`.
4. **Update TypeScript Definitions**:
   - Add new exported constants and types to `types/index.d.ts`.
5. **Update Test Suite**:
   - Add verification checks in `test/canvas-window.test.js`.
6. **Verify & Await Instructions**:
   - Run `npm test` and invite developer for manual verification. Await explicit instruction before commit.

### 6.2 Modifying Window UI or Styles

1. **Specification Confirmation**:
   - Document UI behavior changes in `SPEC.md` and confirm with the developer.
2. **DOM Container**:
   - Structure is created in `CanvasWindow.prototype.initDOM()`.
   - Maintain standard element IDs (`#graphics-window`, `#graphics-canvas`, `#btn-graphics-popout`, `#btn-graphics-min`, `#btn-graphics-close`).
3. **Styles**:
   - Update `src/ui/style.css`.
   - Maintain both `--canvas-window-*` and `--canvas-wasi-*` CSS variables for backward compatibility.
4. **Popup Window**:
   - Managed in `popOut()` and `dockBack()`.
   - Remember to rebind `inputCoordinator.attachListeners()` when switching between in-page canvas and popup window.

---

## 7. Pre-Commit / Pre-Completion Checklist

Before completing tasks or submitting PRs, verify:

- [ ] Specification updated in `SPEC.md` and confirmed by the developer prior to code changes.
- [ ] Implementation strictly conforms to the confirmed `SPEC.md`.
- [ ] `node test/canvas-window.test.js` passes with zero errors.
- [ ] Developer has conducted manual verification via `npm run demo` or target application.
- [ ] Document alignment (`README.md`, `types/index.d.ts`, etc.) performed upon explicit developer instruction.
- [ ] Git commit performed only when explicitly instructed by the developer.
- [ ] No new npm runtime dependencies introduced.
- [ ] `canvas-wasi` was NOT modified without explicit user authorization.

