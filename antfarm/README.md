# Virtual Ant Farm

A high-performance, browser-based simulation of emergent ant colony foraging behaviour using continuous-space stigmergy.

---

## How to Run Locally

```bash
# Option A — zero-config static server
cd antfarm
npx serve .

# Option B — if you prefer Vite
npm create vite@latest . --template vanilla
npm install
npm run dev
```

Open `http://localhost:3000` (or the port shown) in any modern browser.

> **Requirement:** A browser that supports ES Modules (Chrome 61+, Firefox 60+, Safari 10.1+, Edge 16+).

---

## Controls

| Control | Description |
|---|---|
| **Ant Count** | Live-adjust population (1–500). Ants are added/removed instantly. |
| **Speed** | Simulation time multiplier (0.25× – 5×). Does not affect frame rate. |
| **Pheromone Strength** | How much pheromone each ant deposits per step. |
| **Pheromone Decay Rate** | Fractional evaporation per second. Higher = trails fade faster. |
| **Food Spawn Rate** | Auto-spawn interval: Slow (60 s) → Fast (3 s). |
| **Show Pheromones** | Toggle the semi-transparent pheromone overlay. |
| **Show Ant Count** | Toggle on-canvas HUD counter. |
| **Add Food Mode** | Click or tap the canvas to place a food source anywhere. |
| **Pause / Resume** | Also bound to **Spacebar**. |
| **Reset** | Clear all pheromones and food; rebuild ant population. |

### Mobile

Tap the **Controls** tab at the bottom edge to open the control sheet. Tap the header to close it.

---

## Simulation Model

### Overview

The simulation implements **continuous-space stigmergic foraging** — ants communicate indirectly by modifying a shared pheromone environment rather than by direct messaging.

### Ant Behaviour

Each ant maintains:
- **Position** `(x, y)` and **heading** angle
- **State**: `searching` (seeking food) or `returning` (carrying food to colony)

Movement uses smooth angular steering: on each tick the ant samples three forward sensors (left, centre, right at ±26° / 0.45 rad), then turns toward the strongest detected gradient with a maximum turn rate of 4.5 rad/s. Random directional jitter drives exploration when no gradient is detected.

Boundary walls apply a proportional heading repulsion that keeps ants in bounds without hard teleportation.

### Pheromone System

Two independent scalar fields stored as `Float32Array` grids (5 px/cell):

| Channel | Deposited by | Followed by | Colour |
|---|---|---|---|
| **Food** | Returning ants | Searching ants | Muted green |
| **Home** | Searching ants | Returning ants | Warm amber |

Each tick:
1. **Evaporation** — multiplicative decay scaled to a 60 FPS baseline (configurable rate).
2. **Diffusion** — lightweight 3×3 box spread at 15%/s, written via a scratch buffer to prevent read-write aliasing.

Values are clamped to `[0, 10]` to prevent runaway intensity.

### Food System

Food sources have finite quantity (60 units default). Each harvesting ant reduces quantity by 1. Depleted sources are removed. Auto-spawning fires on a configurable interval; user-placed sources via Add Food Mode are immediate.

### Colony

A single fixed colony at the canvas centre acts as spawn point and drop-off. Every deposited food unit increments the collected counter shown in the stats panel.

---

## Performance Notes

- **Target:** 200 ants at 60 FPS on mid-range desktop hardware.
- **Pheromone rendering** uses `ImageData` pixel writes (typed array) blitted in a single `drawImage` call — avoids thousands of `fillRect` calls per frame.
- **Diffusion** skips cells below 0.01 intensity threshold.
- **Per-frame allocations** are minimised: ants are mutated in-place, no new objects created in the hot path.
- **Delta cap** of 100 ms prevents physics instability after tab switches.
- FPS is tracked as a 30-frame rolling average to smooth display jitter.

---

## File Structure

```
antfarm/
├── index.html        # App shell, control panel HTML
├── style.css         # Layout, responsive design, component styles
├── src/
│   ├── main.js       # Entry point + rAF game loop
│   ├── simulation.js # Central state + update orchestration
│   ├── ants.js       # Ant update logic, sensing, steering, population sync
│   ├── pheromones.js # 2D grid, deposit, sample, evaporate, diffuse
│   ├── food.js       # Food source lifecycle + auto-spawn
│   ├── colony.js     # Colony state + food deposit logic
│   ├── renderer.js   # Canvas rendering (background, pheromones, ants, HUD)
│   └── controls.js   # UI wiring, resize observer, stats updates
└── README.md
```
