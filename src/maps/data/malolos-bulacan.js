/** Malolos, Bulacan — capital city grid around Barasoain & the Capitol. */
export default {
  id: 'malolos-bulacan',
  name: 'Malolos, Bulacan',
  region: 'Central Luzon · Bulacan',
  description: 'Barasoain heritage district & MacArthur Hwy',
  laneWidth: 3.4,
  nodes: [
    { id: 'MA_N', x: 420, y: -60 }, { id: 'MA_1', x: 440, y: 200 },
    { id: 'MA_2', x: 460, y: 460 }, { id: 'MA_3', x: 470, y: 720 },
    { id: 'MA_S', x: 460, y: 980 },
    { id: 'PR_W', x: 40, y: 240 }, { id: 'PR_E', x: 1000, y: 180 },
    { id: 'CP_W', x: 60, y: 500 }, { id: 'CP_E', x: 1020, y: 440 },
    { id: 'SR_W', x: 80, y: 760 }, { id: 'SR_E', x: 1000, y: 700 },
    { id: 'GR_1', x: 760, y: 200 }, { id: 'GR_2', x: 780, y: 460 }, { id: 'GR_3', x: 790, y: 710 }
  ],
  roads: [
    { id: 'macarthur_1', name: 'MacArthur Hwy', from: 'MA_N', to: 'MA_1', lanesF: 2, lanesB: 2, speedLimit: 60, main: true },
    { id: 'macarthur_2', name: 'MacArthur Hwy', from: 'MA_1', to: 'MA_2', lanesF: 2, lanesB: 2, speedLimit: 50, main: true },
    { id: 'macarthur_3', name: 'MacArthur Hwy', from: 'MA_2', to: 'MA_3', lanesF: 2, lanesB: 2, speedLimit: 50, main: true },
    { id: 'macarthur_4', name: 'MacArthur Hwy', from: 'MA_3', to: 'MA_S', lanesF: 2, lanesB: 2, speedLimit: 60, main: true },
    { id: 'paseo_w', name: 'Paseo del Congreso', from: 'PR_W', to: 'MA_1', lanesF: 1, lanesB: 1, speedLimit: 40 },
    { id: 'paseo_e1', name: 'Paseo del Congreso', from: 'MA_1', to: 'GR_1', lanesF: 1, lanesB: 1, speedLimit: 40 },
    { id: 'paseo_e2', name: 'Paseo del Congreso', from: 'GR_1', to: 'PR_E', lanesF: 1, lanesB: 1, speedLimit: 40 },
    { id: 'capitol_w', name: 'Capitol Rd', from: 'CP_W', to: 'MA_2', lanesF: 1, lanesB: 1, speedLimit: 40 },
    { id: 'capitol_e1', name: 'Capitol Rd', from: 'MA_2', to: 'GR_2', lanesF: 1, lanesB: 1, speedLimit: 40 },
    { id: 'capitol_e2', name: 'Capitol Rd', from: 'GR_2', to: 'CP_E', lanesF: 1, lanesB: 1, speedLimit: 40 },
    { id: 'sto_w', name: 'Sto. Rosario St', from: 'SR_W', to: 'MA_3', lanesF: 1, lanesB: 1, speedLimit: 30 },
    { id: 'sto_e1', name: 'Sto. Rosario St', from: 'MA_3', to: 'GR_3', lanesF: 1, lanesB: 1, speedLimit: 30 },
    { id: 'sto_e2', name: 'Sto. Rosario St', from: 'GR_3', to: 'SR_E', lanesF: 1, lanesB: 1, speedLimit: 30 },
    { id: 'gapan_1', name: 'Gapan-Olongapo Rd', from: 'GR_1', to: 'GR_2', lanesF: 1, lanesB: 1, speedLimit: 40 },
    { id: 'gapan_2', name: 'Gapan-Olongapo Rd', from: 'GR_2', to: 'GR_3', lanesF: 1, lanesB: 1, speedLimit: 40 }
  ],
  signals: [
    { node: 'MA_1', green: 25, yellow: 4, red: 25 },
    { node: 'MA_2', green: 30, yellow: 4, red: 25 },
    { node: 'MA_3', green: 25, yellow: 4, red: 25 },
    { node: 'GR_2', green: 20, yellow: 4, red: 20 }
  ],
  landmarks: [
    { x: 330, y: 300, w: 80, h: 56, label: 'Barasoain Church', kind: 'church' },
    { x: 560, y: 540, w: 90, h: 60, label: 'Provincial Capitol', kind: 'civic' },
    { x: 330, y: 560, w: 80, h: 80, label: 'Plaza', kind: 'plaza' },
    { x: 580, y: 280, w: 70, h: 50, label: 'Public Market', kind: 'market' }
  ],
  blocks: [
    [80, 60, 260, 120], [560, 60, 160, 90], [90, 330, 180, 110],
    [560, 800, 300, 130], [90, 830, 220, 100], [860, 260, 130, 130], [860, 520, 130, 130]
  ],
  water: [],
  greens: [[60, 600, 160, 120], [850, 780, 160, 160]]
};
