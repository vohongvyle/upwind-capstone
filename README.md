# Upwind: check where your air is coming from

A static web front-end for the Borealis capstone backend. It shows air pollution across California's most polluted metro areas, traces where that pollution came from, and tells people when it's safe to be outside.

There is no build step and no API key. The only dependency is **D3 v7**, which ships in `vendor/`.

## Run locally

```bash
cd upwind
python3 -m http.server 8000      # then open http://localhost:8000
```

The code uses ES modules, so open it over HTTP. Opening `index.html` as a `file://` page won't work.

If no board files are found, the app switches to **demo data** in the same format as the backend, and the header badge says "Demo".

## Areas: California's most polluted cities

Rankings come from the American Lung Association's *State of the Air 2026* report ([CA press release](https://www.lung.org/media/press-releases/fy26-sota-california)). Each number is the area's rank among all U.S. metro areas. Los Angeles–Long Beach (#1 for ozone) is intentionally left out.

| Area (`?region=`) | Ozone | Short-term PM | Year-round PM | Grid centres (0–360 lon) | Data folders |
|---|---|---|---|---|---|
| Bakersfield / Kern (`kern`) | #3 | #3 | **#1** | lon 239.75–242.25, lat 34.75–35.75 (11×5) | `board_archive2/`, `forecast/` |
| Visalia (`visalia`) | **#2** | #5 | #5 (tie) | lon 240.25–241.25, lat 35.75–36.75 (5×5) | `cities/visalia/…` |
| Fresno (`fresno`) | #5 | #6 | #4 | lon 239.75–240.75, lat 36.25–37.25 (5×5) | `cities/fresno/…` |
| San Diego (`sandiego`) | #7 | — | #5 (tie) | lon 242.5–243.5, lat 32.5–33.5 (5×5) | `cities/sandiego/…` |
| El Centro (`elcentro`) | #10 | #14 | #21 | lon 244.0–245.0, lat 32.5–33.5 (5×5) | `cities/elcentro/…` |

**Backend:** run the existing pipeline (OpenWeather, Aurora, pathfinder) with each area's lat/lon range from the table. Write the output to `cities/<id>/board_archive/` and `cities/<id>/forecast/`, using the same file names as Kern. All grids sit on the same 0.25° lattice the backend already uses.

To add or remove an area, edit `REGIONS` and `ORDER` in `js/regions.js` and `regions` in `js/config.js`.

## Features

- **City picker** (top left) — every area with its three national ranks; the panel's *Why this city* card explains the ranking.
- **My location** — finds you by GPS and jumps to your grid cell. It tells you if you're outside the area on screen.
- **Saved places** — up to 6 per area, kept in `localStorage`. The app opens straight to the first saved place.
- **Incoming-pollution alert** — reads the next 24 h of forecast boards and their trajectories. When AQI at your spot gets meaningfully worse and the predicted path passes nearby, it shows *"Pollution is heading your way (origin: …)"*.
- **Best time outside** — the next five 6-hour slots rated Good / Limit / Avoid for your health profile (Everyone, Sensitive groups, Outdoor workers), with a short tip.
- Smooth AQI field, wind particles, animated pollution path, timeline with playback, satellite or dark basemap.

## Configuration (`js/config.js`)

| Key | What it does |
|---|---|
| `appName` | Name shown in the header and the browser tab |
| `regions.<id>` | Data folders and optional official outline GeoJSON for each area |
| `boardFile`, `evalFile` | File-name patterns. **Set `evalFile` to whatever your trajectory files are actually called** |
| `slots` | The four 6-hour slots |
| `daysBack`, `forecastDays`, `endDate` | How much history and forecast to load |
| `basemaps`, `defaultBasemap` | Satellite (Esri) or dark (CARTO) basemap; `dim` and `fieldAlpha` control contrast |
| `links` | Links in the panel footer |

Health-profile thresholds are in `PROFILES` in `js/foryou.js`. All UI wording is in `js/strings.js`.

## Code map

```
js/config.js    settings (the file you edit)
js/regions.js   areas: grids, places, rankings
js/strings.js   all UI text
js/foryou.js    health profile, saved places, best time, alerts
js/data.js      load + normalise boards/CSV, bicubic & time interpolation
js/aqi.js       US EPA AQI from µg/m³ + EPA colours
js/map.js       canvas slippy map: tiles, AQI field, isolines, path, markers
js/wind.js      wind particles
js/panel.js     side panel, chart, legend, tooltip
js/timeline.js  timeline scrubber
js/demo.js      demo data in the backend's format (one model per area)
js/store.js     safe localStorage wrapper
```

## Data notes

- OpenWeather's `aqi` field is its own **1–5 scale**. The app computes the real US AQI from pollutant concentrations using EPA breakpoints (PM2.5 uses the 2024 revision), then takes the highest sub-index.
- The EPA breakpoints assume specific averaging periods: 24 h for PM, 8 h for O₃ and CO, 1 h for NO₂ and SO₂. The app applies them to the backend's 6-hour means, so say so in the report.
- Kern's county outline is approximate. Drop an official TIGER/Line GeoJSON at `data/kern.geojson` to replace it. City areas have no outline.
- The app's guidance is not medical advice, and the panel footer says so.
