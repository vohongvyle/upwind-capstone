// ─────────────────────────────────────────────────────────────
//  Regions. Each region has its own board grid, data folders,
//  outline(s), place names and demo model.
//  Switch with ?region=<id> in the URL (the header buttons do this).
//
//  Outlines are APPROXIMATE hand-traced rings (~3–5 km). For exact
//  borders drop official TIGER/Line GeoJSON at `outlineGeoJSON`.
// ─────────────────────────────────────────────────────────────
import { CONFIG } from './config.js';

const range = (a, b, step = 0.25) => Array.from({ length: Math.round((b - a) / step) + 1 }, (_, i) => +(a + i * step).toFixed(4));

export const REGIONS = {
  kern: {
    id: 'kern',
    name: 'Kern County',
    short: 'Kern',
    tagline: 'Kern County air pollution tracker',
    // board centres in the backend's 0–360 longitude convention
    grid: { lons: range(239.75, 242.25), lats: range(34.75, 35.75) },
    outlines: [
      { name: 'Kern', ring: [
        [-120.194, 35.789], [-117.632, 35.796], [-117.652, 34.820], [-118.877, 34.820],
        [-119.442, 34.901], [-119.475, 34.985], [-119.535, 35.090], [-119.555, 35.180],
        [-119.760, 35.330], [-119.910, 35.440], [-120.030, 35.560], [-120.194, 35.789]] },
    ],
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

  laoc: {
    id: 'laoc',
    name: 'Los Angeles & Orange',
    short: 'LA + Orange',
    tagline: 'LA & Orange County air pollution tracker',
    grid: { lons: range(241.0, 242.5), lats: range(33.5, 34.75) },
    outlines: [
      { name: 'Los Angeles', ring: [   // mainland only (Catalina / San Clemente islands omitted)
        [-118.880, 34.820], [-117.650, 34.820], [-117.655, 34.400], [-117.680, 34.150], [-117.730, 34.020],
        [-117.783, 33.946], [-117.980, 33.930], [-118.030, 33.870], [-118.090, 33.780], [-118.110, 33.752],
        [-118.180, 33.760], [-118.250, 33.712], [-118.350, 33.728], [-118.420, 33.770], [-118.395, 33.845],
        [-118.420, 33.960], [-118.480, 34.005], [-118.550, 34.040], [-118.700, 34.030], [-118.800, 34.010],
        [-118.940, 34.042], [-118.860, 34.130], [-118.670, 34.240], [-118.630, 34.300], [-118.650, 34.420],
        [-118.790, 34.580], [-118.880, 34.820]] },
      { name: 'Orange', ring: [
        [-117.783, 33.946], [-117.670, 33.880], [-117.530, 33.790], [-117.470, 33.700], [-117.412, 33.655],
        [-117.470, 33.550], [-117.510, 33.505], [-117.597, 33.386], [-117.680, 33.460], [-117.720, 33.480],
        [-117.790, 33.540], [-117.880, 33.600], [-117.950, 33.630], [-118.020, 33.670], [-118.090, 33.740],
        [-118.110, 33.752], [-118.090, 33.780], [-118.030, 33.870], [-117.980, 33.930], [-117.783, 33.946]] },
    ],
    places: [
      ['Downtown LA', -118.243, 34.052], ['Long Beach', -118.193, 33.770], ['Port of LA', -118.270, 33.735],
      ['Santa Monica', -118.491, 34.019], ['Malibu', -118.780, 34.026], ['Pasadena', -118.144, 34.148],
      ['Burbank', -118.309, 34.181], ['Glendale', -118.255, 34.142], ['Torrance', -118.341, 33.836],
      ['Inglewood', -118.353, 33.962], ['LAX', -118.408, 33.942], ['Compton', -118.220, 33.896],
      ['Downey', -118.133, 33.940], ['El Monte', -118.028, 34.069], ['West Covina', -117.939, 34.069],
      ['Pomona', -117.750, 34.055], ['Santa Clarita', -118.542, 34.391], ['San Fernando', -118.439, 34.282],
      ['Palmdale', -118.116, 34.579], ['Lancaster', -118.154, 34.698], ['Azusa', -117.907, 34.134],
      ['Anaheim', -117.915, 33.836], ['Santa Ana', -117.868, 33.746], ['Irvine', -117.826, 33.684],
      ['Fullerton', -117.925, 33.870], ['Garden Grove', -117.941, 33.774], ['Orange', -117.853, 33.788],
      ['Huntington Beach', -117.999, 33.660], ['Newport Beach', -117.929, 33.619], ['Costa Mesa', -117.919, 33.641],
      ['Mission Viejo', -117.672, 33.600], ['Laguna Beach', -117.783, 33.542], ['San Clemente', -117.612, 33.427],
      ['Yorba Linda', -117.813, 33.889],
    ],
  },
};

/** Current region from ?region=…, merged with its data-folder settings from config.js. */
export function currentRegion() {
  const id = new URLSearchParams(location.search).get('region');
  const key = REGIONS[id] ? id : CONFIG.defaultRegion;
  return { ...REGIONS[key], ...CONFIG.regions[key] };
}
