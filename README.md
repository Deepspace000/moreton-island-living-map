# Moreton Island · Living Map

A living 3D map of Moreton Island (Mulgumpin), Queensland. Drag to move, right-drag or two fingers to turn, scroll or pinch to zoom.

- Real relief from the Queensland Government laser survey (bare ground), draped with aerial photography; sharp photo tiles stream in near the view
- The real surveyed seabed under see-through water, with chart-style depth lines, swell, foam, sun glitter and cloud reflections
- 550 real building outlines, the 4WD tracks and walking paths, the Tangalooma and Bulwer wrecks, Cape Moreton lighthouse, the resort jetty, beacons and buoys
- Yachts and cruisers at anchor that swing to the wind, yachts under sail, and the island ferries on their charted routes
- Drifting clouds with shadows, sun, moon (true phase) and stars for the real time of day
- Live weather, swell and tide from Open-Meteo, or set your own with sliders (sunshine, cloud cover and type, wind, rain, fog, swell, tide, lightning)
- Walk mode: press Walk (or double-click a spot) to explore on foot with keyboard and mouse, touch or a gamepad. On a touch screen, hold a finger down to walk forward and slide it sideways to steer (up to run, down to stop or back up); a second finger looks around

Run locally: serve this folder with any static web server (for example `python -m http.server`) and open it in a browser.

## Data and credits

- Aerial photography and elevation (LiDAR terrain and bathymetry): © State of Queensland (Department of Natural Resources and Mines, Manufacturing and Regional and Rural Development), from the Queensland spatial imagery services, made available for public use
- Water colour detail: [Sentinel-2 cloudless](https://s2maps.eu) by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), CC BY 4.0
- Map data: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL
- Weather and marine data: [Open-Meteo](https://open-meteo.com)
- Rendering: [three.js](https://threejs.org) (MIT)

Relief is exaggerated 1.7 times and the seabed comes from a 30 m survey grid refined with water colour, so this is a picture of the island, not a navigation chart.

`tools/fetch.py` and `tools/fetch_qld.py` download the source data, `tools/build_data.py` and `tools/gen_textures.py` turn it into the files in `assets/`.
