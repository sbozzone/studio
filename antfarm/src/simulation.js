/**
 * simulation.js — Central simulation state + update loop
 *
 * This module owns the single source of truth for all simulation data.
 * It exposes:
 *   - createSimulation(canvasWidth, canvasHeight)
 *   - updateSimulation(state, deltaTime)
 *   - resetSimulation(state, canvasWidth, canvasHeight)
 *   - addFoodAt(state, x, y)
 *
 * The render loop lives in renderer.js; this module is pure logic.
 */

import { createColony }         from './colony.js';
import { createPheromones, updatePheromones, resizePheromones } from './pheromones.js';
import { createFoodSource, autoSpawnFood } from './food.js';
import { createAnt, updateAnts, syncAntCount } from './ants.js';

// ── Default configuration ────────────────────────────────────────────────────

export const DEFAULT_CONFIG = {
  antCount:          100,
  simulationSpeed:   1.0,
  pheromoneStrength: 1.0,
  pheromoneDecay:    0.005,
  foodSpawnRate:     3,      // 1–5
  showPheromones:    true,
  showAntCount:      true,
  paused:            false,
};

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Build the complete simulation state.
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @param {Partial<typeof DEFAULT_CONFIG>} [configOverrides]
 * @returns {SimulationState}
 */
export function createSimulation(canvasWidth, canvasHeight, configOverrides = {}) {
  const config = { ...DEFAULT_CONFIG, ...configOverrides };

  const colony = createColony(canvasWidth / 2, canvasHeight / 2);

  // Pre-seed a couple of food sources so players see activity immediately
  const foodSources = [
    createFoodSource(
      canvasWidth  * 0.2 + Math.random() * 40 - 20,
      canvasHeight * 0.3 + Math.random() * 40 - 20,
    ),
    createFoodSource(
      canvasWidth  * 0.75 + Math.random() * 40 - 20,
      canvasHeight * 0.65 + Math.random() * 40 - 20,
    ),
  ];

  const ants = [];
  for (let i = 0; i < config.antCount; i++) {
    ants.push(createAnt(colony.x, colony.y));
  }

  return {
    colony,
    ants,
    foodSources,
    pheromones: createPheromones(canvasWidth, canvasHeight),
    config,
    // Timers
    foodSpawnAccumulator: 0,
    // Canvas dimensions (needed for boundary logic)
    canvasWidth,
    canvasHeight,
  };
}

// ── Update ───────────────────────────────────────────────────────────────────

/**
 * Advance the simulation by `rawDelta` seconds (before speed scaling).
 * @param {SimulationState} state
 * @param {number}          rawDelta
 */
export function updateSimulation(state, rawDelta) {
  if (state.config.paused) return;

  const dt = rawDelta * state.config.simulationSpeed;

  // 1. Pheromone evaporation + diffusion
  updatePheromones(
    state.pheromones,
    dt,
    state.config.pheromoneDecay,
  );

  // 2. Ant movement, sensing, harvesting
  updateAnts(
    state.ants,
    state.pheromones,
    state.foodSources,
    state.colony,
    dt,
    state.config.pheromoneStrength,
    state.canvasWidth,
    state.canvasHeight
  );

  // 3. Auto-spawn food
  state.foodSpawnAccumulator = autoSpawnFood(
    state.foodSources,
    state.foodSpawnAccumulator,
    dt,
    state.config.foodSpawnRate,
    state.canvasWidth,
    state.canvasHeight,
    state.colony.x,
    state.colony.y
  );

  // 4. Keep ant population in sync with config
  syncAntCount(state.ants, state.config.antCount, state.colony);
}

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Place a food source at a canvas position (user interaction).
 * @param {SimulationState} state
 * @param {number}          x
 * @param {number}          y
 */
export function addFoodAt(state, x, y) {
  state.foodSources.push(createFoodSource(x, y));
}

/**
 * Full reset: clear pheromones, reposition colony, rebuild ant population.
 * @param {SimulationState} state
 * @param {number}          canvasWidth
 * @param {number}          canvasHeight
 */
export function resetSimulation(state, canvasWidth, canvasHeight) {
  state.canvasWidth  = canvasWidth;
  state.canvasHeight = canvasHeight;

  state.colony.x = canvasWidth  / 2;
  state.colony.y = canvasHeight / 2;
  state.colony.foodCollected = 0;

  state.pheromones = createPheromones(canvasWidth, canvasHeight);

  state.foodSources.length = 0;
  state.foodSources.push(
    createFoodSource(
      canvasWidth  * 0.2 + Math.random() * 40 - 20,
      canvasHeight * 0.3 + Math.random() * 40 - 20,
    ),
    createFoodSource(
      canvasWidth  * 0.75 + Math.random() * 40 - 20,
      canvasHeight * 0.65 + Math.random() * 40 - 20,
    ),
  );

  state.ants.length = 0;
  for (let i = 0; i < state.config.antCount; i++) {
    state.ants.push(createAnt(state.colony.x, state.colony.y));
  }

  state.foodSpawnAccumulator = 0;
  state.config.paused = false;
}

/**
 * Resize pheromone grid when canvas dimensions change (window resize).
 * @param {SimulationState} state
 * @param {number}          canvasWidth
 * @param {number}          canvasHeight
 */
export function resizeSimulation(state, canvasWidth, canvasHeight) {
  state.canvasWidth  = canvasWidth;
  state.canvasHeight = canvasHeight;
  state.pheromones   = resizePheromones(canvasWidth, canvasHeight);
  // Recentre colony
  state.colony.x = canvasWidth  / 2;
  state.colony.y = canvasHeight / 2;
}
