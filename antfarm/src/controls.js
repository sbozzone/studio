/**
 * controls.js — UI control panel wiring
 *
 * Connects all HTML inputs to the simulation config.
 * Also manages:
 *   - Pause/Resume toggle (button + spacebar)
 *   - Reset
 *   - Add-food mode (canvas click/touch)
 *   - Mobile bottom sheet toggle
 *   - Stats display updates
 *   - Canvas resize handling
 */

import { addFoodAt, resetSimulation, resizeSimulation } from './simulation.js';
import { initRenderer, resetTunnels }                  from './renderer.js';

// ── Initialise controls ──────────────────────────────────────────────────────

/**
 * Wire up all controls to the simulation state.
 *
 * @param {SimulationState}         simState
 * @param {HTMLCanvasElement}       canvas
 * @param {CanvasRenderingContext2D} ctx
 * @returns {{ updateStats: Function }}  — call each frame to refresh stat display
 */
export function initControls(simState, canvas, ctx) {
  // ── Sliders ────────────────────────────────────────────────────────────────

  wireSlider('ant-count',      'ant-count-val',      simState, 'antCount',
    v => Math.round(v),
    v => String(Math.round(v))
  );

  wireSlider('sim-speed',      'sim-speed-val',      simState, 'simulationSpeed',
    v => v,
    v => `${v}×`
  );

  wireSlider('phero-strength', 'phero-strength-val', simState, 'pheromoneStrength',
    v => v,
    v => parseFloat(v).toFixed(1)
  );

  wireSlider('phero-decay',    'phero-decay-val',    simState, 'pheromoneDecay',
    v => v,
    v => parseFloat(v).toFixed(3)
  );

  wireSlider('food-rate',      'food-rate-val',      simState, 'foodSpawnRate',
    v => Math.round(v),
    v => ['', 'Slow', 'Low', 'Med', 'High', 'Fast'][Math.round(v)]
  );

  // ── Toggles ────────────────────────────────────────────────────────────────

  wireCheckbox('show-pheromones', simState, 'showPheromones');
  wireCheckbox('show-ant-count',  simState, 'showAntCount');

  // ── Add-food mode ──────────────────────────────────────────────────────────

  const addFoodCheckbox = document.getElementById('add-food-mode');
  const foodHint        = document.getElementById('food-hint');

  addFoodCheckbox.addEventListener('change', () => {
    const active = addFoodCheckbox.checked;
    foodHint.hidden = !active;
    canvas.classList.toggle('food-mode', active);
  });

  // ── Canvas interaction (food placement) ───────────────────────────────────

  canvas.addEventListener('click', (event) => {
    if (!addFoodCheckbox.checked) return;
    const { x, y } = getCanvasPos(canvas, event.clientX, event.clientY);
    addFoodAt(simState, x, y);
  });

  canvas.addEventListener('touchend', (event) => {
    if (!addFoodCheckbox.checked) return;
    event.preventDefault();
    const touch = event.changedTouches[0];
    const { x, y } = getCanvasPos(canvas, touch.clientX, touch.clientY);
    addFoodAt(simState, x, y);
  }, { passive: false });

  // ── Pause / Resume ─────────────────────────────────────────────────────────

  const pauseBtn = document.getElementById('btn-pause');

  function togglePause() {
    simState.config.paused = !simState.config.paused;
    pauseBtn.textContent = simState.config.paused ? 'Resume' : 'Pause';
  }

  pauseBtn.addEventListener('click', togglePause);

  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && event.target === document.body) {
      event.preventDefault();
      togglePause();
    }
  });

  // ── Reset ─────────────────────────────────────────────────────────────────

  document.getElementById('btn-reset').addEventListener('click', () => {
    resetSimulation(simState, simState.canvasWidth, simState.canvasHeight);
    resetTunnels();
    pauseBtn.textContent = 'Pause';
  });

  // ── Desktop panel collapse ─────────────────────────────────────────────────

  const panel     = document.getElementById('control-panel');
  const toggleBtn = document.getElementById('panel-toggle');

  toggleBtn.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('collapsed');
    toggleBtn.innerHTML = collapsed ? '&#8249;' : '&#8250;';
    toggleBtn.setAttribute('aria-label', collapsed ? 'Expand panel' : 'Collapse panel');
  });

  // ── Mobile bottom sheet ────────────────────────────────────────────────────

  const sheetTab   = document.getElementById('mobile-sheet-tab');
  const panelHeader = panel.querySelector('.panel-header');

  function toggleMobileSheet() {
    const open = panel.classList.toggle('mobile-open');
    sheetTab.classList.toggle('hidden', open);
  }

  sheetTab.addEventListener('click', toggleMobileSheet);
  panelHeader.addEventListener('click', () => {
    if (isMobile()) toggleMobileSheet();
  });

  // ── Canvas resize ──────────────────────────────────────────────────────────

  const resizeObserver = new ResizeObserver(() => {
    resizeCanvas(canvas, simState, ctx);
  });
  resizeObserver.observe(canvas);

  // Initial size
  resizeCanvas(canvas, simState, ctx);

  // ── Stats update function ─────────────────────────────────────────────────

  const statAnts    = document.getElementById('stat-ants');
  const statFood    = document.getElementById('stat-food');
  const statSources = document.getElementById('stat-sources');
  const statFps     = document.getElementById('stat-fps');

  function updateStats(fps) {
    statAnts.textContent    = simState.ants.length;
    statFood.textContent    = simState.colony.foodCollected;
    statSources.textContent = simState.foodSources.length;
    statFps.textContent     = Math.round(fps);
  }

  return { updateStats };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Wire a range input to a config key with live value display.
 */
function wireSlider(inputId, displayId, simState, configKey, transform, format) {
  const input   = document.getElementById(inputId);
  const display = document.getElementById(displayId);

  if (!input) return;

  // Initialise display from current config
  display.textContent = format(simState.config[configKey]);

  input.addEventListener('input', () => {
    const value = transform(parseFloat(input.value));
    simState.config[configKey] = value;
    display.textContent = format(input.value);
  });
}

/**
 * Wire a checkbox to a boolean config key.
 */
function wireCheckbox(inputId, simState, configKey) {
  const input = document.getElementById(inputId);
  if (!input) return;

  // Initialise from config
  input.checked = simState.config[configKey];

  input.addEventListener('change', () => {
    simState.config[configKey] = input.checked;
  });
}

/**
 * Get canvas-local position from a client coordinate.
 */
function getCanvasPos(canvas, clientX, clientY) {
  const rect  = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top)  * scaleY,
  };
}

/**
 * Resize the canvas to match its CSS layout size and update simulation.
 */
function resizeCanvas(canvas, simState, ctx) {
  const displayWidth  = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width  = displayWidth;
    canvas.height = displayHeight;

    resizeSimulation(simState, displayWidth, displayHeight);
    initRenderer(displayWidth, displayHeight);
  }
}

function isMobile() {
  return window.innerWidth <= 768;
}
