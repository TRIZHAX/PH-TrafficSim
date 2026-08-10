import { SimulationClock } from './SimulationClock.js';
import { MapManager } from '../maps/MapManager.js';
import { TrafficLightManager } from '../simulation/TrafficLightManager.js';
import { WeatherManager } from '../simulation/WeatherManager.js';
import { RoadConditionManager } from '../simulation/RoadConditionManager.js';
import { IncidentManager } from '../simulation/IncidentManager.js';
import { TrafficSimulation } from '../simulation/TrafficSimulation.js';
import { ScenarioManager } from '../simulation/ScenarioManager.js';
import { StatisticsManager } from '../analytics/StatisticsManager.js';
import { DataRecorder } from '../analytics/DataRecorder.js';
import { PlayerVehicle } from '../vehicles/PlayerVehicle.js';
import { bus } from './EventBus.js';
import { SIM } from './Config.js';

/**
 * SimulationEngine — composition root of the computational model.
 * Owns the clock, map, managers, agent simulation and analytics.
 * Contains ZERO rendering code: 2D and 3D renderers subscribe to the same
 * engine state, which is what makes the model renderer-independent.
 */
export class SimulationEngine {
  constructor() {
    this.clock = new SimulationClock();
    this.maps = new MapManager();
    this.weather = new WeatherManager();
    this.roadCond = new RoadConditionManager();
    this.player = new PlayerVehicle('car');
    this.loadMap(this.maps.currentId);
    this.scenarios = new ScenarioManager(this);
  }

  loadMap(id) {
    const network = this.maps.load(id);
    this.network = network;
    this.lights = new TrafficLightManager(network);
    this.incidents = new IncidentManager(network, this.lights);
    this.traffic = new TrafficSimulation(network, this.lights, this.weather, this.roadCond, this.incidents);
    this.traffic.setPlayer(this.player);
    this.stats = new StatisticsManager(this);
    this.recorder = new DataRecorder(this);
    this.player.active = false;
    this.clock.reset();
    bus.emit('map:loaded', { id, network });
  }

  start(seed = true) {
    if (seed) this.traffic.seedVehicles();
    this.clock.reset();
    this.stats.reset();
    this.recorder.reset();
    bus.emit('sim:started');
  }

  /** Advance simulation given real elapsed seconds. */
  update(realDt, playerInput) {
    const n = this.clock.steps(realDt);
    for (let i = 0; i < n; i++) {
      this.clock.advance();
      this.lights.step(SIM.dt);
      this.incidents.step(SIM.dt);
      this.traffic.step();
      if (this.player.active) this.player.step(playerInput, this.traffic.env());
      this.stats.step(SIM.dt);
      this.recorder.step(SIM.dt);
    }
    return n > 0;
  }

  /** Run the sim headless for `seconds` at max speed (Traffic Lab experiments). */
  runHeadless(seconds, onProgress) {
    const steps = Math.ceil(seconds / SIM.dt);
    for (let i = 0; i < steps; i++) {
      this.clock.advance();
      this.lights.step(SIM.dt);
      this.incidents.step(SIM.dt);
      this.traffic.step();
      this.stats.step(SIM.dt);
      this.recorder.step(SIM.dt);
      if (onProgress && i % 300 === 0) onProgress(i / steps);
    }
  }

  spawnPlayer(type, x, y) {
    this.player.setType(type);
    const pt = this.traffic.nearestLanePoint(x, y);
    if (pt) this.player.placeAt(pt.x, pt.y, pt.heading);
    bus.emit('player:spawned', this.player);
  }

  removePlayer() { this.player.active = false; bus.emit('player:removed'); }
}
