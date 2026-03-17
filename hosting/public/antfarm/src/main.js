/**
 * main.js — Entry point + game loop
 *
 * Responsibilities:
 *   1. Obtain the canvas and 2D context
 *   2. Create simulation state
 *   3. Initialise renderer and controls
 *   4. Run the requestAnimationFrame loop:
 *        - compute deltaTime (capped to prevent spiral-of-death)
 *        - call updateSimulation(state, dt)
 *        - call render(ctx, state, fps)
 *        - update stats display
 */

import { createSimulation, updateSimulation } from './simulation.js';
import { render, initRenderer }               from './renderer.js';
import { initControls }                       from './controls.js';

// ── Boot ─────────────────────────────────────────────────────────────────────

const canvas = /** @type {HTMLCanvasElement} */ (
  document.getElementById('simulation-canvas')
);
const ctx = canvas.getContext('2d', { alpha: false });

// Size canvas to fill its CSS area before creating simulation
canvas.width  = canvas.clientWidth  || window.innerWidth - (window.innerWidth > 768 ? 260 : 0);
canvas.height = canvas.clientHeight || window.innerHeight;

// Build simulation with initial canvas dimensions
const simState = createSimulation(canvas.width, canvas.height);

// Initialise renderer off-screen buffer
initRenderer(canvas.width, canvas.height);

// Wire controls — returns a stats updater
const { updateStats } = initControls(simState, canvas, ctx);

// ── FPS tracking ─────────────────────────────────────────────────────────────

const FPS_SAMPLE_COUNT = 30; // rolling average over N frames
const fpsSamples = new Float32Array(FPS_SAMPLE_COUNT);
let   fpsSampleIndex = 0;
let   fpsAverage     = 60;

function recordFrame(frameDuration) {
  fpsSamples[fpsSampleIndex] = frameDuration;
  fpsSampleIndex = (fpsSampleIndex + 1) % FPS_SAMPLE_COUNT;

  let total = 0;
  for (let i = 0; i < FPS_SAMPLE_COUNT; i++) {
    total += fpsSamples[i];
  }
  const avgDuration = total / FPS_SAMPLE_COUNT;
  fpsAverage = avgDuration > 0 ? 1000 / avgDuration : 60;
}

// ── Loop ─────────────────────────────────────────────────────────────────────

// Maximum delta capped at 100 ms to prevent physics explosions after tab switch
const MAX_DELTA_MS = 100;

let lastTimestamp = 0;

function loop(timestamp) {
  const rawDeltaMs = lastTimestamp === 0 ? 16.67 : timestamp - lastTimestamp;
  const deltaMs    = Math.min(rawDeltaMs, MAX_DELTA_MS);
  const deltaTime  = deltaMs / 1000; // seconds

  lastTimestamp = timestamp;

  recordFrame(rawDeltaMs);

  updateSimulation(simState, deltaTime);
  render(ctx, simState, fpsAverage);
  updateStats(fpsAverage);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
