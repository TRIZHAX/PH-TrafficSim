/**
 * PH TrafficSim — Central data-driven configuration.
 * All simulation parameters live here (no magic numbers scattered in code).
 * Units: meters, seconds, m/s internally. UI converts to km/h.
 */

export const KMH = 3.6; // m/s -> km/h multiplier

// NOTE: `icon` fields are vector-icon NAMES (see src/ui/icons.js), not emoji.
// The UI renders them with icon(name); this keeps the whole interface emoji-free.
export const VEHICLE_TYPES = {
  car: {
    label: 'Car', icon: 'car',
    maxSpeed: 50 / KMH,        // m/s
    accel: 2.5,                // m/s²
    brake: 4.5,                // comfortable decel m/s²
    length: 4.4, width: 1.8,
    minGap: 2.0,               // standstill gap (m)
    headway: 1.35,             // desired time headway (s)
    reaction: 0.9
  },
  motorcycle: {
    label: 'Motorcycle', icon: 'motorcycle',
    maxSpeed: 60 / KMH, accel: 3.5, brake: 5.0,
    length: 2.1, width: 0.9,
    minGap: 1.4, headway: 1.0, reaction: 0.7
  },
  bus: {
    label: 'Bus', icon: 'bus',
    maxSpeed: 45 / KMH, accel: 1.4, brake: 3.2,
    length: 11.0, width: 2.5,
    minGap: 3.0, headway: 1.8, reaction: 1.1
  },
  truck: {
    label: 'Truck', icon: 'truck',
    maxSpeed: 40 / KMH, accel: 1.2, brake: 3.0,
    length: 8.5, width: 2.4,
    minGap: 3.0, headway: 2.0, reaction: 1.2
  },
  tricycle: {
    label: 'Tricycle', icon: 'tricycle',
    maxSpeed: 40 / KMH, accel: 1.8, brake: 3.5,
    length: 2.8, width: 1.5,
    minGap: 1.8, headway: 1.3, reaction: 1.0
  }
};

/** Default fleet composition (fractions, roughly Philippine provincial mix). */
export const DEFAULT_MIX = { car: 0.34, motorcycle: 0.30, tricycle: 0.22, bus: 0.06, truck: 0.08 };

export const WEATHER = {
  clear: {
    label: 'Clear', icon: 'sun',
    speedFactor: 1.00, visibility: 1.00, brakingFactor: 1.00, headwayFactor: 1.00,
    capacityFactor: 1.00
  },
  rain: {
    label: 'Rain', icon: 'rain',
    speedFactor: 0.85, visibility: 0.80, brakingFactor: 1.20, headwayFactor: 1.15,
    capacityFactor: 0.85
  },
  heavyRain: {
    label: 'Heavy Rain', icon: 'rain',
    speedFactor: 0.70, visibility: 0.60, brakingFactor: 1.40, headwayFactor: 1.35,
    capacityFactor: 0.70
  },
  fog: {
    label: 'Fog', icon: 'fog',
    speedFactor: 0.75, visibility: 0.40, brakingFactor: 1.25, headwayFactor: 1.30,
    capacityFactor: 0.80
  },
  wind: {
    label: 'Strong Wind', icon: 'wind',
    speedFactor: 0.90, visibility: 0.95, brakingFactor: 1.05, headwayFactor: 1.05,
    capacityFactor: 0.95
  }
};

export const ROAD_CONDITIONS = {
  good:    { label: 'Good',          icon: 'check',    color: '#38e07d', speedFactor: 1.00, accelFactor: 1.00, capacityFactor: 1.00 },
  wet:     { label: 'Wet',           icon: 'droplet',  color: '#5ec8f2', speedFactor: 0.85, accelFactor: 0.90, capacityFactor: 0.85 },
  damaged: { label: 'Damaged',       icon: 'warning',  color: '#ff8a3d', speedFactor: 0.60, accelFactor: 0.70, capacityFactor: 0.70 },
  severe:  { label: 'Severe Damage', icon: 'hazard',   color: '#ff4d4d', speedFactor: 0.40, accelFactor: 0.55, capacityFactor: 0.50 }
};

export const INCIDENT_TYPES = {
  construction: { label: 'Road Construction', icon: 'cone',    closesLane: true,  speedFactor: 0.5, duration: Infinity },
  breakdown:    { label: 'Vehicle Breakdown', icon: 'wrench',  closesLane: true,  speedFactor: 0.6, duration: 120 },
  accident:     { label: 'Accident',          icon: 'medical', closesLane: true,  speedFactor: 0.4, duration: 180 },
  laneClosure:  { label: 'Lane Closure',      icon: 'restricted', closesLane: true,  speedFactor: 0.7, duration: Infinity },
  signalFail:   { label: 'Signal Failure',    icon: 'signal',  closesLane: false, speedFactor: 1.0, duration: 240 }
};

export const CONGESTION_LEVELS = [
  { id: 'low',       label: 'LOW',       icon: 'dot', color: '#38e07d', max: 0.30 },
  { id: 'moderate',  label: 'MODERATE',  icon: 'dot', color: '#ffc14d', max: 0.50 },
  { id: 'heavy',     label: 'HEAVY',     icon: 'dot', color: '#ff8a3d', max: 0.75 },
  { id: 'congested', label: 'CONGESTED', icon: 'dot', color: '#ff4d4d', max: 1.01 }
];

export const SIGNAL_DEFAULTS = { green: 25, yellow: 4, red: 25 };
export const SIGNAL_LIMITS = { green: [10, 60], yellow: [3, 10], red: [10, 60] };

export const SCENARIOS = {
  normalDay:    { label: 'Normal Day',        icon: 'sun',     vehicles: 90,  weather: 'clear',     roadCondition: 'good',    green: 25, mix: DEFAULT_MIX },
  morningRush:  { label: 'Morning Rush',      icon: 'sunrise', vehicles: 200, weather: 'clear',     roadCondition: 'good',    green: 30, mix: { car: 0.38, motorcycle: 0.30, tricycle: 0.18, bus: 0.08, truck: 0.06 } },
  afternoon:    { label: 'Afternoon Traffic', icon: 'sunset',  vehicles: 150, weather: 'clear',     roadCondition: 'good',    green: 25, mix: DEFAULT_MIX },
  heavyTraffic: { label: 'Heavy Traffic',     icon: 'density', vehicles: 260, weather: 'clear',     roadCondition: 'good',    green: 30, mix: DEFAULT_MIX },
  heavyRain:    { label: 'Heavy Rain',        icon: 'rain',    vehicles: 150, weather: 'heavyRain', roadCondition: 'wet',     green: 25, mix: DEFAULT_MIX },
  fog:          { label: 'Fog',               icon: 'fog',     vehicles: 120, weather: 'fog',       roadCondition: 'good',    green: 25, mix: DEFAULT_MIX },
  heavyTrucks:  { label: 'Heavy Trucks',      icon: 'truck',   vehicles: 140, weather: 'clear',     roadCondition: 'good',    green: 30, mix: { car: 0.25, motorcycle: 0.20, tricycle: 0.10, bus: 0.10, truck: 0.35 } },
  construction: { label: 'Road Construction', icon: 'cone',    vehicles: 150, weather: 'clear',     roadCondition: 'good',    green: 30, mix: DEFAULT_MIX, incident: 'construction' },
  accident:     { label: 'Accident',          icon: 'medical', vehicles: 150, weather: 'clear',     roadCondition: 'good',    green: 25, mix: DEFAULT_MIX, incident: 'accident' }
};

export const SIM = {
  dt: 1 / 30,               // fixed physics timestep (s)
  maxSubSteps: 10,
  jamDensity: 0.145,        // veh/m/lane used for density normalization (~1 veh per 7m)
  sensorWindow: 60,         // s window for flow measurement
  recordInterval: 1.0,      // s between analytics samples
  spawnRetry: 0.5,
  defaultSpeedLimit: 50 / KMH,
  freeFlowFactor: 0.92      // free-flow speed fraction of limit used for delay baseline
};

export const SETTINGS_KEY = 'ph-trafficsim-settings-v1';

export const DEFAULT_SETTINGS = {
  quality: 'auto',           // auto | low | medium | high | ultra
  cameraSensitivity: 1.0,
  simSpeed: 1,
  sound: false,
  weatherFx: true,
  showStats: true,
  showLabels: true,
  showConditions: true,
  keys: { accel: 'KeyW', brake: 'KeyS', left: 'KeyA', right: 'KeyD', handbrake: 'Space', camera: 'KeyC', pause: 'KeyP' }
};
