/**
 * colony.js — Colony state and logic
 *
 * The colony is the spawn point and food drop-off location.
 * It holds a fixed position (center of canvas by default) and
 * tracks total food collected.
 */

export const COLONY_RADIUS = 18; // pixels — visual + interaction radius

/**
 * Create a new colony state object.
 * @param {number} x
 * @param {number} y
 * @returns {Colony}
 */
export function createColony(x, y) {
  return {
    x,
    y,
    foodCollected: 0,
  };
}

/**
 * Check whether a position is within the colony's pickup radius.
 * @param {Colony} colony
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isAtColony(colony, x, y) {
  const dx = x - colony.x;
  const dy = y - colony.y;
  return dx * dx + dy * dy <= COLONY_RADIUS * COLONY_RADIUS;
}

/**
 * Record food being deposited at the colony.
 * @param {Colony} colony
 */
export function depositFood(colony) {
  colony.foodCollected += 1;
}
