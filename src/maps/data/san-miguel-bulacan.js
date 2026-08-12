/**
 * San Miguel, Bulacan — DEFAULT MAP.
 * Simplified but recognizable road network centered on the Poblacion:
 * the Maharlika Highway (Cagayan Valley Rd) running north–south, crossed by
 * the town-center streets (Tecson St, Rizal St), the road to San Ildefonso
 * in the south, and Sibul Springs Road heading north-east.
 * Coordinates in meters. +x = east, +y = south (screen space).
 */
export default {
  id: 'san-miguel-bulacan',
  name: 'San Miguel, Bulacan',
  region: 'Central Luzon · Bulacan',
  description: 'Poblacion & Maharlika Highway corridor',
  laneWidth: 3.4,
  nodes: [
    // Maharlika Highway spine (N -> S)
    { id: 'MH_N',  x: 520,  y: -60  },
    { id: 'MH_1',  x: 540,  y: 160  },   // Sibul Springs junction
    { id: 'MH_2',  x: 560,  y: 360  },   // Tecson St junction (town center)
    { id: 'MH_3',  x: 570,  y: 560  },   // Rizal St junction
    { id: 'MH_4',  x: 560,  y: 760  },   // San Ildefonso Rd junction
    { id: 'MH_S',  x: 540,  y: 980  },
    // Tecson Street (E-W through Poblacion)
    { id: 'TC_W',  x: 60,   y: 380  },
    { id: 'TC_E',  x: 1030, y: 330  },
    // Rizal Street (E-W, south of plaza)
    { id: 'RZ_W',  x: 80,   y: 610  },
    { id: 'RZ_E',  x: 1000, y: 560  },
    // Poblacion loop (Bulualto Rd west side)
    { id: 'PB_NW', x: 300,  y: 370  },
    { id: 'PB_SW', x: 310,  y: 590  },
    // Sibul Springs Road (NE)
    { id: 'SB_E',  x: 1060, y: 60   },
    // San Ildefonso Road (SW)
    { id: 'SI_W',  x: 90,   y: 900  },
    // East barangay road
    { id: 'EB_1',  x: 810,  y: 350  },
    { id: 'EB_2',  x: 800,  y: 570  }
  ],
  roads: [
    // Maharlika Highway — main national road, 2 lanes per direction
    { id: 'maharlika_n',  name: 'Maharlika Hwy', from: 'MH_N', to: 'MH_1', lanesF: 2, lanesB: 2, speedLimit: 60, main: true },
    { id: 'maharlika_1',  name: 'Maharlika Hwy', from: 'MH_1', to: 'MH_2', lanesF: 2, lanesB: 2, speedLimit: 60, main: true },
    { id: 'maharlika_2',  name: 'Maharlika Hwy', from: 'MH_2', to: 'MH_3', lanesF: 2, lanesB: 2, speedLimit: 50, main: true },
    { id: 'maharlika_3',  name: 'Maharlika Hwy', from: 'MH_3', to: 'MH_4', lanesF: 2, lanesB: 2, speedLimit: 50, main: true },
    { id: 'maharlika_s',  name: 'Maharlika Hwy', from: 'MH_4', to: 'MH_S', lanesF: 2, lanesB: 2, speedLimit: 60, main: true },
    // Tecson St through the Poblacion
    { id: 'tecson_w',  name: 'Tecson St', from: 'TC_W', to: 'PB_NW', lanesF: 1, lanesB: 1, speedLimit: 40 },
    { id: 'tecson_c',  name: 'Tecson St', from: 'PB_NW', to: 'MH_2', lanesF: 1, lanesB: 1, speedLimit: 40 },
    { id: 'tecson_e1', name: 'Tecson St', from: 'MH_2', to: 'EB_1', lanesF: 1, lanesB: 1, speedLimit: 40 },
    { id: 'tecson_e2', name: 'Tecson St', from: 'EB_1', to: 'TC_E', lanesF: 1, lanesB: 1, speedLimit: 40 },
    // Rizal St
    { id: 'rizal_w',  name: 'Rizal St', from: 'RZ_W', to: 'PB_SW', lanesF: 1, lanesB: 1, speedLimit: 40 },
    { id: 'rizal_c',  name: 'Rizal St', from: 'PB_SW', to: 'MH_3', lanesF: 1, lanesB: 1, speedLimit: 40 },
    { id: 'rizal_e1', name: 'Rizal St', from: 'MH_3', to: 'EB_2', lanesF: 1, lanesB: 1, speedLimit: 40 },
    { id: 'rizal_e2', name: 'Rizal St', from: 'EB_2', to: 'RZ_E', lanesF: 1, lanesB: 1, speedLimit: 40 },
    // Poblacion west loop
    { id: 'bulualto', name: 'Bulualto Rd', from: 'PB_NW', to: 'PB_SW', lanesF: 1, lanesB: 1, speedLimit: 30 },
    // East barangay connector
    { id: 'eastbrgy', name: 'Brgy Salangan Rd', from: 'EB_1', to: 'EB_2', lanesF: 1, lanesB: 1, speedLimit: 30 },
    // Sibul Springs Road
    { id: 'sibul', name: 'Sibul Springs Rd', from: 'MH_1', to: 'SB_E', lanesF: 1, lanesB: 1, speedLimit: 50, via: [[780, 120]] },
    // San Ildefonso Road
    { id: 'sanildefonso', name: 'San Ildefonso Rd', from: 'MH_4', to: 'SI_W', lanesF: 1, lanesB: 1, speedLimit: 50, via: [[320, 830]] }
  ],
  signals: [
    { node: 'MH_2', green: 25, yellow: 4, red: 25 },
    { node: 'MH_3', green: 25, yellow: 4, red: 25 },
    { node: 'MH_1', green: 20, yellow: 4, red: 20 }
  ],
  landmarks: [
    { x: 430, y: 470, w: 90, h: 90, label: 'Town Plaza', kind: 'plaza' },
    { x: 430, y: 380, w: 70, h: 50, label: 'San Miguel Church', kind: 'church' },
    { x: 620, y: 420, w: 66, h: 46, label: 'Municipal Hall', kind: 'civic' },
    { x: 640, y: 260, w: 80, h: 55, label: 'Public Market', kind: 'market' },
    { x: 360, y: 660, w: 76, h: 48, label: 'San Miguel NHS', kind: 'school' },
    { x: 390, y: 40, w: 100, h: 64, label: 'St. Paul University', kind: 'school' },
    { x: 700, y: 640, w: 60, h: 44, label: 'Health Center', kind: 'civic' }
  ],
  // Building blocks for ambient scenery (auto-placed rectangles)
  blocks: [
    [120, 120, 340, 200], [640, 40, 320, 60], [120, 440, 150, 120],
    [640, 470, 120, 60], [660, 720, 260, 180], [120, 700, 160, 130],
    [860, 400, 130, 120], [340, 200, 180, 130]
  ],
  water: [{ x: 60, y: 40, w: 220, h: 70, label: 'San Miguel River' }],
  greens: [[880, 620, 150, 260], [60, 240, 180, 90]]
};
