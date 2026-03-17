/**
 * pheromones.js — 2D scalar pheromone grid
 *
 * Two channels stored as Float32Arrays:
 *   FOOD  — deposited by ants returning to colony (green tint)
 *   HOME  — deposited by ants searching for food (amber tint)
 *
 * Grid cells map to canvas pixels via CELL_SIZE.
 * Values are clamped to [0, MAX_VALUE] to prevent runaway intensity.
 *
 * Diffusion is implemented as a lightweight 3×3 box blur applied
 * each frame (scaled by deltaTime) so trails spread softly.
 */

export const CELL_SIZE = 5;          // canvas pixels per grid cell
export const MAX_VALUE  = 10.0;      // maximum pheromone intensity

// Channel indices — used as array offsets where two flat arrays are separate
export const CHANNEL_FOOD = 0;
export const CHANNEL_HOME = 1;

/**
 * Create pheromone state for a canvas of given dimensions.
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @returns {PheromoneState}
 */
export function createPheromones(canvasWidth, canvasHeight) {
  const cols = Math.ceil(canvasWidth  / CELL_SIZE);
  const rows = Math.ceil(canvasHeight / CELL_SIZE);
  const size = cols * rows;

  return {
    cols,
    rows,
    size,
    // Two separate flat arrays — one per channel
    food: new Float32Array(size),
    home: new Float32Array(size),
    // Scratch buffer used during diffusion to avoid read-write aliasing
    scratch: new Float32Array(size),
  };
}

/**
 * Convert canvas coordinates to a grid cell index.
 * Returns -1 if out of bounds.
 * @param {PheromoneState} state
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function coordToIndex(state, x, y) {
  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);
  if (col < 0 || col >= state.cols || row < 0 || row >= state.rows) return -1;
  return row * state.cols + col;
}

/**
 * Deposit pheromone at a canvas position.
 * @param {PheromoneState} state
 * @param {Float32Array}   grid   — state.food or state.home
 * @param {number}         x
 * @param {number}         y
 * @param {number}         amount
 */
export function deposit(state, grid, x, y, amount) {
  const index = coordToIndex(state, x, y);
  if (index === -1) return;
  grid[index] = Math.min(grid[index] + amount, MAX_VALUE);
}

/**
 * Sample pheromone value at a canvas position (bilinear NOT needed here;
 * nearest-cell is sufficient for ant sensing at this granularity).
 * @param {PheromoneState} state
 * @param {Float32Array}   grid
 * @param {number}         x
 * @param {number}         y
 * @returns {number}
 */
export function sample(state, grid, x, y) {
  const index = coordToIndex(state, x, y);
  if (index === -1) return 0;
  return grid[index];
}

/**
 * Update pheromone grid: evaporation + optional diffusion.
 * Diffusion is a simple 3×3 box spread at a fixed rate.
 *
 * @param {PheromoneState} state
 * @param {number}         deltaTime   — seconds
 * @param {number}         decayRate   — fractional decay per second (e.g. 0.005)
 * @param {number}         diffusionRate — fraction that spreads per second
 */
export function updatePheromones(state, deltaTime, decayRate, diffusionRate = 0.15) {
  evaporateGrid(state.food, state.size, decayRate, deltaTime);
  evaporateGrid(state.home, state.size, decayRate, deltaTime);

  // Diffusion only when there is non-trivial activity (skip if near zero)
  diffuseGrid(state, state.food, diffusionRate * deltaTime);
  diffuseGrid(state, state.home, diffusionRate * deltaTime);
}

/** Apply exponential-style evaporation in-place. */
function evaporateGrid(grid, size, rate, deltaTime) {
  const factor = 1 - rate * deltaTime * 60; // normalise to 60 fps baseline
  const clampedFactor = Math.max(0, factor);
  for (let i = 0; i < size; i++) {
    if (grid[i] > 0) {
      grid[i] *= clampedFactor;
      if (grid[i] < 0.001) grid[i] = 0; // zero out negligible values
    }
  }
}

/**
 * Box-blur diffusion: each cell shares `rate` of its value equally to its
 * eight neighbours. We write into scratch then copy back to avoid aliasing.
 */
function diffuseGrid(state, grid, rate) {
  const { cols, rows, scratch } = state;
  scratch.fill(0);

  const sharePerNeighbour = rate / 8;

  for (let row = 1; row < rows - 1; row++) {
    for (let col = 1; col < cols - 1; col++) {
      const idx    = row * cols + col;
      const value  = grid[idx];
      if (value < 0.01) continue; // skip near-empty cells for performance

      const shared = value * rate;
      const kept   = value - shared;
      const each   = value * sharePerNeighbour;

      scratch[idx] += kept;
      scratch[idx - cols - 1] += each;
      scratch[idx - cols    ] += each;
      scratch[idx - cols + 1] += each;
      scratch[idx       - 1 ] += each;
      scratch[idx       + 1 ] += each;
      scratch[idx + cols - 1] += each;
      scratch[idx + cols    ] += each;
      scratch[idx + cols + 1] += each;
    }
  }

  // Copy scratch back, clamping to MAX_VALUE
  for (let i = 0; i < grid.length; i++) {
    const v = scratch[i];
    grid[i] = v > MAX_VALUE ? MAX_VALUE : v;
  }
}

/**
 * Resize pheromone state to a new canvas size (on window resize).
 * Existing trail data is lost — clean slate.
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @returns {PheromoneState}
 */
export function resizePheromones(canvasWidth, canvasHeight) {
  return createPheromones(canvasWidth, canvasHeight);
}
