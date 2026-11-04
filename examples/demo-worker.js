// canvas-window: Interactive Worker Demo
// Reads input synchronously from SharedArrayBuffer and renders 60 FPS graphics to ImageBitmap

import {
  OFF_MOUSE_X,
  OFF_MOUSE_Y,
  OFF_MOUSE_BUTTONS,
  OFF_KEYS_DOWN,
  OFF_FRAME_SYNC,
  OFF_SHOULD_CLOSE
} from '../src/protocol.js';

let sharedBuffer = null;
let sharedView = null;
let offscreen = null;
let ctx = null;
let width = 800;
let height = 450;
let isRunning = false;

// Controllable avatar position
let playerX = 400;
let playerY = 225;

// Particle bursts on click
const particles = [];
let prevButtons = 0;
let lastFpsTime = performance.now();
let frameCount = 0;

self.onmessage = (e) => {
  const { type } = e.data;
  if (type === 'start') {
    sharedBuffer = e.data.sharedBuffer || null;
    width = e.data.width || 800;
    height = e.data.height || 450;

    if (sharedBuffer) {
      sharedView = new DataView(sharedBuffer);
    }

    offscreen = new OffscreenCanvas(width, height);
    ctx = offscreen.getContext('2d');
    isRunning = true;
    requestAnimationFrame(renderLoop);
  } else if (type === 'stop') {
    isRunning = false;
  }
};

function renderLoop(time) {
  if (!isRunning || !ctx) return;

  // 1. Read input synchronously
  let mouseX = -1;
  let mouseY = -1;
  let mouseButtons = 0;
  let moveX = 0;
  let moveY = 0;

  if (sharedView) {
    mouseX = sharedView.getFloat32(OFF_MOUSE_X, true);
    mouseY = sharedView.getFloat32(OFF_MOUSE_Y, true);
    mouseButtons = sharedView.getUint32(OFF_MOUSE_BUTTONS, true);

    // Read keys (W: 87, A: 65, S: 83, D: 68, Arrows: 262..265)
    const isKeyDown = (key) => {
      const word = Math.floor(key / 32);
      const bit = key % 32;
      const val = sharedView.getUint32(OFF_KEYS_DOWN + word * 4, true);
      return ((val >>> bit) & 1) === 1;
    };

    if (isKeyDown(87) || isKeyDown(265)) moveY -= 4; // W or Up
    if (isKeyDown(83) || isKeyDown(264)) moveY += 4; // S or Down
    if (isKeyDown(65) || isKeyDown(263)) moveX -= 4; // A or Left
    if (isKeyDown(68) || isKeyDown(262)) moveX += 4; // D or Right
  }

  playerX = Math.max(30, Math.min(width - 30, playerX + moveX));
  playerY = Math.max(30, Math.min(height - 30, playerY + moveY));

  // Spawn particles on new click
  if (mouseButtons > 0 && prevButtons === 0 && mouseX >= 0 && mouseY >= 0) {
    for (let i = 0; i < 24; i++) {
      const angle = (Math.PI * 2 * i) / 24;
      const speed = 2 + Math.random() * 4;
      particles.push({
        x: mouseX,
        y: mouseY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1.0,
        color: `hsl(${Math.floor(Math.random() * 360)}, 100%, 65%)`
      });
    }
  }
  prevButtons = mouseButtons;

  // 2. Render graphics
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  // Background grid
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw animated central ring
  const pulse = Math.sin(time * 0.003) * 10;
  ctx.strokeStyle = 'rgba(14, 165, 233, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 70 + pulse, 0, Math.PI * 2);
  ctx.stroke();

  // Draw controllable player
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(playerX, playerY, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASD / Arrows', playerX, playerY + 36);

  // Draw mouse cursor position
  if (mouseX >= 0 && mouseY >= 0) {
    ctx.strokeStyle = (mouseButtons > 0) ? '#f43f5e' : '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 16, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = (mouseButtons > 0) ? '#f43f5e' : '#10b981';
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`(${Math.round(mouseX)}, ${Math.round(mouseY)}) [Buttons: ${mouseButtons}]`, mouseX + 18, mouseY - 10);
  }

  // Update and draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.02;
    if (p.alpha <= 0) {
      particles.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw instruction text
  ctx.fillStyle = '#64748b';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('• Move mouse to track pointer  • Click to spawn particle bursts  • WASD/Arrows to move avatar', 16, height - 16);

  // 3. Transfer frame
  try {
    const bitmap = offscreen.transferToImageBitmap();
    self.postMessage({ type: 'frame', bitmap }, [bitmap]);
  } catch (err) {
    console.warn('Frame transfer error:', err);
  }

  // 4. Measure FPS
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
    self.postMessage({ type: 'fps', fps });
    frameCount = 0;
    lastFpsTime = now;
  }

  requestAnimationFrame(renderLoop);
}
