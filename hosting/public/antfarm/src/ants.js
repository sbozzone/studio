/**
 * ants.js — Ant behaviour: movement, sensing, state transitions
 *
 * Each ant is a plain object stored in a flat array.
 * We use a data-oriented style — updateAnts() iterates the array and
 * mutates in-place, avoiding per-frame allocation.
 *
 * ── Ant states ──────────────────────────────────────────────────────────────
 *   SEARCHING   — wandering, following home-pheromone, seeking food
 *   RETURNING   — carrying food, following food-pheromone back to colony
 *
 * ── Sensing ─────────────────────────────────────────────────────────────────
 *   Three sensors angled ±SENSOR_ANGLE from the ant's heading at
 *   SENSOR_DISTANCE ahead.  The ant steers toward the strongest signal.
 *
 * ── Movement ────────────────────────────────────────────────────────────────
 *   Smooth heading interpolation with configurable turn rate.
 *   Boundary walls apply a repulsion force.
 */

import { sample, deposit, CELL_SIZE }     from './pheromones.js';
import { tryHarvestFood, pruneDepletedSources } from './food.js';
import { isAtColony, depositFood }         from './colony.js';

// ── Constants ────────────────────────────────────────────────────────────────

export const ANT_SPEED           = 60;   // pixels per second
const TURN_RATE                  = 4.5;  // radians per second max turn
const RANDOM_TURN_STRENGTH       = 1.2;  // amplitude of random angular jitter
const SENSOR_DISTANCE            = 24;   // pixels ahead of ant
const SENSOR_ANGLE               = 0.45; // radians (≈26°)

// Pheromone deposit amounts per second
const DEPOSIT_FOOD_TRAIL         = 2.0;
const DEPOSIT_HOME_TRAIL         = 0.5;

// Boundary repulsion starts this far from the edge
const WALL_MARGIN                = 30;

// Searching ants pick up the FOOD channel to find food, or just wander.
// Returning ants pick up HOME channel to navigate back to colony.
const STATE_SEARCHING = 'searching';
const STATE_RETURNING = 'returning';

export { STATE_SEARCHING, STATE_RETURNING };

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a single ant at position (x, y) with a random heading.
 * @returns {Ant}
 */
export function createAnt(x, y) {
  const angle = Math.random() * Math.PI * 2;
  return {
    x,
    y,
    vx: Math.cos(angle) * ANT_SPEED,
    vy: Math.sin(angle) * ANT_SPEED,
    heading: angle,
    state: STATE_SEARCHING,
    // Pheromone deposit accumulator — deposit every ~0.15 s
    depositTimer: Math.random() * 0.15,
  };
}

// ── Batch update ─────────────────────────────────────────────────────────────

/**
 * Update all ants for one simulation tick.
 *
 * @param {Ant[]}           ants
 * @param {PheromoneState}  pheromones
 * @param {FoodSource[]}    foodSources
 * @param {Colony}          colony
 * @param {number}          deltaTime      — seconds (already scaled by speed)
 * @param {number}          pheromoneStrength
 * @param {number}          canvasWidth
 * @param {number}          canvasHeight
 */
export function updateAnts(
  ants,
  pheromones,
  foodSources,
  colony,
  deltaTime,
  pheromoneStrength,
  canvasWidth,
  canvasHeight
) {
  for (let i = 0; i < ants.length; i++) {
    updateAnt(
      ants[i],
      pheromones,
      foodSources,
      colony,
      deltaTime,
      pheromoneStrength,
      canvasWidth,
      canvasHeight
    );
  }
  pruneDepletedSources(foodSources);
}

// ── Single-ant update ────────────────────────────────────────────────────────

function updateAnt(ant, pheromones, foodSources, colony, dt, pheromoneStrength, W, H) {
  // 1. Sense pheromone field and compute desired heading
  const desiredHeading = computeDesiredHeading(ant, pheromones, dt);

  // 2. Steer toward desired heading (smooth clamped turn)
  ant.heading = smoothTurn(ant.heading, desiredHeading, TURN_RATE * dt);

  // 3. Apply boundary avoidance
  ant.heading = applyWallRepulsion(ant.heading, ant.x, ant.y, W, H);

  // 4. Move
  ant.vx = Math.cos(ant.heading) * ANT_SPEED;
  ant.vy = Math.sin(ant.heading) * ANT_SPEED;
  ant.x += ant.vx * dt;
  ant.y += ant.vy * dt;

  // 5. Clamp position to canvas
  ant.x = Math.max(1, Math.min(W - 1, ant.x));
  ant.y = Math.max(1, Math.min(H - 1, ant.y));

  // 6. Deposit pheromones on timer
  ant.depositTimer -= dt;
  if (ant.depositTimer <= 0) {
    ant.depositTimer = 0.12 + Math.random() * 0.06;
    if (ant.state === STATE_RETURNING) {
      deposit(pheromones, pheromones.food, ant.x, ant.y, DEPOSIT_FOOD_TRAIL * pheromoneStrength);
    } else {
      deposit(pheromones, pheromones.home, ant.x, ant.y, DEPOSIT_HOME_TRAIL * pheromoneStrength);
    }
  }

  // 7. State transitions
  if (ant.state === STATE_SEARCHING) {
    const harvested = tryHarvestFood(foodSources, ant.x, ant.y);
    if (harvested) {
      ant.state = STATE_RETURNING;
      // U-turn immediately
      ant.heading = (ant.heading + Math.PI) % (Math.PI * 2);
    }
  } else {
    // Returning — check colony arrival
    if (isAtColony(colony, ant.x, ant.y)) {
      depositFood(colony);
      ant.state = STATE_SEARCHING;
      // U-turn to head out again
      ant.heading = (ant.heading + Math.PI) % (Math.PI * 2);
    }
  }
}

// ── Sensing helpers ──────────────────────────────────────────────────────────

/**
 * Sample three forward sensors and return the heading that maximises the
 * relevant pheromone gradient.
 */
function computeDesiredHeading(ant, pheromones, dt) {
  // Searching ants follow FOOD pheromone; returning ants follow HOME pheromone
  const grid = ant.state === STATE_SEARCHING ? pheromones.food : pheromones.home;

  const leftAngle   = ant.heading - SENSOR_ANGLE;
  const rightAngle  = ant.heading + SENSOR_ANGLE;
  const centerAngle = ant.heading;

  const leftVal   = sampleSensor(pheromones, grid, ant.x, ant.y, leftAngle);
  const centerVal = sampleSensor(pheromones, grid, ant.x, ant.y, centerAngle);
  const rightVal  = sampleSensor(pheromones, grid, ant.x, ant.y, rightAngle);

  let targetAngle;
  if (centerVal >= leftVal && centerVal >= rightVal) {
    // Continue straight — add small random jitter
    targetAngle = ant.heading + (Math.random() - 0.5) * RANDOM_TURN_STRENGTH * dt;
  } else if (leftVal > rightVal) {
    targetAngle = leftAngle;
  } else if (rightVal > leftVal) {
    targetAngle = rightAngle;
  } else {
    // Equal left/right — jitter randomly
    targetAngle = ant.heading + (Math.random() - 0.5) * RANDOM_TURN_STRENGTH;
  }

  return targetAngle;
}

function sampleSensor(state, grid, x, y, angle) {
  const sx = x + Math.cos(angle) * SENSOR_DISTANCE;
  const sy = y + Math.sin(angle) * SENSOR_DISTANCE;
  return sample(state, grid, sx, sy);
}

// ── Steering helpers ─────────────────────────────────────────────────────────

/**
 * Smoothly turn `current` toward `target` by at most `maxDelta` radians.
 * Handles angle wrapping.
 */
function smoothTurn(current, target, maxDelta) {
  let diff = target - current;
  // Normalise to [-π, π]
  while (diff >  Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

/**
 * Push ant's heading away from nearby walls.
 * Applies a proportional repulsion the closer to the wall it gets.
 */
function applyWallRepulsion(heading, x, y, W, H) {
  let pushX = 0;
  let pushY = 0;

  if (x < WALL_MARGIN)     pushX += (WALL_MARGIN - x) / WALL_MARGIN;
  if (x > W - WALL_MARGIN) pushX -= (x - (W - WALL_MARGIN)) / WALL_MARGIN;
  if (y < WALL_MARGIN)     pushY += (WALL_MARGIN - y) / WALL_MARGIN;
  if (y > H - WALL_MARGIN) pushY -= (y - (H - WALL_MARGIN)) / WALL_MARGIN;

  if (pushX === 0 && pushY === 0) return heading;

  const wallAngle = Math.atan2(pushY, pushX);
  return smoothTurn(heading, wallAngle, 0.15);
}

// ── Population management ────────────────────────────────────────────────────

/**
 * Ensure the ants array has exactly `targetCount` entries.
 * Adds ants at the colony or removes them from the tail.
 *
 * @param {Ant[]}    ants
 * @param {number}   targetCount
 * @param {Colony}   colony
 */
export function syncAntCount(ants, targetCount, colony) {
  while (ants.length < targetCount) {
    ants.push(createAnt(colony.x, colony.y));
  }
  if (ants.length > targetCount) {
    ants.length = targetCount;
  }
}
