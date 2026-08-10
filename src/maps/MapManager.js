import { RoadNetwork } from './RoadNetwork.js';
import sanMiguel from './data/san-miguel-bulacan.js';
import malolos from './data/malolos-bulacan.js';
import manila from './data/manila.js';

/**
 * MapManager — modular Philippine map registry.
 * Maps are declarative data modules; registering a new town only requires
 * adding a file under src/maps/data/ and one register() call (see README).
 * Locked entries are visible placeholders for future expansion — they are
 * not selectable and never pretend to work.
 */
export class MapManager {
  constructor() {
    this.registry = new Map();
    this.register(sanMiguel);
    this.register(malolos);
    this.register(manila);
    this.comingSoon = [
      'Meycauayan, Bulacan', 'Bocaue, Bulacan', 'San Jose del Monte',
      'Angeles, Pampanga', 'Quezon City', 'Cebu City', 'Davao City'
    ];
    this.currentId = 'san-miguel-bulacan'; // DEFAULT: San Miguel, Bulacan
    this.network = null;
  }

  register(def) { this.registry.set(def.id, def); }

  list() { return [...this.registry.values()].map(d => ({ id: d.id, name: d.name, region: d.region, description: d.description })); }

  get current() { return this.registry.get(this.currentId); }

  load(id = this.currentId) {
    const def = this.registry.get(id);
    if (!def) throw new Error(`Unknown map: ${id}`);
    this.currentId = id;
    this.network = new RoadNetwork(def);
    return this.network;
  }
}
