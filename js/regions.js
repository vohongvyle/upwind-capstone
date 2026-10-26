// ─────────────────────────────────────────────────────────────
//  Areas — California's most polluted metro areas
//  (American Lung Association, "State of the Air" 2026,
//   https://www.lung.org/media/press-releases/fy26-sota-california).
//  Los Angeles–Long Beach (#1 ozone) is intentionally left out.
//
//  Each area has its own 0.25° board grid (aligned to the same
//  lattice the backend already uses), data folders, place names,
//  national ranks and a demo model. Switch with ?region=<id>.
// ─────────────────────────────────────────────────────────────
import { CONFIG } from './config.js';

const range = (a, b, step = 0.25) => Array.from({ length: Math.round((b - a) / step) + 1 }, (_, i) => +(a + i * step).toFixed(4));
const E = lon => +(lon + 360).toFixed(4);   // −119.5 → 240.5 (backend convention)

export const REGIONS = {
  kern: {
    id: 'kern',
    name: 'Bakersfield',
    sub: 'Kern County',
    center: [-119.019, 35.373],
    // national rank: ozone, short-term particles, year-round particles (null = not ranked)
    ranks: { ozone: 3, short: 3, annual: 1 },
    headline: '#1 year-round particle pollution in the U.S.',
    grid: { lons: range(239.75, 242.25), lats: range(34.75, 35.75) },
    // approximate county outline (replace with TIGER/Line GeoJSON, FIPS 06029)
    outlines: [{ name: 'Kern', ring: [
      [-120.194, 35.789], [-117.632, 35.796], [-117.652, 34.820], [-118.877, 34.820],
      [-119.442, 34.901], [-119.475, 34.985], [-119.535, 35.090], [-119.555, 35.180],
      [-119.760, 35.330], [-119.910, 35.440], [-120.030, 35.560], [-120.194, 35.789]] }],
    places: [
      ['Bakersfield', -119.019, 35.373], ['Delano', -119.247, 35.769], ['Wasco', -119.341, 35.594],
      ['Shafter', -119.272, 35.500], ['McFarland', -119.229, 35.678], ['Taft', -119.456, 35.143],
      ['Maricopa', -119.401, 35.059], ['Buttonwillow', -119.469, 35.400], ['Lost Hills', -119.694, 35.616],
      ['Arvin', -118.828, 35.209], ['Lamont', -118.914, 35.260], ['Tehachapi', -118.449, 35.132],
      ['Frazier Park', -118.944, 34.823], ['Lake Isabella', -118.473, 35.618], ['Kernville', -118.425, 35.755],
      ['Mojave', -118.174, 35.052], ['California City', -117.986, 35.126], ['Rosamond', -118.163, 34.864],
      ['Boron', -117.649, 35.000], ['Ridgecrest', -117.671, 35.622], ['Inyokern', -117.812, 35.647],
      ['Keene', -118.563, 35.224], ['Glennville', -118.703, 35.729], ['Pine Mountain Club', -119.155, 34.846],
    ],
  },

  visalia: {
    id: 'visalia',
    name: 'Visalia',
    sub: 'Tulare County',
    center: [-119.292, 36.330],
    ranks: { ozone: 2, short: 5, annual: 5 }, tie: ['annual'],
    headline: '#2 worst ozone in the U.S.',
    grid: { lons: range(E(-119.75), E(-118.75)), lats: range(35.75, 36.75) },
    outlines: [],
    places: [
      ['Visalia', -119.292, 36.330], ['Tulare', -119.347, 36.208], ['Hanford', -119.645, 36.327],
      ['Porterville', -119.017, 36.065], ['Exeter', -119.142, 36.296], ['Lindsay', -119.088, 36.203],
      ['Farmersville', -119.207, 36.297], ['Dinuba', -119.387, 36.543], ['Woodlake', -119.098, 36.414],
      ['Lemoore', -119.783, 36.300], ['Corcoran', -119.560, 36.098], ['Kingsburg', -119.554, 36.514],
      ['Three Rivers', -118.904, 36.439], ['Terra Bella', -119.044, 35.962], ['Pixley', -119.291, 35.969],
      ['Earlimart', -119.271, 35.884], ['Springville', -118.818, 36.130],
    ],
  },

  fresno: {
    id: 'fresno',
    name: 'Fresno',
    sub: 'Fresno & Madera Counties',
    center: [-119.787, 36.738],
    ranks: { ozone: 5, short: 6, annual: 4 },
    headline: 'Top 6 on all three pollution lists',
    grid: { lons: range(E(-120.25), E(-119.25)), lats: range(36.25, 37.25) },
    outlines: [],
    places: [
      ['Fresno', -119.787, 36.738], ['Clovis', -119.703, 36.825], ['Madera', -120.061, 36.961],
      ['Sanger', -119.556, 36.708], ['Selma', -119.612, 36.571], ['Reedley', -119.450, 36.596],
      ['Kerman', -120.060, 36.723], ['Fowler', -119.678, 36.630], ['Kingsburg', -119.554, 36.514],
      ['Chowchilla', -120.260, 37.123], ['Friant', -119.709, 36.988], ['Mendota', -120.381, 36.754],
      ['Oakhurst', -119.649, 37.328], ['Coarsegold', -119.701, 37.262], ['Hanford', -119.645, 36.327],
      ['Lemoore', -119.783, 36.300], ['Biola', -120.016, 36.802], ['Caruthers', -119.833, 36.542],
    ],
  },

  sandiego: {
    id: 'sandiego',
    name: 'San Diego',
    sub: 'San Diego County',
    center: [-117.161, 32.716],
    ranks: { ozone: 7, short: null, annual: 5 }, tie: ['annual'],
    headline: '#7 ozone · tied #5 year-round particles',
    grid: { lons: range(E(-117.5), E(-116.5)), lats: range(32.5, 33.5) },
    outlines: [],
    places: [
      ['Downtown San Diego', -117.161, 32.716], ['Barrio Logan', -117.140, 32.697], ['Chula Vista', -117.084, 32.640],
      ['National City', -117.099, 32.678], ['Tijuana (MX)', -117.038, 32.515], ['Otay Mesa', -116.970, 32.560],
      ['El Cajon', -116.962, 32.795], ['La Mesa', -117.023, 32.768], ['Santee', -116.974, 32.838],
      ['La Jolla', -117.271, 32.833], ['Poway', -117.036, 32.963], ['Ramona', -116.868, 33.042],
      ['Escondido', -117.087, 33.119], ['San Marcos', -117.166, 33.143], ['Carlsbad', -117.351, 33.158],
      ['Oceanside', -117.379, 33.196], ['Alpine', -116.766, 32.835], ['Lakeside', -116.922, 32.857],
    ],
  },

  elcentro: {
    id: 'elcentro',
    name: 'El Centro',
    sub: 'Imperial County',
    center: [-115.563, 32.792],
    ranks: { ozone: 10, short: 14, annual: 21 },
    headline: '#10 ozone · on all three lists',
    grid: { lons: range(E(-116.0), E(-115.0)), lats: range(32.5, 33.5) },
    outlines: [],
    places: [
      ['El Centro', -115.563, 32.792], ['Calexico', -115.499, 32.679], ['Mexicali (MX)', -115.468, 32.624],
      ['Brawley', -115.530, 32.979], ['Imperial', -115.569, 32.848], ['Holtville', -115.380, 32.811],
      ['Heber', -115.530, 32.731], ['Seeley', -115.691, 32.793], ['Westmorland', -115.621, 33.037],
      ['Calipatria', -115.514, 33.126], ['Niland', -115.519, 33.240], ['Salton City', -115.956, 33.299],
      ['Ocotillo', -116.003, 32.738], ['Salton Sea', -115.850, 33.330],
    ],
  },
};

/** Areas ordered worst-first (by best national rank on any list). */
export const ORDER = ['kern', 'visalia', 'fresno', 'sandiego', 'elcentro'];

/** Current area from ?region=…, merged with its data-folder settings from config.js. */
export function currentRegion() {
  const id = new URLSearchParams(location.search).get('region');
  const key = REGIONS[id] ? id : CONFIG.defaultRegion;
  return { ...REGIONS[key], ...CONFIG.regions[key] };
}
