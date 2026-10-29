# Upwind: See where your air is coming from

I built Upwind for my Borealis capstone project. It maps air pollution across several California metro areas and shows where pollution may be coming from. You can also check when air quality might be better for spending time outside.

It’s a static front end, so there’s no build step or API key. The only dependency is **D3 v7**, which is included in `vendor/`.

## Run locally

```bash
cd upwind
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

The app uses ES modules, so it needs to run over HTTP. Opening `index.html` directly with `file://` won’t work.

If there are no board files, the app uses demo data in the same format as the backend. The header badge will say **Demo**.

## Areas

I chose these areas using the American Lung Association’s *State of the Air 2026* report ([California press release](https://www.lung.org/media/press-releases/fy26-sota-california)). The numbers are each area’s rank among U.S. metro areas. Los Angeles–Long Beach is left out because it ranks #1 for ozone.

| Area (`?region=`) | Ozone | Short-term PM | Year-round PM | Grid centres (0–360 lon) | Data folders |
|---|---:|---:|---:|---|---|
| Bakersfield / Kern (`kern`) | #3 | #3 | **#1** | lon 239.75–242.25, lat 34.75–35.75 (11×5) | `board_archive2/`, `forecast/` |
| Visalia (`visalia`) | **#2** | #5 | #5 (tie) | lon 240.25–241.25, lat 35.75–36.75 (5×5) | `cities/visalia/…` |
| Fresno (`fresno`) | #5 | #6 | #4 | lon 239.75–240.75, lat 36.25–37.25 (5×5) | `cities/fresno/…` |
| San Diego (`sandiego`) | #7 | — | #5 (tie) | lon 242.5–243.5, lat 32.5–33.5 (5×5) | `cities/sandiego/…` |
| El Centro (`elcentro`) | #10 | #14 | #21 | lon 244.0–245.0, lat 32.5–33.5 (5×5) | `cities/elcentro/…` |

### Backend data

Run the existing OpenWeather, Aurora, and pathfinder pipeline for each area using the latitude and longitude ranges above. Save the output to `cities/<id>/board_archive/` and `cities/<id>/forecast/`, using the same file names as Kern. All grids use the backend’s existing 0.25° lattice.

To add or remove an area, update `REGIONS` and `ORDER` in `js/regions.js`, and `regions` in `js/config.js`.

## Features

- **City picker:** Browse the areas and their national rankings. The *Why this city* card explains the rankings.
- **My location:** Use GPS to jump to your grid cell. If you’re outside the selected area, the app will let you know.
- **Saved places:** Save up to six places per area. They’re stored in `localStorage`, and the app opens to the first saved place.
- **Incoming pollution alerts:** The app checks the next 24 hours of forecast boards and trajectories. If AQI at your location is expected to get meaningfully worse and a predicted path passes nearby, it shows an alert like *“Pollution is heading your way (origin: …)”*.
- **Best time outside:** See the next five 6-hour slots, rated Good, Limit, or Avoid for one of three health profiles: Everyone, Sensitive groups, or Outdoor workers. Each slot includes a short tip.

The map also has a smooth AQI field, wind particles, animated pollution paths, a playback timeline, and satellite or dark basemaps.

## Configuration (`js/config.js`)

| Key | What it does |
|---|---|
| `appName` | Name in the header and browser tab |
| `regions.<id>` | Data folders and optional official outline GeoJSON for each area |
| `boardFile`, `evalFile` | File-name patterns. Set `evalFile` to match the names of your trajectory files. |
| `slots` | The four 6-hour slots |
| `daysBack`, `forecastDays`, `endDate` | How much history and forecast data to load |
| `basemaps`, `defaultBasemap` | Satellite (Esri) or dark (CARTO) basemap; `dim` and `fieldAlpha` control contrast |
| `links` | Links in the panel footer |

Health-profile thresholds are in `PROFILES` in `js/foryou.js`. UI text is in `js/strings.js`.

## Code map

```text
js/config.js    settings
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

- OpenWeather’s `aqi` field uses its own **1–5 scale**. The app calculates U.S. AQI from pollutant concentrations using EPA breakpoints, including the 2024 revision for PM2.5, then uses the highest sub-index.
- EPA breakpoints assume specific averaging periods: 24 hours for PM, 8 hours for O₃ and CO, and 1 hour for NO₂ and SO₂. The app applies them to the backend’s 6-hour means, so mention that in your report.
- Kern’s county outline is approximate. To use an official one, add a TIGER/Line GeoJSON file at `data/kern.geojson`. The other city areas don’t have outlines.
- The guidance in the app isn’t medical advice. That note is in the panel footer.
