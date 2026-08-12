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
  // Signal-fail / flashing
  hazard:
    '<path d="M12 3.2 22 20H2L12 3.2Z"/><path d="M12 9v3"/><path d="M9 15h6"/>'
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
