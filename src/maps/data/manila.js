/** Manila — dense grid inspired by España Blvd / Taft Ave / Quiapo area. */
export default {
  id: 'manila',
  name: 'Manila',
  region: 'National Capital Region',
  description: 'Dense city grid — España & Taft corridors',
  laneWidth: 3.2,
  nodes: [
    { id: 'TA_N', x: 300, y: -60 }, { id: 'TA_1', x: 310, y: 180 },
    { id: 'TA_2', x: 320, y: 440 }, { id: 'TA_3', x: 330, y: 700 }, { id: 'TA_S', x: 330, y: 960 },
    { id: 'ES_W', x: -60, y: 220 }, { id: 'ES_E', x: 1060, y: 140 },
    { id: 'QZ_W', x: -60, y: 480 }, { id: 'QZ_E', x: 1060, y: 400 },
    { id: 'PD_W', x: -60, y: 740 }, { id: 'PD_E', x: 1060, y: 660 },
    { id: 'LE_1', x: 680, y: 170 }, { id: 'LE_2', x: 700, y: 420 }, { id: 'LE_3', x: 710, y: 680 }, { id: 'LE_S', x: 720, y: 960 }, { id: 'LE_N', x: 670, y: -60 }
  ],
  roads: [
    { id: 'taft_1', name: 'Taft Ave', from: 'TA_N', to: 'TA_1', lanesF: 2, lanesB: 2, speedLimit: 50, main: true },
    { id: 'taft_2', name: 'Taft Ave', from: 'TA_1', to: 'TA_2', lanesF: 2, lanesB: 2, speedLimit: 50, main: true },
    { id: 'taft_3', name: 'Taft Ave', from: 'TA_2', to: 'TA_3', lanesF: 2, lanesB: 2, speedLimit: 50, main: true },
    { id: 'taft_4', name: 'Taft Ave', from: 'TA_3', to: 'TA_S', lanesF: 2, lanesB: 2, speedLimit: 50, main: true },
    { id: 'lerma_1', name: 'Legarda St', from: 'LE_N', to: 'LE_1', lanesF: 2, lanesB: 2, speedLimit: 40, main: true },
    { id: 'lerma_2', name: 'Legarda St', from: 'LE_1', to: 'LE_2', lanesF: 2, lanesB: 2, speedLimit: 40, main: true },
    { id: 'lerma_3', name: 'Legarda St', from: 'LE_2', to: 'LE_3', lanesF: 2, lanesB: 2, speedLimit: 40, main: true },
    { id: 'lerma_4', name: 'Legarda St', from: 'LE_3', to: 'LE_S', lanesF: 2, lanesB: 2, speedLimit: 40, main: true },
    { id: 'espana_w', name: 'España Blvd', from: 'ES_W', to: 'TA_1', lanesF: 2, lanesB: 2, speedLimit: 60, main: true },
    { id: 'espana_c', name: 'España Blvd', from: 'TA_1', to: 'LE_1', lanesF: 2, lanesB: 2, speedLimit: 60, main: true },
    { id: 'espana_e', name: 'España Blvd', from: 'LE_1', to: 'ES_E', lanesF: 2, lanesB: 2, speedLimit: 60, main: true },
    { id: 'quezon_w', name: 'Quezon Blvd', from: 'QZ_W', to: 'TA_2', lanesF: 2, lanesB: 2, speedLimit: 50 },
    { id: 'quezon_c', name: 'Quezon Blvd', from: 'TA_2', to: 'LE_2', lanesF: 2, lanesB: 2, speedLimit: 50 },
    { id: 'quezon_e', name: 'Quezon Blvd', from: 'LE_2', to: 'QZ_E', lanesF: 2, lanesB: 2, speedLimit: 50 },
    { id: 'pedro_w', name: 'P. Gil St', from: 'PD_W', to: 'TA_3', lanesF: 1, lanesB: 1, speedLimit: 40 },
    { id: 'pedro_c', name: 'P. Gil St', from: 'TA_3', to: 'LE_3', lanesF: 1, lanesB: 1, speedLimit: 40 },
    { id: 'pedro_e', name: 'P. Gil St', from: 'LE_3', to: 'PD_E', lanesF: 1, lanesB: 1, speedLimit: 40 }
  ],
  signals: [
    { node: 'TA_1', green: 30, yellow: 4, red: 30 },
    { node: 'TA_2', green: 30, yellow: 4, red: 30 },
    { node: 'TA_3', green: 25, yellow: 4, red: 25 },
    { node: 'LE_1', green: 30, yellow: 4, red: 30 },
    { node: 'LE_2', green: 25, yellow: 4, red: 25 },
    { node: 'LE_3', green: 25, yellow: 4, red: 25 }
  ],
  landmarks: [
    { x: 480, y: 280, w: 90, h: 66, label: 'University Belt', kind: 'school' },
    { x: 500, y: 540, w: 80, h: 56, label: 'Quiapo Church', kind: 'church' },
    { x: 140, y: 560, w: 90, h: 70, label: 'City Hall', kind: 'civic' },
    { x: 480, y: 800, w: 90, h: 56, label: 'Public Market', kind: 'market' }
  ],
  blocks: [
    [60, 40, 180, 120], [420, 40, 180, 80], [800, 220, 200, 120],
    [80, 300, 160, 110], [820, 500, 180, 110], [100, 820, 200, 100],
    [820, 760, 180, 140], [420, 300, 200, 100]
  ],
  water: [{ x: 40, y: 900, w: 240, h: 60, label: 'Pasig River' }],
  greens: [[420, 620, 120, 100]]
};
