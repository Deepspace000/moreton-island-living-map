# Moreton Island Simulator: update note (release 160)

A living 3D map of Moreton Island (Mulgumpin), Queensland, that you can fly over, walk across, drive, sail and dive in. It runs in the browser and, now, as a Windows program of its own. This note says how it was built, stage by stage, and what has just changed.

## How it was built

Everything below was made in order, one round at a time. After each round the result was looked at again, often by a second reader (a "critic") who was asked what still looked wrong, and the worst things were fixed before going on. Most of what is on the island came from the owner's own photographs of it.

**Stage 1: the ground (14 November).** The island's real relief from the Queensland Government laser survey, draped with its aerial photographs; the real seabed under see-through water, with chart-style depth lines; weather you can set by hand (sunshine, cloud, wind, rain, fog, swell, tide, lightning) or take live; sun, moon and stars for the real time of day; walking, with keyboard and mouse, with a finger on a touch screen, or with a gamepad.

**Stage 2: the bush and the shore.** Real tree species drawn crooked, not straight (scribbly gums, bloodwoods, she-oaks, banksias, paperbarks, mangroves, grass trees); a sandy bush floor with dark leaf litter; fern country on the wet flats; Cape Moreton and its lighthouse; the Tangalooma and Bulwer wrecks as rusted hulls along their true outlines; surf, foam and tides that bare wet sand at low water.

**Stage 3: people and things.** Township houses in the island's own styles, placed from the town maps; 4WDs on the beach highways; boats, yachts, ferries and jet skis; walkers, anglers and small camps; signposts only where tracks meet; birds with feathers, fish with scales, turtles, rays, sharks, dolphins, dugongs and whales; diving under the water.

**Stage 4: travelling in it (15 to 16 November).** Tap a 4WD, a boat, a jet ski, a plane or a pelican and go along; take the wheel yourself; the Travel menu; wakes and spray; headlamps at night; the Tangalooma resort and jetty from the owner's photos; the Micat ferry on its timetable; 4WDs that follow the tide, dodge each other and leave wheel ruts.

**Stage 5: every device (17 November).** Works on Safari and iPad (sound on a tap, held-finger menu, finger-sized double taps); on foot, a walking box and a hold-to-walk view; fallen trees that break up when driven into; panels that are windows you can drag and resize; cicadas; only what can be seen is drawn, with a Detail setting (Low, Medium, High) for weaker machines.

**Stage 6: the island's life, and a program of its own (18 November).** Cloud systems (stratus, cirrus); sea life in the shallows and the deep; swell without ghosting; a mini map you can pan; and the Windows version.

## What is new in this update

- **Move the view with the keyboard.** W and S go forward and back the way you are looking, A and D go sideways, Q and E turn, Shift goes faster; the further out you are, the further a key takes you. Riding along as a passenger, A and D turn your head and W and S tilt it. (Driving, flying or walking, the keys work as they always did.)
- **Fourteen new fish**, each built from its own outline and painted to match: tailor and dart in the surf, trevally, jewfish, snapper, sweetlip, cod, Moses perch, tuskfish and morwong round the wrecks and the rocky ground off Cape Moreton, squire over the banks, tarwhine on the sand flats, longtom just under the surface, and the moray eel on the bottom.
- **Eleven more birds.** Five raptors on the wing, each with its own country: ospreys over the bay, brahminy kites along the shore, whistling kites over the heath and dunes, wedge-tailed eagles high over the hills, peregrine falcons about the cape and the cliffs (you can ride any of them). On the sand: far eastern curlews and bar-tailed godwits on the flats of the bay side, pied oystercatchers along every tide line, beach stone-curlews paired at the top of the beach. On the water: black swans on the bay and the lakes, and great cormorants swimming and standing about the sand spits, some with their wings out to dry. All of them call, as the island's soundscape already had their voices.
- **Ten reptiles.** Eastern water dragons on the lake banks, major skinks, land mullets, garden skinks and Burton's legless lizards on the forest floor and heath, carpet pythons on the dunes, green tree snakes, red-bellied black snakes and yellow-faced whipsnakes, and eastern long-necked turtles in the lakes.
- **The mammals.** Northern brown and long-nosed bandicoots, common brushtail and ringtail possums and water rats come out at night (with the swamp wallabies already on the island), and grey-headed flying-foxes and small bats fly at dusk.
- **The island's wildflowers.** Wallum and saw banksias, heathy and beaked parrot peas, wedding bush, devil's rice, showy guinea flower, native sarsaparilla, wallum geebung, mat rush, blue flax lily, cotton trees near the coast, and the weed asparagus fern, planted by habitat across the heath and dunes.
- **Weather and sea.** Weather now drifts by default; bigger swells build faster; S brakes in a vehicle.
- **A Windows program.** The same map as an ordinary Windows program (portable file, installer, or plain folder), in its own window with no browser; it works offline except for the live weather. F11 for full screen.

**Release 160: the Wildlife guide and spotting.** A new Wildlife button in the bar at the bottom opens a guide to the island's life: 79 animals (birds, fish and sharks, other sea life, reptiles, mammals, insects) and 21 trees, wildflowers and shrubs. Each has a picture of the map's own model on a plain backdrop, its name, Latin name, what it is, and where and when to look for it. You can search, filter by group, and step through with the arrow keys. **Spotting:** when an animal comes into view the view turns to it (on foot, or from the map; not while you are driving or riding), a frame with its name comes up round it, and at the same moment the information box and any achievement come up. The frame stays at least 2 seconds, then any key or tap takes it away. The animal is ticked off in the guide; several seen at once come up together ("You have spotted 5 new animals"), grouped by how far off they are. There are 20 achievements (first sighting, bird watcher, every fish, whale watch and others); the guide shows how many you have spotted and which achievements you have. Sharks and dolphins have smaller, triangular dorsal fins. The pictures are made by `tools/test/studio.mjs` and cut by `tools/make_guide_images.py`; the spotting code is `src/spotting.js` and `src/spot.js`. The Windows program also updates itself from the website (see `desktop/README.md`).

## Controls in one place

Drag to move, right-drag or two fingers to turn, scroll or pinch to zoom; W A S D and Q E move and turn the view (Shift is faster); double-click a spot to stand there; double-click a 4WD, boat or bird to go along (H takes the controls); M returns to the map; right-click for a menu; every panel can be dragged and resized.

Credits: terrain, aerial photography and seabed from the Queensland Government's open data; buildings and tracks from OpenStreetMap; satellite images from Sentinel-2; weather from Open-Meteo; and the owner's own photographs of the island.
