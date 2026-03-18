/**
 * renderer.js — 3-D Ant Farm Canvas rendering
 *
 * Visual features:
 *   - Voronoi-cracked soil texture (pre-rendered once at init)
 *   - Persistent tunnel excavation grid (grows as ants walk)
 *   - 3-D-style ant, colony, and food rendering with shadows/gradients
 *   - Subtle glass-reflection overlay
 *
 * Performance notes:
 *   - Soil pattern written once to an offscreen canvas (blit each frame)
 *   - Tunnel grid updated O(antCount) per frame; drawn with globalAlpha arcs
 *   - Pheromone overlay still uses the fast ImageData typed-array blit
 */

import { CELL_SIZE, MAX_VALUE } from './pheromones.js';
import { FOOD_RADIUS }          from './food.js';
import { COLONY_RADIUS }        from './colony.js';
import { STATE_RETURNING }      from './ants.js';

// ── Voronoi soil config ───────────────────────────────────────────────────────

const SEED_COUNT  = 24;   // number of Voronoi region seeds
const SOIL_STRIDE = 3;    // sample every N pixels for speed (3× vs full-res)
const CRACK_DIST  = 4.2;  // px — boundary zone → dark crack

let soilCanvas = null;
let soilCtx    = null;

// ── Tunnel excavation ─────────────────────────────────────────────────────────

const TUNNEL_CELL = 10; // pixels per tunnel-grid cell
let tunnelGrid = null;
let tunnelCols = 0;
let tunnelRows = 0;

// ── Pheromone offscreen buffer (fast ImageData blit) ─────────────────────────

let pheromoneImageData = null;
let pheromoneCanvas    = null;
let pheromoneCtx       = null;

// Pheromone palette
const PHERO_MAX_ALPHA = 115;
const FOOD_PHERO_R = 80,  FOOD_PHERO_G = 170, FOOD_PHERO_B = 60;
const HOME_PHERO_R = 210, HOME_PHERO_G = 140, HOME_PHERO_B = 40;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialise (or reinitialise after resize) all offscreen buffers.
 * Called once at startup and again whenever the canvas is resized.
 */
export function initRenderer(width, height) {
  // ── Pheromone buffer
  pheromoneCanvas        = document.createElement('canvas');
  pheromoneCanvas.width  = width;
  pheromoneCanvas.height = height;
  pheromoneCtx           = pheromoneCanvas.getContext('2d');
  pheromoneImageData     = pheromoneCtx.createImageData(width, height);

  // ── Voronoi soil (pre-rendered static background)
  soilCanvas        = document.createElement('canvas');
  soilCanvas.width  = width;
  soilCanvas.height = height;
  soilCtx           = soilCanvas.getContext('2d', { alpha: false });
  generateSoilPattern(width, height);

  // ── Tunnel grid
  tunnelCols = Math.ceil(width  / TUNNEL_CELL);
  tunnelRows = Math.ceil(height / TUNNEL_CELL);
  tunnelGrid = new Float32Array(tunnelCols * tunnelRows);
}

/**
 * Clear all tunnel excavations (call on simulation reset).
 */
export function resetTunnels() {
  if (tunnelGrid) tunnelGrid.fill(0);
}

// ── Voronoi soil generation ───────────────────────────────────────────────────

function generateSoilPattern(W, H) {
  // Random Voronoi seed points with slightly varied sandy colours
  const seeds = [];
  for (let i = 0; i < SEED_COUNT; i++) {
    seeds.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: (168 + Math.random() * 48) | 0,   // warm sandy red
      g: (138 + Math.random() * 40) | 0,   // sandy green
      b:  (88 + Math.random() * 34) | 0,   // sandy blue
    });
  }

  // Compute Voronoi at SOIL_STRIDE resolution, write into ImageData block-fill
  const imgData = soilCtx.createImageData(W, H);
  const d       = imgData.data;

  for (let y = 0; y < H; y += SOIL_STRIDE) {
    // Subtle depth darkening: deeper underground = slightly darker
    const depthShade = 0.80 + 0.20 * (1.0 - y / H);

    for (let x = 0; x < W; x += SOIL_STRIDE) {
      // Find nearest and 2nd-nearest Voronoi seeds
      let d1 = Infinity, d2 = Infinity, nearest = 0;
      for (let k = 0; k < SEED_COUNT; k++) {
        const dx = x - seeds[k].x;
        const dy = y - seeds[k].y;
        const distSq = dx * dx + dy * dy;
        if (distSq < d1)      { d2 = d1; d1 = distSq; nearest = k; }
        else if (distSq < d2) { d2 = distSq; }
      }

      // Crack zone: pixel is within CRACK_DIST of the Voronoi boundary
      const isCrack = (Math.sqrt(d2) - Math.sqrt(d1)) < CRACK_DIST;

      // Fill SOIL_STRIDE × SOIL_STRIDE pixel block
      const endX = Math.min(x + SOIL_STRIDE, W);
      const endY = Math.min(y + SOIL_STRIDE, H);

      for (let py = y; py < endY; py++) {
        for (let px = x; px < endX; px++) {
          const idx = (py * W + px) * 4;
          if (isCrack) {
            // Dark compressed-soil crack line
            d[idx    ] = 52;
            d[idx + 1] = 33;
            d[idx + 2] = 13;
          } else {
            const s = seeds[nearest];
            d[idx    ] = (s.r * depthShade) | 0;
            d[idx + 1] = (s.g * depthShade) | 0;
            d[idx + 2] = (s.b * depthShade) | 0;
          }
          d[idx + 3] = 255;
        }
      }
    }
  }

  soilCtx.putImageData(imgData, 0, 0);

  // Overlay a subtle vertical gradient: warm light near top, cool darkness below
  const grad = soilCtx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,    'rgba(255,235,180,0.10)');
  grad.addColorStop(0.35, 'rgba(0,0,0,0)');
  grad.addColorStop(1,    'rgba(0,0,0,0.18)');
  soilCtx.fillStyle = grad;
  soilCtx.fillRect(0, 0, W, H);
}

// ── Tunnel excavation update ──────────────────────────────────────────────────

function updateTunnelGrid(ants) {
  for (let i = 0; i < ants.length; i++) {
    const col = (ants[i].x / TUNNEL_CELL) | 0;
    const row = (ants[i].y / TUNNEL_CELL) | 0;
    if (col >= 0 && col < tunnelCols && row >= 0 && row < tunnelRows) {
      const idx = row * tunnelCols + col;
      // Float so we can use fractional increments; capped at 255
      if (tunnelGrid[idx] < 255) tunnelGrid[idx] += 1;
    }
  }
}

// ── Main render entry point ───────────────────────────────────────────────────

/**
 * Render one frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {SimulationState}         state
 * @param {number}                  fps
 */
export function render(ctx, state, fps) {
  const { canvasWidth: W, canvasHeight: H } = state;

  // 1. Static Voronoi soil (pre-rendered offscreen canvas)
  ctx.drawImage(soilCanvas, 0, 0);

  // 2. Tunnel excavations — update grid then draw
  updateTunnelGrid(state.ants);
  drawTunnels(ctx);

  // 3. Pheromone overlay (more transparent against the textured soil)
  if (state.config.showPheromones) {
    drawPheromones(ctx, state.pheromones, W, H);
  }

  // 4. Food sources
  for (let i = 0; i < state.foodSources.length; i++) {
    drawFood(ctx, state.foodSources[i]);
  }

  // 5. Colony
  drawColony(ctx, state.colony);

  // 6. Ants
  for (let i = 0; i < state.ants.length; i++) {
    drawAnt(ctx, state.ants[i]);
  }

  // 7. Glass-reflection overlay (very subtle)
  drawGlassReflection(ctx, W, H);

  // 8. HUD
  if (state.config.showAntCount) {
    drawHUD(ctx, state, fps, W, H);
  }
}

// ── Tunnel rendering ──────────────────────────────────────────────────────────

function drawTunnels(ctx) {
  const halfCell = TUNNEL_CELL * 0.65;

  ctx.save();
  ctx.fillStyle = '#0e0804'; // very dark earthy brown

  for (let i = 0; i < tunnelGrid.length; i++) {
    const val = tunnelGrid[i];
    if (val < 4) continue; // ignore rarely-visited cells

    const col = i % tunnelCols;
    const row = (i / tunnelCols) | 0;
    const cx  = col * TUNNEL_CELL + TUNNEL_CELL * 0.5;
    const cy  = row * TUNNEL_CELL + TUNNEL_CELL * 0.5;

    // Logarithmic opacity: reaches full darkness quickly for busy corridors
    ctx.globalAlpha = Math.min(Math.log(val + 1) / Math.log(180), 0.93);

    ctx.beginPath();
    ctx.arc(cx, cy, halfCell, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Pheromone overlay ─────────────────────────────────────────────────────────

function drawPheromones(ctx, pheromones, W, H) {
  if (!pheromoneImageData) return;

  const data = pheromoneImageData.data;
  const food = pheromones.food;
  const home = pheromones.home;
  const cols = pheromones.cols;
  const rows = pheromones.rows;

  data.fill(0);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const gridIdx = row * cols + col;
      const fv = food[gridIdx];
      const hv = home[gridIdx];
      if (fv < 0.01 && hv < 0.01) continue;

      const fn    = Math.min(fv / MAX_VALUE, 1);
      const hn    = Math.min(hv / MAX_VALUE, 1);
      const sum   = Math.max(fn + hn, 0.001);
      const alpha = Math.min(fn + hn, 1) * PHERO_MAX_ALPHA | 0;
      const r     = (FOOD_PHERO_R * fn + HOME_PHERO_R * hn) / sum | 0;
      const g     = (FOOD_PHERO_G * fn + HOME_PHERO_G * hn) / sum | 0;
      const b     = (FOOD_PHERO_B * fn + HOME_PHERO_B * hn) / sum | 0;

      const startX = col * CELL_SIZE;
      const startY = row * CELL_SIZE;
      const endX   = Math.min(startX + CELL_SIZE, W);
      const endY   = Math.min(startY + CELL_SIZE, H);

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

// ── Food source ───────────────────────────────────────────────────────────────

function drawFood(ctx, source) {
  const fullness = Math.min(source.quantity / 60, 1);
  const r        = FOOD_RADIUS * (0.5 + 0.5 * fullness);

  ctx.save();

  // Ambient glow ring
  const glow = ctx.createRadialGradient(source.x, source.y, r * 0.4, source.x, source.y, r + 9);
  glow.addColorStop(0, 'rgba(100,230,40,0.45)');
  glow.addColorStop(1, 'rgba(100,230,40,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(source.x, source.y, r + 9, 0, Math.PI * 2);
  ctx.fill();

  // 3-D sphere gradient (light source upper-left)
  const hx = source.x - r * 0.35;
  const hy = source.y - r * 0.35;
  const sphere = ctx.createRadialGradient(hx, hy, r * 0.08, source.x, source.y, r);
  sphere.addColorStop(0,   '#c8ff70');
  sphere.addColorStop(0.45,'#5aaa25');
  sphere.addColorStop(1,   '#1c4a08');
  ctx.fillStyle = sphere;
  ctx.beginPath();
  ctx.arc(source.x, source.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlight (tiny bright spot)
  const spec = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.38);
  spec.addColorStop(0, 'rgba(255,255,220,0.65)');
  spec.addColorStop(1, 'rgba(255,255,220,0)');
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.arc(source.x, source.y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ── Colony ────────────────────────────────────────────────────────────────────

function drawColony(ctx, colony) {
  const { x, y } = colony;
  const R = COLONY_RADIUS;

  ctx.save();

  // Outer drop shadow
  ctx.shadowColor   = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur    = 14;
  ctx.shadowOffsetY = 4;

  // Dirt mound — radial gradient for 3-D dome
  const mound = ctx.createRadialGradient(
    x - R * 0.32, y - R * 0.32, R * 0.08,
    x, y, R + 5
  );
  mound.addColorStop(0,   '#b46832');
  mound.addColorStop(0.5, '#6e3c12');
  mound.addColorStop(1,   '#2c1004');
  ctx.fillStyle = mound;
  ctx.beginPath();
  ctx.arc(x, y, R + 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'transparent'; // reset shadow for inner parts

  // Concentric texture rings on the mound
  for (let ring = 3; ring >= 1; ring--) {
    ctx.beginPath();
    ctx.arc(x, y, R * (ring / 3), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0,0,0,${0.08 + ring * 0.04})`;
    ctx.lineWidth   = 1.5;
    ctx.stroke();
  }

  // Central tunnel entrance hole — deep gradient
  const hole = ctx.createRadialGradient(x, y, 0, x, y, R * 0.48);
  hole.addColorStop(0,   '#020100');
  hole.addColorStop(0.6, '#140802');
  hole.addColorStop(1,   'rgba(10,5,1,0)');
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.arc(x, y, R * 0.52, 0, Math.PI * 2);
  ctx.fill();

  // Dome highlight (sunlit top-left)
  const hilite = ctx.createRadialGradient(
    x - R * 0.42, y - R * 0.42, 0,
    x - R * 0.2,  y - R * 0.2,  R * 0.55
  );
  hilite.addColorStop(0, 'rgba(255,200,100,0.28)');
  hilite.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = hilite;
  ctx.beginPath();
  ctx.arc(x, y, R + 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ── Ant ───────────────────────────────────────────────────────────────────────

function drawAnt(ctx, ant) {
  ctx.save();
  ctx.translate(ant.x, ant.y);
  ctx.rotate(ant.heading);

  const carrying = ant.state === STATE_RETURNING;

  // ── Drop shadow (gives depth against the soil)
  ctx.shadowColor   = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur    = 4;
  ctx.shadowOffsetX = 1.5;
  ctx.shadowOffsetY = 2.5;

  // ── Abdomen (rear, largest segment)
  const abdColor = carrying ? '#3e6814' : '#2c1a08';
  ctx.fillStyle = abdColor;
  ctx.beginPath();
  ctx.ellipse(-3.8, 0, 4.2, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'transparent'; // turn off shadow for remaining parts

  // Abdomen 3-D highlight
  const abdHL = ctx.createRadialGradient(-5, -1.2, 0.4, -3.8, 0, 4.2);
  abdHL.addColorStop(0, carrying ? 'rgba(130,220,60,0.55)' : 'rgba(140,80,20,0.55)');
  abdHL.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = abdHL;
  ctx.beginPath();
  ctx.ellipse(-3.8, 0, 4.2, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Petiole / waist (narrow)
  ctx.fillStyle = '#201208';
  ctx.beginPath();
  ctx.ellipse(0.4, 0, 1.6, 1.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Thorax
  ctx.fillStyle = '#251508';
  ctx.beginPath();
  ctx.ellipse(2.2, 0, 2.0, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Head
  ctx.fillStyle = '#180c04';
  ctx.beginPath();
  ctx.ellipse(4.4, 0, 2.2, 2.0, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head highlight
  const headHL = ctx.createRadialGradient(3.6, -1, 0.3, 4.4, 0, 2.2);
  headHL.addColorStop(0, 'rgba(120,60,10,0.45)');
  headHL.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = headHL;
  ctx.beginPath();
  ctx.ellipse(4.4, 0, 2.2, 2.0, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Legs (3 pairs from thorax)
  ctx.strokeStyle = '#1a0e04';
  ctx.lineWidth   = 0.65;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  // Front pair
  ctx.moveTo(3.2, -1.4); ctx.lineTo(5.5, -3.8);
  ctx.moveTo(3.2,  1.4); ctx.lineTo(5.5,  3.8);
  // Middle pair
  ctx.moveTo(1.8, -1.5); ctx.lineTo(0.5, -4.2);
  ctx.moveTo(1.8,  1.5); ctx.lineTo(0.5,  4.2);
  // Rear pair
  ctx.moveTo(0.5, -1.4); ctx.lineTo(-2.0, -3.8);
  ctx.moveTo(0.5,  1.4); ctx.lineTo(-2.0,  3.8);
  ctx.stroke();

  // ── Antennae (quadratic curves for natural bend)
  ctx.strokeStyle = '#1c0e04';
  ctx.lineWidth   = 0.7;
  ctx.beginPath();
  ctx.moveTo(5.8, -0.6);
  ctx.quadraticCurveTo(7.5, -2.5, 9.0, -3.8);
  ctx.moveTo(5.8,  0.6);
  ctx.quadraticCurveTo(7.5,  2.5, 9.0,  3.8);
  ctx.stroke();

  // ── Carried food pellet (tiny 3-D sphere)
  if (carrying) {
    const fpx = 1.8, fpy = 0, fr = 2.4;
    const foodSphere = ctx.createRadialGradient(fpx - 0.7, fpy - 0.7, 0.2, fpx, fpy, fr);
    foodSphere.addColorStop(0,   '#c8ff70');
    foodSphere.addColorStop(0.5, '#4a9020');
    foodSphere.addColorStop(1,   '#1c4a08');
    ctx.fillStyle = foodSphere;
    ctx.beginPath();
    ctx.arc(fpx, fpy, fr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ── Glass reflection overlay ──────────────────────────────────────────────────

function drawGlassReflection(ctx, W, H) {
  ctx.save();

  // Diagonal wash from top-left (very subtle)
  const wash = ctx.createLinearGradient(0, 0, W * 0.6, H * 0.5);
  wash.addColorStop(0,    'rgba(255,255,255,0.055)');
  wash.addColorStop(0.4,  'rgba(255,255,255,0.018)');
  wash.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  // Left-edge glass seam highlight
  const leftEdge = ctx.createLinearGradient(0, 0, 14, 0);
  leftEdge.addColorStop(0, 'rgba(255,255,255,0.07)');
  leftEdge.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = leftEdge;
  ctx.fillRect(0, 0, 14, H);

  // Top-edge glass seam highlight
  const topEdge = ctx.createLinearGradient(0, 0, 0, 12);
  topEdge.addColorStop(0, 'rgba(255,255,255,0.08)');
  topEdge.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = topEdge;
  ctx.fillRect(0, 0, W, 12);

  ctx.restore();
}

// ── HUD ───────────────────────────────────────────────────────────────────────

function drawHUD(ctx, state, fps, W, H) {
  const text = `${state.ants.length} ants`;
  ctx.font = 'bold 13px monospace';

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(text, 11, 21);
  // Lit text
  ctx.fillStyle = 'rgba(232,216,184,0.88)';
  ctx.fillText(text, 10, 20);
}
