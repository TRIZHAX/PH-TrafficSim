# PH TrafficSim — Philippine Traffic Flow Simulation & Analysis

A computational science project that models, simulates, and analyzes vehicular
traffic flow on Philippine road networks. The default map is **San Miguel,
Bulacan** (Maharlika Highway through Poblacion). The simulation is a real
microscopic traffic model — not a game — with a drivable probe vehicle, live
metrics, controlled experiments, and CSV data export.

**Designed & Created by TRIZHAX**

---

## Contents

1. [Quick Start](#quick-start)
2. [Controls](#controls)
3. [The Simulation Model](#the-simulation-model)
4. [2D and 3D Modes](#2d-and-3d-modes)
5. [Weather, Road Conditions & Incidents](#weather-road-conditions--incidents)
6. [Metrics & Congestion Classification](#metrics--congestion-classification)
7. [Scenarios & Traffic Lab](#scenarios--traffic-lab)
8. [Analytics & CSV Export](#analytics--csv-export)
9. [Map System — Adding Your Own PH Map](#map-system--adding-your-own-ph-map)
10. [Project Structure](#project-structure)
11. [Performance Notes](#performance-notes)

---

## Quick Start

Requires **Node.js 18+**.

```bash
npm install     # install dependencies (three.js + fonts, all offline after install)
npm run dev     # development server → http://localhost:3000
npm run build   # production build → dist/
npm run preview # serve the production build → http://localhost:3000
```

Everything runs fully offline — no API keys, no external services. The
production `dist/` folder is static and can be hosted anywhere (GitHub Pages,
Netlify, a USB stick).

## Controls

### Desktop

| Key | Action |
| --- | --- |
| `W` / `↑` | Accelerate |
| `S` / `↓` | Brake / reverse |
| `A` / `D` (`←` / `→`) | Steer |
| `Space` | Handbrake |
| `C` | Cycle camera (3D: third person → first person → overview) |
| `P` | Pause / resume simulation |
| `Esc` | Exit drive mode / close pages |
| Mouse drag | Pan the 2D map / orbit-free 3D camera |
| Mouse wheel | Zoom (2D zooms to cursor) |

All driving keys are remappable in **Settings → Key Bindings**.

### Mobile

- Large touch buttons for **steer left / right**, **accelerate**, **brake**
  (multi-touch: steer and accelerate at the same time)
- One-finger pan, **pinch to zoom** the 2D map
- Floating action buttons: menu, stats, camera, drive
- Bottom navigation bar for Simulate / Maps / Lab / Charts / More

To drive: press the car button (toolbar on desktop, red FAB on mobile), choose
**Car** (50 km/h) or **Motorcycle** (60 km/h), and you spawn on the nearest
lane. AI vehicles see you and brake/queue behind you.

## The Simulation Model

The engine is a **microscopic, agent-based** model with a fixed timestep
(`Δt = 1/30 s`) and a seeded random number generator so experiments are
reproducible.

Each vehicle integrates its state numerically every step:

```
v(t+Δt) = v(t) + a·Δt        (semi-implicit Euler)
s(t+Δt) = s(t) + v(t+Δt)·Δt
```

Acceleration `a` comes from the **Intelligent Driver Model (IDM)** — a
standard car-following model in traffic engineering:

```
a = a_max · [ 1 − (v/v₀)⁴ − (s*/s)² ]
s* = s₀ + v·T + v·Δv / (2·√(a_max·b))
```

- `v₀` desired speed (vehicle max speed × speed limit × weather × road factors)
- `T` desired time headway (stretched by rain/fog)
- `s₀` minimum jam gap, `b` comfortable braking (reduced when wet)
- `s` actual gap to the binding constraint, `Δv` closing speed

Each step the binding constraint is the **minimum** acceleration toward:
the leader on the lane, a red/yellow signal stop line, an incident blockage,
a conflicting vehicle inside an intersection, or the player's vehicle.
Queues, shockwaves, and stop-and-go traffic **emerge** from these rules —
they are not scripted.

Additional behaviors:

- **Lane changing** (MOBIL-style): mandatory escape from blocked lanes and
  discretionary overtaking, both with gap acceptance checks.
- **Intersection yielding** with anti-gridlock rules (priority to vehicles
  already in the box, patience-based creep-through).
- **Traffic signals**: two-phase fixed-time control per intersection.
  Green 10–60 s, yellow 3–10 s, red 10–60 s — all user-configurable live
  from the Signals tab. Vehicles decide on yellow using their actual
  stopping distance.

### Vehicle Fleet

| Type | Max speed | Character |
| --- | --- | --- |
| Car | 50 km/h | baseline |
| Motorcycle | 60 km/h | quick, short headway |
| Bus | 45 km/h | long, slow to accelerate, long following distance |
| Truck | 40 km/h | longest, heaviest |
| Tricycle | 40 km/h | short, slow — a PH road staple |

The fleet mix is adjustable with sliders (default mix approximates a
provincial PH highway: many cars/motorcycles/tricycles, few buses/trucks).

## 2D and 3D Modes

- **2D top-down view is the default.** It is the analysis view: fast on any
  device, with road names, signal lamps, stop lines, incident zones, sensor
  markers, brake lights, and weather overlays.
- **3D (three.js) is optional.** Toggle with the `[2D] [3D]` switch in the
  top bar. The 3D renderer is **lazy-loaded** the first time you switch, so
  it costs nothing until used. Cameras: traffic overview, free camera
  (W/A/S/D to fly), third person and first person while driving (`C` cycles).

Both renderers draw **the same engine state** — the simulation never depends
on a renderer, so metrics are identical in 2D and 3D.

## Weather, Road Conditions & Incidents

**Weather** (Nature tab) scales the model, not just the visuals:

| Weather | Speed | Visibility | Braking |
| --- | --- | --- | --- |
| Clear | 100% | 100% | 100% |
| Rain | 80% | 70% | 85% |
| Heavy Rain | 60% | 40% | 70% |
| Fog | 50% | 25% | 90% |
| Strong Wind | 90% | 90% | 95% |

Rain streaks, fog gradients, and wind lines are drawn in 2D; the 3D scene
changes fog distance and sun intensity to match.

**Road conditions** (Roads tab): Good / Wet / Damaged / Severe damage, plus a
quality slider (100 / 80 / 60 / 40%). Lower quality lowers speed and
acceleration and raises headways.

**Incidents** (Roads tab): road construction 🚧, vehicle breakdown,
accident, lane closure, and signal failure (lights go to flashing).
Blocked lanes force merges upstream — watch the queue build in real time.

## Metrics & Congestion Classification

Computed live every 0.5 s and shown on the floating dashboard:

- **Density** — vehicles per lane-meter, normalized by jam density (veh/km capacity)
- **Flow** — veh/hr measured by virtual loop detectors on main links (rolling 60 s window)
- **Average speed** — mean of all vehicle speeds (km/h)
- **Queue length** — vehicles stopped (< 0.5 m/s) for more than 2 s
- **Average delay** — accumulated time lost vs free-flow travel, per vehicle (s)
- **Road capacity** — % remaining after weather, road damage, and incident lane losses

Congestion level combines several of these into one score:

```
score = 0.5·density + 0.3·(1 − speedRatio) + 0.2·utilization
LOW → MODERATE → HEAVY → CONGESTED
```

## Scenarios & Traffic Lab

**Scenario presets** (Explore page): Normal Day, Rush Hour, Rainy Evening,
Night, Fog Morning, Storm, Roadwork Rush, Accident Response, Free Flow — plus
a fully custom setup via the control drawer (volume, mix, weather, roads,
signals, incidents, speed scale).

**Traffic Lab** runs *controlled experiments*: a separate headless engine
instance with a fixed random seed simulates N minutes as fast as possible,
excludes a warm-up period, and reports mean speed / density / flow / delay /
queue / max queue / capacity / congestion. Change **one variable at a time**
(e.g. green time 30 s → 45 s, or Clear → Heavy Rain) and the results table
shows **% deltas vs your baseline run** with improvement/degradation
coloring. Each run can be exported to CSV. The live simulation is untouched
while experiments run.

Example research questions it answers directly:

- *How does rain intensity affect average speed and delay?*
- *Which green-time setting maximizes flow at this volume?*
- *How much does one blocked lane reduce effective capacity?*

## Analytics & CSV Export

The Analytics page renders 8 live time-series charts (vehicle count, average
speed, density, flow, delay, queue, capacity, utilization) with range pills:
**Live (60 s) / Last 5 min / Last 10 min / Entire simulation**.

Data is recorded once per simulated second. **Export CSV** downloads:

```
timestamp, vehicle_count, average_speed, traffic_density, flow_rate,
average_delay, queue_length, road_capacity, weather, road_condition,
traffic_light_state, congestion, scenario, map
```

ready for Excel, Google Sheets, Python/pandas, or R.

## Map System — Adding Your Own PH Map

Maps are plain data modules — no engine changes needed.

1. Create `src/maps/data/your-town.js`:

```js
export default {
  id: 'your-town',
  name: 'Your Town, Province',
  region: 'Region name',
  description: 'Short description shown on the Maps page',
  laneWidth: 3.4,                                    // meters (optional)
  nodes: [
    { id: 'N', x: 400, y: -100 },                    // meters, map coordinates
    { id: 'X', x: 400, y: 400 },                     // intersection
    { id: 'S', x: 400, y: 900 },
    { id: 'W', x: 0,   y: 420 },
    { id: 'E', x: 900, y: 380 },
  ],
  roads: [
    // speedLimit is in km/h; main:true links get traffic sensors
    { id: 'hwy_1', name: 'Main Hwy',  from: 'N', to: 'X', lanesF: 2, lanesB: 2, speedLimit: 50, main: true },
    { id: 'hwy_2', name: 'Main Hwy',  from: 'X', to: 'S', lanesF: 2, lanesB: 2, speedLimit: 50, main: true },
    { id: 'cross_w', name: 'Cross St', from: 'W', to: 'X', lanesF: 1, lanesB: 1, speedLimit: 40 },
    { id: 'cross_e', name: 'Cross St', from: 'X', to: 'E', lanesF: 1, lanesB: 1, speedLimit: 40 },
  ],
  signals: [
    { node: 'X', green: 25, yellow: 4, red: 25 },    // signalized intersections
  ],
  landmarks: [
    { x: 300, y: 300, w: 80, h: 60, label: 'Town Plaza', kind: 'plaza' },
  ],
  blocks: [ [80, 60, 260, 120] ],                    // buildings [x, y, w, h]
  greens: [ [60, 600, 160, 120] ],                   // parks     [x, y, w, h]
  water:  [],                                        // rivers    [x, y, w, h]
};
```

2. Register it in `src/maps/MapManager.js`:

```js
import yourTown from './data/your-town.js';
this.register(yourTown);
```

It then appears on the Maps page and works in 2D, 3D, the Lab, and CSV
export automatically. Included maps: **San Miguel, Bulacan** (default),
**Malolos, Bulacan**, **Manila (España/Quiapo grid)**.

The engine builds the lane graph automatically: lane centerlines are offset
from the road spine, intersection connectors are generated as curves with
turn classification (straight/right/left) and conflict detection, and
signalized approaches are grouped into two phases by heading.

## Project Structure

```
ph-trafficsim/
├── index.html                 # loading screen + canvas mounts
├── vite.config.js             # port 3000, three.js split into its own chunk
├── src/
│   ├── main.js                # bootstrap; lazy-loads the 3D renderer
│   ├── core/                  # Config (all tunables), engine, clock, events, math
│   ├── maps/                  # RoadNetwork builder, MapManager, data/ (map modules)
│   ├── vehicles/              # Vehicle (IDM agent), PlayerVehicle (bicycle model)
│   ├── simulation/            # traffic stepping, lights, weather, roads, incidents, scenarios
│   ├── analytics/             # statistics, sensors, data recorder (CSV), experiments
│   ├── input/                 # keyboard + touch input
│   ├── camera/                # 2D pan/zoom/follow camera
│   ├── rendering/             # Renderer2D (default), Renderer3D (lazy, three.js)
│   ├── ui/                    # UI shell, pages, charts, mobile controls
│   └── styles/                # main.css (dark glassmorphism theme)
└── dist/                      # production build (after npm run build)
```

Architecture rule: **the simulation engine never imports a renderer.** The
engine steps on a fixed clock; renderers (2D canvas or three.js) and the UI
only *read* engine state. This is what makes headless Lab experiments, the
2D/3D toggle, and consistent metrics possible.

All model constants — vehicle specs, weather factors, road conditions,
incident types, congestion thresholds, scenario presets, signal limits — live
in `src/core/Config.js` as plain data.

## Performance Notes

- 2D renderer draws vehicles as fast rects with LOD (dots when zoomed out);
  it comfortably handles the 400-vehicle maximum on mobile.
- 3D renderer uses one `InstancedMesh` per vehicle type and auto-selects
  quality (low on mobile, high on desktop). three.js is only downloaded when
  3D mode is first opened.
- Simulation speed controls: pause, 1×, 2×, 5×, 10× (fixed timestep is
  preserved; faster speeds just run more steps per frame).

---

**PH TrafficSim v1.0.0** · A computational science project ·
Designed & Created by **TRIZHAX**
</content>
</invoke>
