/**
 * food.js — Food source management
 *
 * Food sources have a position and a finite quantity.
 * When an ant reaches a source it takes one unit; sources are removed
 * when their quantity reaches zero.
 *
 * Auto-spawning uses an accumulator so the spawn rate is independent of
 * frame rate.
 */

export const FOOD_RADIUS          = 14;  // canvas pixels — visual + pickup radius
export const FOOD_DEFAULT_QUANTITY = 60; // units per source

// Spawn interval range in seconds, keyed by rate level 1–5
const SPAWN_INTERVALS = {
  1: 60,
  2: 30,
  3: 15,
  4:  7,
  5:  3,
};

/**
 * @typedef {Object} FoodSource
 * @property {number} id
 * @property {number} x
 * @property {number} y
 * @property {number} quantity
 */

let nextFoodId = 1;

/** @returns {FoodSource} */
export function createFoodSource(x, y, quantity = FOOD_DEFAULT_QUANTITY) {
  return { id: nextFoodId++, x, y, quantity };
}

/**
 * Attempt to take one unit of food from the closest source within pickup range.
 * Returns the source if successful, null otherwise.
 *
 * @param {FoodSource[]} sources
 * @param {number}       x
 * @param {number}       y
 * @returns {FoodSource|null}
 */
export function tryHarvestFood(sources, x, y) {
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    const dx  = x - src.x;
    const dy  = y - src.y;
    if (dx * dx + dy * dy <= FOOD_RADIUS * FOOD_RADIUS && src.quantity > 0) {
      src.quantity -= 1;
      return src;
    }
  }
  return null;
}

/**
 * Remove depleted food sources.
 * @param {FoodSource[]} sources
 */
export function pruneDepletedSources(sources) {
  for (let i = sources.length - 1; i >= 0; i--) {
    if (sources[i].quantity <= 0) sources.splice(i, 1);
  }
}

/**
 * Update the auto-spawn timer; push a new source when ready.
 * Returns updated accumulator.
 *
 * @param {FoodSource[]} sources
 * @param {number}       accumulator   — seconds since last spawn
 * @param {number}       deltaTime
 * @param {number}       rateLevel     — 1–5
 * @param {number}       canvasWidth
 * @param {number}       canvasHeight
 * @param {number}       colonyX
 * @param {number}       colonyY
 * @returns {number}  new accumulator
 */
export function autoSpawnFood(
  sources,
  accumulator,
  deltaTime,
  rateLevel,
  canvasWidth,
  canvasHeight,
  colonyX,
  colonyY
) {
  const interval = SPAWN_INTERVALS[rateLevel] ?? 15;
  accumulator += deltaTime;

  if (accumulator >= interval) {
    // Spawn at least one cell-width from edges and not on top of the colony
    const margin  = 40;
    const minDist = 80; // minimum distance from colony

    let x, y, attempts = 0;
    do {
      x = margin + Math.random() * (canvasWidth  - margin * 2);
      y = margin + Math.random() * (canvasHeight - margin * 2);
      attempts++;
    } while (
      attempts < 20 &&
      (x - colonyX) ** 2 + (y - colonyY) ** 2 < minDist * minDist
    );

    sources.push(createFoodSource(x, y));
    return accumulator - interval;
  }

  return accumulator;
}
