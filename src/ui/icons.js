/**
 * icons.js — lightweight professional vector icon set (inline SVG).
 * No emoji: every glyph is a stroke-based 24×24 SVG that inherits `currentColor`,
 * so colour is controlled entirely by CSS. Used by the Drive HUD, the tiered
 * warning system and status readouts (brief §2, §13, §14).
 *
 * Usage:
 *   import { icon } from './icons.js';
 *   el.innerHTML = icon('warning', { size: 20, cls: 'warn-ico' });
 */

/* Raw inner markup for each glyph (paths use stroke=currentColor via wrapper). */
const P = {
  // Speedometer / gauge
  gauge:
    '<path d="M12 13a1 1 0 0 0 .7-1.7L9 8"/>' +
    '<path d="M20.4 15a8.5 8.5 0 1 0-16.8 0"/>' +
    '<path d="M3.6 15h2M18.4 15h2M12 4.5V6"/>',
  // Road / lane
  road:
    '<path d="M6 3 4 21M18 3l2 18M12 4v2M12 10v2M12 16v2"/>',
  lane:
    '<path d="M12 3v18"/><path d="M6 5v3M6 12v3M6 18v1M18 5v3M18 12v3M18 18v1"/>',
  // Traffic signal head
  signal:
    '<rect x="8" y="2" width="8" height="20" rx="3"/>' +
    '<circle cx="12" cy="7" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="17" r="1.6"/>',
  // Warning triangle
  warning:
    '<path d="M12 3.2 22 20H2L12 3.2Z"/><path d="M12 10v4"/><circle cx="12" cy="17.4" r=".4" fill="currentColor" stroke="none"/>',
  // Collision / impact burst
  collision:
    '<path d="m12 2 1.8 4.6L18 4l-1.5 4.6 4.6-1L17 11l4.1 2.4-4.6.6L18 19l-4.2-2.2L12 21l-1.8-4.2L6 19l1.5-4.6L3 13.4l4.1-2.4L3 7.6l4.6 1L6 4l4.2 2.6Z"/>',
  // Wrong way (U-turn arrow with a cross feel)
  wrongway:
    '<path d="M15 5v6a4 4 0 0 1-8 0V8"/><path d="m4 11 3 3 3-3"/><path d="M15 5l3 3M18 5l-3 3"/>',
  // Off road (car leaving carriageway)
  offroad:
    '<path d="M3 20h18"/><path d="M6 20V8h6l3 4h3v8"/><path d="m14 3-2 3M18 3l-2 3M9 3 7 6"/>',
  // Restricted / no-entry
  restricted:
    '<circle cx="12" cy="12" r="9"/><path d="M7 12h10"/>',
  // Lane departure (dashed edge + drift arrow)
  departure:
    '<path d="M6 4v2M6 10v2M6 16v2"/><path d="M18 4v2M18 10v2M18 16v2"/>' +
    '<path d="M11 8v8M11 8l-2 2M11 8l2 2"/>',
  // Compass / heading
  compass:
    '<circle cx="12" cy="12" r="9"/><path d="m9 15 2-6 4 0-2 6-4 0Z" fill="currentColor" stroke="none" opacity=".5"/>' +
    '<path d="m14.5 9-5 6"/>',
  // Vehicle (side profile)
  car:
    '<path d="M3 13l1.8-4.2A2 2 0 0 1 6.6 7.5h10.8a2 2 0 0 1 1.8 1.3L21 13v4h-2"/>' +
    '<path d="M5 17H3v-4h18"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/>',
  // Clock
  clock:
    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  // Density / bars
  density:
    '<path d="M4 20V10M9 20V4M14 20v-8M19 20V7"/>',
  // Check / OK
  check:
    '<path d="M20 6 9 17l-5-5"/>',
  // Steering / driving
  steering:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.4"/>' +
    '<path d="M12 5.4v4.2M6.4 15l3.5-2M17.6 15l-3.5-2"/>',
  // Route / distance (pin trail)
  route:
    '<path d="M6 19a3 3 0 0 0 0-6h9a3 3 0 0 0 0-6H8"/><circle cx="6" cy="6" r="1.6"/><circle cx="18" cy="19" r="1.6"/>',
  // Weather glyphs
  sun:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
  cloud:
    '<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.4A3.5 3.5 0 0 1 17 18H7Z"/>',
  rain:
    '<path d="M7 15a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.4A3.5 3.5 0 0 1 17 15"/>' +
    '<path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  fog:
    '<path d="M4 9h16M4 13h16M4 17h11M6 5h12"/>',
  wind:
    '<path d="M3 8h10a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 13h14a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 18h7"/>',
  // Pause / play (HUD sim state)
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 5.2v13.6a.6.6 0 0 0 .92.5l10.8-6.8a.6.6 0 0 0 0-1L7.92 4.7A.6.6 0 0 0 7 5.2Z"/>',
  // Signal-fail / flashing
  hazard:
    '<path d="M12 3.2 22 20H2L12 3.2Z"/><path d="M12 9v3"/><path d="M9 15h6"/>',

  /* ---- vehicle classes (fleet mix, vehicle-select, status strip) ---- */
  motorcycle:
    '<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/>' +
    '<path d="M8.5 17h6l-3-5h4l2-3h-3"/><path d="M11.5 12 9 8H6.5"/>',
  bus:
    '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M3 11h18"/>' +
    '<circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/>' +
    '<path d="M6 8h4M14 8h4"/>',
  truck:
    '<path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7z"/>' +
    '<circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/>',
  tricycle:
    '<path d="M4 14l2-5h6l2 4h3l2 3"/>' +
    '<circle cx="6" cy="17" r="2"/><circle cx="13" cy="17" r="2"/><circle cx="19" cy="17" r="1.6"/>',

  /* ---- navigation / chrome ---- */
  map:
    '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
  flask:
    '<path d="M9 3h6M10 3v6l-5 8.5A2 2 0 0 0 6.8 21h10.4a2 2 0 0 0 1.8-3.5L14 9V3"/><path d="M7.5 15h9"/>',
  chart:
    '<path d="M4 4v16h16"/><path d="m7 14 3-4 3 3 4-6"/>',
  gear:
    '<circle cx="12" cy="12" r="3.2"/>' +
    '<path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19"/>',
  camera:
    '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 7l1.5-2h5L16 7"/><circle cx="12" cy="13" r="3.2"/>',
  sliders:
    '<path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2"/>' +
    '<circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  pin:
    '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 3 2 3H5"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5M5 20h14"/>',
  clipboard:
    '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3.5h6V5"/><path d="M9 11h6M9 15h4"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',

  /* ---- directional (touch drive controls) ---- */
  arrowUp: '<path d="M12 20V5M6 11l6-6 6 6"/>',
  arrowLeft: '<path d="M20 12H5M11 6l-6 6 6 6"/>',
  arrowRight: '<path d="M4 12h15M13 6l6 6-6 6"/>',

  /* ---- incidents / road works ---- */
  cone: '<path d="M10 4h4l4 16H6z"/><path d="M8.5 11h7M7.5 16h9M4 20h16"/>',
  wrench:
    '<path d="M20 5a4 4 0 0 1-5.3 5.3L6 19l-1-1 8.7-8.7A4 4 0 0 1 19 4l-2.3 2.3 1 1L20 5Z"/>',
  medical:
    '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/>',

  /* ---- weather (scenario tiles) ---- */
  sunrise:
    '<path d="M4 18h16M6.5 18a5.5 5.5 0 0 1 11 0"/>' +
    '<path d="M12 2v6M9 6l3-3 3 3M4.5 8.5 6 10M19.5 8.5 18 10M2 14h2M20 14h2"/>',
  sunset:
    '<path d="M4 18h16M6.5 18a5.5 5.5 0 0 1 11 0"/>' +
    '<path d="M12 3v6M9 6l3 3 3-3M4.5 8.5 6 10M19.5 8.5 18 10M2 14h2M20 14h2"/>',

  /* ---- generic filled status dot (coloured via CSS currentColor) ---- */
  dot: '<circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/>',
  droplet:
    '<path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3Z"/>'
};

/* Weather id → glyph name mapping (matches Config WEATHER ids). */
export const WEATHER_ICON = {
  clear: 'sun', rain: 'rain', heavyRain: 'rain', fog: 'fog', wind: 'wind'
};

/**
 * Return an inline SVG string for the named icon.
 * opts: { size=20, cls='', stroke=1.9 }
 */
export function icon(name, opts = {}) {
  const body = P[name];
  if (!body) return '';
  const size = opts.size || 20;
  const cls = opts.cls ? ` class="${opts.cls}"` : '';
  const sw = opts.stroke ?? 1.9;
  return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="${sw}" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

export const ICON_NAMES = Object.keys(P);
