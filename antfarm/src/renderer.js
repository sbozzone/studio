/**
 * renderer.js — Canvas rendering
 *
 * Renders background, pheromone overlay, food sources, colony, and ants.
 * Keeps rendering separate from simulation logic.
 *
 * Pheromone layer uses an ImageData buffer (typed array) for direct
 * pixel writes — much faster than drawing thousands of filled rects.
 *
 * Ants are drawn as two rotated ellipses (head + abdomen).
 */

import { CELL_SIZE, MAX_VALUE } from './pheromones.js';
import { FOOD_RADIUS }          from './food.js';
import { COLONY_RADIUS }        from './colony.js';
import { STATE_RETURNING }      from './ants.js';

// ── Colour constants (RGB components for fast ImageData writes) ──────────────

// Background: warm sandy dirt
const BG_R = 186, BG_G = 156, BG_B = 110;

// Food pheromone: muted green
const FOOD_PHERO_R = 80,  FOOD_PHERO_G = 170, FOOD_PHERO_B = 60;
// Home pheromone: warm amber
const HOME_PHERO_R = 210, HOME_PHERO_G = 140, HOME_PHERO_B = 40;

// Max alpha for pheromone overlay (0–255)
const PHERO_MAX_ALPHA = 170;

// Ant colours
const ANT_BODY_COLOR = '#2a1a08';
const ANT_HEAD_COLOR = '#1a0e04';
const ANT_CARRYING_COLOR = '#4a8a20'; // green tint when carrying food

// Colony colours
const COLONY_OUTER_COLOR = '#7a4a1a';
const COLONY_INNER_COLOR = '#3d1f08';

// Food source colours
const FOOD_OUTER_COLOR = '#5a9a28';
const FOOD_INNER_COLOR = '#8fcd44';

// ── ImageData buffer ─────────────────────────────────────────────────────────

let pheromoneImageData = null;
let pheromoneCanvas    = null;
let pheromoneCtx       = null;

/**
 * Initialise or resize the off-screen pheromone canvas.
 * @param {number} width
 * @param {number} height
 */
export function initRenderer(width, height) {
  pheromoneCanvas        = document.createElement('canvas');
  pheromoneCanvas.width  = width;
  pheromoneCanvas.height = height;
  pheromoneCtx           = pheromoneCanvas.getContext('2d');
  pheromoneImageData     = pheromoneCtx.createImageData(width, height);
}

// ── Main render entry point ──────────────────────────────────────────────────

/**
 * Render one frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {SimulationState}         state
 * @param {number}                  fps
 */
export function render(ctx, state, fps) {
  const { canvasWidth: W, canvasHeight: H } = state;

  // 1. Background
  drawBackground(ctx, W, H);

  // 2. Pheromone overlay (written to ImageData, then composited)
  if (state.config.showPheromones) {
    drawPheromones(ctx, state.pheromones, W, H);
  }

  // 3. Food sources
  for (let i = 0; i < state.foodSources.length; i++) {
    drawFood(ctx, state.foodSources[i]);
  }

  // 4. Colony
  drawColony(ctx, state.colony);

  // 5. Ants
  for (let i = 0; i < state.ants.length; i++) {
    drawAnt(ctx, state.ants[i]);
  }

  // 6. HUD
  if (state.config.showAntCount) {
    drawHUD(ctx, state, fps, W, H);
  }
}

// ── Background ───────────────────────────────────────────────────────────────

function drawBackground(ctx, W, H) {
  ctx.fillStyle = `rgb(${BG_R},${BG_G},${BG_B})`;
  ctx.fillRect(0, 0, W, H);
}

// ── Pheromones ───────────────────────────────────────────────────────────────

/**
 * Write pheromone cell values directly into an ImageData pixel buffer,
 * then draw the whole buffer in one blit. This avoids thousands of fillRect
 * calls per frame.
 */
function drawPheromones(ctx, pheromones, W, H) {
  if (!pheromoneImageData) return;

  const data  = pheromoneImageData.data;
  const food  = pheromones.food;
  const home  = pheromones.home;
  const cols  = pheromones.cols;
  const rows  = pheromones.rows;
  const cellW = CELL_SIZE;
  const cellH = CELL_SIZE;

  // Clear to transparent
  data.fill(0);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const gridIdx = row * cols + col;
      const fv = food[gridIdx];
      const hv = home[gridIdx];
      if (fv < 0.01 && hv < 0.01) continue;

      // Normalise to [0,1]
      const fn = Math.min(fv / MAX_VALUE, 1);
      const hn = Math.min(hv / MAX_VALUE, 1);

      // Blend the two channels: each contributes to R/G/B independently
      const alpha = Math.min(fn + hn, 1) * PHERO_MAX_ALPHA | 0;
      const r     = (FOOD_PHERO_R * fn + HOME_PHERO_R * hn) / Math.max(fn + hn, 0.001) | 0;
      const g     = (FOOD_PHERO_G * fn + HOME_PHERO_G * hn) / Math.max(fn + hn, 0.001) | 0;
      const b     = (FOOD_PHERO_B * fn + HOME_PHERO_B * hn) / Math.max(fn + hn, 0.001) | 0;

      // Fill the cell rectangle in the ImageData buffer
      const startX = col * cellW;
      const startY = row * cellH;
      const endX   = Math.min(startX + cellW, W);
      const endY   = Math.min(startY + cellH, H);

      for (let py = startY; py < endY; py++) {
        let pixIdx = (py * W + startX) * 4;
        for (let px = startX; px < endX; px++) {
          data[pixIdx    ] = r;
          data[pixIdx + 1] = g;
          data[pixIdx + 2] = b;
          data[pixIdx + 3] = alpha;
          pixIdx += 4;
        }
      }
    }
  }

  pheromoneCtx.putImageData(pheromoneImageData, 0, 0);
  ctx.drawImage(pheromoneCanvas, 0, 0);
}

// ── Food ─────────────────────────────────────────────────────────────────────

function drawFood(ctx, source) {
  const fullness = Math.min(source.quantity / 60, 1);
  const radius   = FOOD_RADIUS * (0.5 + 0.5 * fullness);

  // Glowing outer ring
  ctx.beginPath();
  ctx.arc(source.x, source.y, radius + 3, 0, Math.PI * 2);
  ctx.fillStyle = FOOD_OUTER_COLOR;
  ctx.fill();

  // Inner bright cluster
  ctx.beginPath();
  ctx.arc(source.x, source.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = FOOD_INNER_COLOR;
  ctx.fill();

  // Small quantity indicator dots (up to 5)
  const dots = Math.ceil(fullness * 5);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < dots; i++) {
    const dotAngle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const dx = Math.cos(dotAngle) * radius * 0.5;
    const dy = Math.sin(dotAngle) * radius * 0.5;
    ctx.beginPath();
    ctx.arc(source.x + dx, source.y + dy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Colony ───────────────────────────────────────────────────────────────────

function drawColony(ctx, colony) {
  // Outer ring
  ctx.beginPath();
  ctx.arc(colony.x, colony.y, COLONY_RADIUS + 4, 0, Math.PI * 2);
  ctx.fillStyle = COLONY_OUTER_COLOR;
  ctx.fill();

  // Main mound
  ctx.beginPath();
  ctx.arc(colony.x, colony.y, COLONY_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = COLONY_INNER_COLOR;
  ctx.fill();

  // Entrance hole
  ctx.beginPath();
  ctx.arc(colony.x, colony.y, COLONY_RADIUS * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0503';
  ctx.fill();
}

// ── Ants ─────────────────────────────────────────────────────────────────────

/**
 * Draw a single ant as two rotated ellipses (head and abdomen).
 * The ant is aligned to its heading angle.
 */
function drawAnt(ctx, ant) {
  ctx.save();
  ctx.translate(ant.x, ant.y);
  ctx.rotate(ant.heading);

  const isCarrying = ant.state === STATE_RETURNING;

  // Abdomen (rear, larger ellipse)
  ctx.beginPath();
  ctx.ellipse(-3, 0, 3.5, 2.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = isCarrying ? ANT_CARRYING_COLOR : ANT_BODY_COLOR;
  ctx.fill();

  // Thorax (middle, thin)
  ctx.beginPath();
  ctx.ellipse(0.5, 0, 1.5, 1.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = ANT_BODY_COLOR;
  ctx.fill();

  // Head (front, round)
  ctx.beginPath();
  ctx.ellipse(3.5, 0, 2, 1.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = ANT_HEAD_COLOR;
  ctx.fill();

  // Antennae
  ctx.strokeStyle = ANT_HEAD_COLOR;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(4.5, -0.5);
  ctx.lineTo(7,    -2.5);
  ctx.moveTo(4.5,  0.5);
  ctx.lineTo(7,     2.5);
  ctx.stroke();

  // Food pellet indicator
  if (isCarrying) {
    ctx.beginPath();
    ctx.arc(1, 0, 2, 0, Math.PI * 2);
    ctx.fillStyle = FOOD_INNER_COLOR;
    ctx.fill();
  }

  ctx.restore();
}

// ── HUD ───────────────────────────────────────────────────────────────────────

function drawHUD(ctx, state, fps, W, H) {
  const text = `${state.ants.length} ants`;
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillText(text, 11, 21);
  ctx.fillStyle = 'rgba(232,216,184,0.85)';
  ctx.fillText(text, 10, 20);
}
