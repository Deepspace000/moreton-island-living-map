import { seen } from './spot.js';
// The Wildlife guide: every animal in the map, with a picture (assets/guide/<id>.jpg, then <id>_2.jpg and so on), what it is, and where
// and when to look for it. The pictures are studio renders of the map's own models (tools/make_guide_images.py).
// Each entry: [id, name, latin name, group, number of pictures, what it is, where in the map (and when)]
const G = [
  // ---- birds
  ['pelican', 'Australian Pelican', 'Pelecanus conspicillatus', 'birds', 4, 'A huge white bird with black wings and the longest bill of any bird. It scoops fish into its pouch, and glides low over the water on very wide wings.', 'Flying in lines along the bay shore, floating by the resort jetty, and standing in groups on the sand spits of the sheltered side.'],
  ['seaeagle', 'White-bellied Sea-Eagle', 'Haliaeetus leucogaster', 'birds', 3, 'A big white and grey eagle of the coast. It soars on flat wings and snatches fish, turtles and sea snakes from the water.', 'Soaring high over the headlands and wooded hills, singly or in pairs. A pair sits in a dead tree at a few places round the island.'],
  ['osprey', 'Osprey', 'Pandion haliaetus', 'birds', 2, 'A white-headed fish hunter with a dark stripe through the eye. It hovers, then dives feet first and grabs fish near the surface.', 'Fishing over the bay, by day.'],
  ['brahminy', 'Brahminy Kite', 'Haliastur indus', 'birds', 2, 'Chestnut brown with a clean white head and breast. It cruises along the coast and takes dead fish, crabs and other food from the water and the shore.', 'Over the shore, by day.'],
  ['whistling', 'Whistling Kite', 'Haliastur sphenurus', 'birds', 2, 'A pale sandy-brown kite with long wings. It is named for its loud, ringing whistle. It soars looking for small animals and carrion.', 'Over the heath and the dunes, by day.'],
  ['wedgetail', 'Wedge-tailed Eagle', 'Aquila audax', 'birds', 2, 'Australia’s largest bird of prey, with wings over two metres across and a long wedge-shaped tail. It soars high on warm air and watches the ground.', 'High over the hills, by day.'],
  ['peregrine', 'Peregrine Falcon', 'Falco peregrinus', 'birds', 2, 'The fastest animal in the world, reaching about 300 km/h in a dive. It has a dark hood and a pale throat, and it strikes other birds in mid-air.', 'About the cape and the cliffs, by day.'],
  ['silvergull', 'Silver Gull', 'Chroicocephalus novaehollandiae', 'birds', 2, 'A small white gull with a grey back, a red bill and red legs. It eats almost anything and is bold around people.', 'In flocks on the beaches, beside the Micat landing and over every settlement.'],
  ['cresttern', 'Crested Tern', 'Thalasseus bergii', 'birds', 2, 'A slim sea bird with a shaggy black cap and a yellow bill. It dives headfirst for small fish.', 'Over the settlements, the wrecks and the headlands.'],
  ['cormorant', 'Little Black Cormorant', 'Phalacrocorax sulcirostris', 'birds', 1, 'A slim black diving bird. It swims low in the water and chases fish underwater.', 'Flying fast and low over the water by the resort and the wrecks, and swimming near the jetty.'],
  ['greatcormorant', 'Great Cormorant', 'Phalacrocorax carbo', 'birds', 3, 'A big black diving bird. It swims low in the water, chases fish underwater, then stands with its wings open to dry, because its feathers soak up water.', 'Standing about the sand spits, and swimming in the bay.'],
  ['swan', 'Black Swan', 'Cygnus atratus', 'birds', 2, 'Black all over, with a red bill and a long curved neck. The wing feathers are white and show in flight.', 'On the sheltered water of the bay and on the lakes.'],
  ['curlew', 'Far Eastern Curlew', 'Numenius madagascariensis', 'birds', 2, 'The largest shorebird in the world. Its bill is long and curves down, made for reaching crabs in deep mud burrows. It arrives from Siberia and feeds at low tide.', 'On the flats of the bay side.'],
  ['godwit', 'Bar-tailed Godwit', 'Limosa lapponica', 'birds', 2, 'A long-legged wader with a slightly upturned bill. It flies non-stop from Alaska to Australia, about 11,000 km, and probes the wet sand for worms.', 'On the flats of the bay side.'],
  ['stonecurlew', 'Beach Stone-curlew', 'Esacus magnirostris', 'birds', 2, 'A big-eyed, heavy-billed beach bird that is mostly active at night. By day it stands still and hard to see on the sand. It lays its single egg straight on the beach.', 'In pairs at the top of the beach. Look for them at night.'],
  ['oystercatcher', 'Pied Oystercatcher', 'Haematopus longirostris', 'birds', 2, 'Black above and white below, with a bright orange bill and pink legs. It uses the bill to prise open shellfish and worms on the sand and rocks.', 'Along every tide line, in pairs.'],
  // ---- fish and sharks
  ['bream', 'Yellowfin Bream', 'Acanthopagrus australis', 'fish', 1, 'A silver fish with a darker back and yellow lower fins. It feeds on shellfish and crabs around reefs and wrecks.', 'Round every wreck and reef, in schools.'],
  ['sergeant', 'Sergeant Major', 'Abudefduf vaigiensis', 'fish', 1, 'A pale blue-silver reef fish with five black bars and a yellow back. It stays close to rocks and wrecks.', 'Close in round the wrecks and the rocky reefs.'],
  ['neon', 'Neon Damselfish', 'Pomacentrus coelestis', 'fish', 1, 'A small electric-blue fish with a yellow tail end. It lives in clouds over the reef.', 'In blue clouds over the wrecks.'],
  ['humbug', 'Humbug Damselfish', 'Dascyllus aruanus', 'fish', 1, 'A small white fish with three black bars. It hovers close to coral and wreckage and darts in when frightened.', 'Hanging over the plates of the wrecks.'],
  ['baitfish', 'Baitfish', 'Spratelloides spp.', 'fish', 1, 'A small, slim, blue-green and silver fish that lives in tight schools. Almost every larger fish eats them.', 'In clouds over the wrecks.'],
  ['hardyhead', 'Hardyhead', 'Atherinidae', 'fish', 1, 'A tiny silver fish, only a few centimetres long. It lives in big schools in the shallows.', 'In schools in the shallows and over the banks, all round the island.'],
  ['whiting', 'Sand Whiting', 'Sillago ciliata', 'fish', 1, 'A slim, sand-coloured fish. It works the edge of the beach in schools, in water barely knee deep.', 'Along the edge of the beaches.'],
  ['flathead', 'Dusky Flathead', 'Platycephalus fuscus', 'fish', 1, 'A flat, mottled brown fish that lies on the sand with only its eyes showing and ambushes small fish.', 'Lying on the sand in the lagoons and the sheltered shallows.'],
  ['tailor', 'Tailor', 'Pomatomus saltatrix', 'fish', 1, 'A silver-blue schooling fish with razor-sharp teeth. It hunts smaller fish in the surf and is a favourite catch from the ocean beaches.', 'Hunting the gutters of the surf beaches.'],
  ['dart', 'Dart', 'Trachinotus spp.', 'fish', 1, 'A silver surf fish with a dark spot behind the gill and a yellow-edged tail. It feeds in the gutters between sand banks.', 'In the white water of the surf beaches.'],
  ['trevally', 'Trevally', 'Pseudocaranx georgianus', 'fish', 1, 'A deep-bodied silver fish with yellowish fins and a forked tail. It swims in schools over sand and reef edges.', 'Round the wrecks and over the deeper banks.'],
  ['jewfish', 'Jewfish', 'Argyrosomus japonicus', 'fish', 1, 'A large silvery-bronze fish, also called mulloway. It grunts loudly and waits near gutters, wrecks and river mouths.', 'Round the wrecks, over the deeper holes and off Cape Moreton.'],
  ['longtom', 'Longtom', 'Tylosurus spp.', 'fish', 1, 'A long slim fish with needle-like jaws full of teeth. It lies near the surface and darts at small fish.', 'Just under the surface.'],
  ['tarwhine', 'Tarwhine', 'Rhabdosargus sarba', 'fish', 1, 'A silver bream with thin golden lines along its sides. It grazes around rocks, weed and sandy flats.', 'Over the sand flats.'],
  ['snapper', 'Snapper', 'Chrysophrys auratus', 'fish', 1, 'A pink-red fish with blue spots. Older fish grow a bump on the forehead. It feeds on shellfish and crabs over reef and rubble.', 'Round the wrecks and over the deeper banks.'],
  ['squire', 'Squire', 'Chrysophrys auratus (young)', 'fish', 1, 'The young snapper. It is paler pink with bright blue dots, and it stays in shallower bays and reefs.', 'Round the wrecks and in the shallows.'],
  ['sweetlip', 'Sweetlip', 'Lethrinidae', 'fish', 1, 'A reef fish with thick lips and a strong sloping head. It searches the sand beside coral and rock for crabs and shells.', 'Round the wrecks and on the rocky ground off Cape Moreton.'],
  ['cod', 'Cod', 'Epinephelus spp.', 'fish', 1, 'A heavy-mouthed, mottled brown reef fish with dark bars. It waits in holes and ledges and swallows prey whole.', 'Lying on the bottom among the wrecks and rocks.'],
  ['moses', 'Moses Perch', 'Lutjanus russelli', 'fish', 1, 'A pale silvery perch with a black spot high on its side. It shelters around reefs and rocky bays.', 'Round the wrecks.'],
  ['tusk', 'Tuskfish', 'Choerodon spp.', 'fish', 1, 'A colourful wrasse with blue-green scales, orange dots and a bright tail. Its front teeth stick out like tusks and crack open shells.', 'Round the wrecks and off Cape Moreton.'],
  ['morwong', 'Morwong', 'Cheilodactylus spp.', 'fish', 1, 'A reef fish with thick lips and a long, trailing pectoral fin. It picks food from the rocks.', 'Round the wrecks and the rocks off Cape Moreton.'],
  ['moray', 'Moray Eel', 'Gymnothorax spp.', 'fish', 1, 'A spotted, snake-shaped fish with no pectoral fins. It lives in holes in the reef and comes out at night.', 'Among the wrecks and the rocks off Cape Moreton.'],
  ['whaler', 'Whaler Shark', 'Carcharhinus spp.', 'fish', 1, 'A grey shark about two metres long. It patrols the shallows and the wrecks, and comes in over the flats at high tide.', 'Patrolling the shallows and the wrecks.'],
  ['tigershark', 'Tiger Shark', 'Galeocerdo cuvier', 'fish', 1, 'A big shark, three or four metres long, with a blunt snout. It eats almost anything.', 'Cruising well below the surface in deeper water.'],
  // ---- sea animals
  ['dolphin', 'Bottlenose Dolphin', 'Tursiops truncatus', 'sea', 1, 'A grey, playful dolphin that lives in pods. It leaps, rides boat wakes and hunts fish together.', 'A pod keeps to the water off the Tangalooma jetty. Others range the bay side.'],
  ['dugong', 'Dugong', 'Dugong dugon', 'sea', 1, 'A slow, round-bodied sea mammal that grazes on seagrass. It is related to the manatee and has a whale-like tail.', 'Grazing the seagrass on the sheltered banks west and south of the island.'],
  ['humpback', 'Humpback Whale', 'Megaptera novaeangliae', 'sea', 1, 'A huge whale with long white flippers. It travels past Cape Moreton from June to November, and mothers swim with their calves.', 'Out in deep water, most of all off the open eastern side and the north.'],
  ['greenturtle', 'Green Turtle', 'Chelonia mydas', 'sea', 1, 'A large sea turtle with a smooth, olive-brown shell. It grazes on seagrass and comes up to breathe.', 'Over the seagrass on the bay side. Now and then one comes in over the flats.'],
  ['maskray', 'Bluespotted Maskray', 'Neotrygon kuhlii', 'sea', 1, 'A sandy-brown stingray covered in bright blue spots, with a dark band across the eyes. It lies half-buried in the sand.', 'Over the sand in shallow water, near the wrecks and beside the beaches. More come in when the tide is low.'],
  ['shovelnose', 'Shovelnose Ray', 'Glaucostegus typus', 'sea', 1, 'A flat, shark-shaped ray with a pointed snout and pale spots. It cruises and rests on the sand.', 'On the sand flats.'],
  ['jellyfish', 'Jellyfish', 'Scyphozoa', 'sea', 1, 'A pale blue bell that opens and closes to swim, with arms that trail behind. It drifts with the current.', 'In swarms on the bay side.'],
  ['sandcrab', 'Sand Crab', 'Portunidae', 'sea', 1, 'A pale sandy crab that scuttles sideways, then stops, with its claws held out.', 'On the sea bed round the wrecks and reefs.'],
  ['bluecrab', 'Blue Swimmer Crab', 'Portunus armatus', 'sea', 1, 'A blue-grey crab with paddle-shaped back legs. It swims well and buries itself in the sand.', 'On the sea bed round the wrecks and reefs.'],
  ['rockcrab', 'Rock Crab', 'Grapsidae', 'sea', 1, 'A red-brown crab that hides among rocks and runs sideways when disturbed.', 'On the sea bed round the wrecks and reefs.'],
  ['octopus', 'Octopus', 'Octopus spp.', 'sea', 1, 'A soft round animal with eight arms. It crawls over the sea bed, waves its arms and changes colour as it goes.', 'Crawling on the sea bed round the wrecks and reefs.'],
  // ---- reptiles
  ['waterdragon', 'Eastern Water Dragon', 'Intellagama lesueurii', 'reptiles', 1, 'A banded green lizard with a long tail and strong legs. It basks near water and dives in when startled.', 'On the banks of the lakes.'],
  ['majorskink', 'Major Skink', 'Bellatorias frerei', 'reptiles', 1, 'A big, stocky skink with smooth, glossy scales. It shelters in logs and rock crevices and eats insects, snails and fruit.', 'In the forest.'],
  ['landmullet', 'Land Mullet', 'Bellatorias major', 'reptiles', 1, 'The largest skink in Australia. It is dark and heavy, and it lives in burrows among rocks and tree roots.', 'In the forest and on the heath.'],
  ['gardenskink', 'Garden Skink', 'Lampropholis guichenoti', 'reptiles', 1, 'A small, quick brown skink. It darts across leaf litter and sunny paths and eats tiny insects.', 'On open ground, in the sun.'],
  ['bluetongue', 'Blue-tongued Skink', 'Tiliqua scincoides', 'reptiles', 1, 'A thick-bodied, banded skink with a blue tongue that it flashes at threats. It sits still, then darts.', 'Between the bushes.'],
  ['goanna', 'Goanna', 'Varanus varius', 'reptiles', 1, 'A large monitor lizard, black with pale bands. It walks the sand between the bushes and climbs trees when alarmed.', 'Walking the sand between the bushes.'],
  ['legless', 'Legless Lizard', 'Pygopodidae', 'reptiles', 1, 'A lizard with no front legs and only small flaps for hind legs. It looks like a snake but has ears and a flat tongue.', 'On the heath.'],
  ['python', 'Carpet Python', 'Morelia spilota', 'reptiles', 1, 'A strong, patterned constrictor. It rests in trees and hunts small mammals and birds at night.', 'On the dunes and in the forest.'],
  ['treesnake', 'Green Tree Snake', 'Dendrelaphis punctulatus', 'reptiles', 1, 'A slim, fast, harmless snake that is olive above and cream below. It climbs well and eats frogs.', 'In the forest.'],
  ['blacksnake', 'Red-bellied Black Snake', 'Pseudechis porphyriacus', 'reptiles', 1, 'A glossy black snake with a red belly and sides. It is shy, stays near water, and feeds on frogs and lizards.', 'On the heath and along the lake banks.'],
  ['whipsnake', 'Whipsnake', 'Demansia spp.', 'reptiles', 1, 'A thin, very fast snake with big eyes and a pale face. It hunts lizards in the daytime.', 'On the heath.'],
  ['turtle', 'Eastern Long-necked Turtle', 'Chelodina longicollis', 'reptiles', 1, 'A freshwater turtle with a neck as long as its shell. It strikes sideways at small fish and tadpoles.', 'In the lakes.'],
  // ---- mammals
  ['wallaby', 'Swamp Wallaby', 'Wallabia bicolor', 'mammals', 1, 'A dark, shy wallaby with a rusty belly. It rests in thick scrub by day and hops between its feeding places.', 'In the scrub, in small numbers.'],
  ['bandicoot', 'Northern Brown Bandicoot', 'Isoodon macrourus', 'mammals', 1, 'A small pointed-nosed marsupial. It digs cone-shaped holes in the ground for insects and roots.', 'On the heath, at night.'],
  ['longnose', 'Long-nosed Bandicoot', 'Perameles nasuta', 'mammals', 1, 'A grey-brown bandicoot with a long snout and big ears. It forages in leaf litter and leaves neat pits in the soil.', 'In the forest, at night.'],
  ['brushtail', 'Common Brushtail Possum', 'Trichosurus vulpecula', 'mammals', 1, 'A grey possum with a bushy tail and pointed ears. It sleeps in hollows by day and feeds on leaves and fruit at night.', 'In the forest, near the settlements, at night.'],
  ['ringtail', 'Common Ringtail Possum', 'Pseudocheirus peregrinus', 'mammals', 1, 'A small possum with a thin tail that curls at the tip and ends in a white point. It climbs through shrubs eating leaves.', 'In the forest, at night.'],
  ['waterrat', 'Water Rat (Rakali)', 'Hydromys chrysogaster', 'mammals', 1, 'A sleek swimming rodent with a white-tipped tail and webbed hind feet. It hunts yabbies, fish and mussels along creeks and lakes.', 'Along the lake banks, at night.'],
  ['flyingfox', 'Grey-headed Flying-fox', 'Pteropus poliocephalus', 'mammals', 2, 'A large fruit bat with a grey head and a reddish collar. It flies out at dusk to feed on blossom and fruit.', 'Flying in loose lines over the bay and the forest at dusk and after dark.'],
  ['microbat', 'Insect Bat', 'Microchiroptera', 'mammals', 2, 'A small bat that flies fast and twists in the air to catch insects. It finds them by echo.', 'About the lights at night.'],
  // ---- insects
  ['bluetiger', 'Blue Tiger', 'Tirumala hamata', 'insects', 1, 'A black butterfly streaked with pale blue. It flies slowly and often visits flowers.', 'Over the heath and the forest edge, by day, out of the rain.'],
  ['crow', 'Common Crow', 'Euploea core', 'insects', 1, 'A dark brown butterfly with white spots along the wing edges. It glides slowly and is poisonous to birds.', 'Over the heath and the forest edge, by day, out of the rain.'],
  ['brown', 'Common Brown', 'Heteronympha merope', 'insects', 1, 'An orange and brown butterfly that flies low through grass and bush.', 'Over the heath and the forest edge, by day, out of the rain.'],
  ['grassblue', 'Common Grass-blue', 'Zizina labradus', 'insects', 1, 'A tiny pale blue butterfly that keeps low over the grass.', 'Over the heath, low, by day.'],
  ['darner', 'Wallum Darner', 'Austroaeschna', 'insects', 1, 'A large brown dragonfly with clear wings. It hangs in the air, then darts away.', 'Over the low, wet country, by day.'],
  ['aussietiger', 'Australian Tiger', 'Ictinogomphus australis', 'insects', 1, 'A yellow and black dragonfly. It perches on reeds and flies out to catch smaller insects.', 'Over the low, wet country, by day.'],
  ['hawker', 'Blue-spotted Hawker', 'Adversaeschna brevistyla', 'insects', 1, 'A dragonfly with bright blue spots along its body. It patrols a stretch of water and hunts in flight.', 'Over the low, wet country, by day.'],
  ['midges', 'Midges', 'Chironomidae', 'insects', 0, 'Tiny flies that hang in clouds in still air. They are too small to see well, so they have no picture.', 'In clouds between the bushes, on still days.'],
  // ---- trees
  ['eucalypt', 'Scribbly Gum and Bloodwood', 'Eucalyptus signata, Corymbia intermedia', 'trees', 1, 'The tall eucalypts of the dune forest. Scribbly gums have smooth pale bark marked with the looping tracks of moth larvae. Bloodwoods have rough bark that bleeds red sap.', 'The commonest tree in the forest on the dunes and hills.'],
  ['sheoak', 'Forest She-oak', 'Allocasuarina torulosa', 'trees', 1, 'A slender tree with drooping, needle-like branchlets that sigh in the wind. Black cockatoos feed on its cones.', 'In the forest, and as coastal she-oaks behind the beaches.'],
  ['banksia', 'Coast Banksia', 'Banksia integrifolia', 'trees', 1, 'A gnarled tree with dark green leaves, silver underneath, and pale yellow flower spikes full of nectar.', 'Behind the beaches, on the headlands and across the cape, where the wind shapes it.'],
  ['paperbark', 'Paperbark', 'Melaleuca quinquenervia', 'trees', 1, 'A tree with thick white bark that peels in papery layers. It stands in swampy ground and flowers in cream bottlebrushes.', 'On the low wet flats.'],
  ['mangrove', 'Grey Mangrove', 'Avicennia marina', 'trees', 1, 'A coastal tree that grows in salty mud. Pencil-like roots stick up out of the mud so that it can breathe.', 'At the tide line, and in clumps in the shallows on the sheltered south-western shore.'],
  ['grasstree', 'Grass Tree', 'Xanthorrhoea johnsonii', 'trees', 1, 'A slow-growing plant with a black trunk and a ball of long wiry leaves, with a skirt of dead ones below. A tall flower spike comes up after fire.', 'On the heath and under open forest, in clumps.'],
  ['coconutpalm', 'Coconut Palm', 'Cocos nucifera', 'trees', 1, 'A tall palm with a curved, ringed trunk and a head of long arching fronds.', 'Around the resort and the villages.'],
  ['pandanus', 'Pandanus (Screw Pine)', 'Pandanus tectorius', 'trees', 1, 'A short tree standing on stilt-like prop roots, with long spiky leaves in tufts at the ends of its branches.', 'On the dunes just behind the beaches.'],
  // ---- wildflowers and shrubs
  ['wallumbanksia', 'Wallum Banksia', 'Banksia aemula', 'plants', 1, 'A gnarled, many-limbed small tree with stiff, dark, toothed leaves and golden flower cones that stand up from the ends of the twigs.', 'On the dunes and the heath.'],
  ['sawbanksia', 'Saw Banksia', 'Banksia serrata', 'plants', 1, 'The same build as the wallum banksia, with lighter saw-edged leaves, grey-green flower spikes and fat grey woody cones.', 'On the dunes and the heath.'],
  ['heathyparrotpea', 'Heathy Parrot-pea', 'Dillwynia retorta', 'plants', 1, 'A low wiry shrub with fine needle leaves and orange-yellow pea flowers with a red keel, scattered along the stems.', 'On the heath.'],
  ['beakedparrotpea', 'Beaked Parrot-pea', '', 'plants', 1, 'A heath shrub with stiff leaves and clusters of yellow and orange flowers at the tips of the stems.', 'On the heath.'],
  ['weddingbush', 'Wedding Bush', 'Ricinocarpos pinifolius', 'plants', 1, 'A tall, slim shrub with fine needle leaves and masses of small white five-petalled flowers.', 'On the heath and the dunes.'],
  ['devilsrice', 'Devil’s Rice', '', 'plants', 1, 'A rounded shrub with thin grey-green leaves and loose, branched heads of small cream-white flowers.', 'On the heath.'],
  ['guineaflower', 'Showy Guinea Flower', 'Hibbertia', 'plants', 1, 'A low spreading shrub with bright yellow flowers like small buttercups.', 'On the heath and the dune edges.'],
  ['sarsaparilla', 'Native Sarsaparilla', 'Hardenbergia violacea', 'plants', 1, 'A twining vine that climbs over a tangle of its own stems. It has glossy leaves of three leaflets and hanging sprays of purple pea flowers.', 'In the forest and over shrubs.'],
  ['geebung', 'Wallum Geebung', 'Persoonia', 'plants', 1, 'A small shrub with narrow pointed leaves in whorls and small yellow tubular flowers.', 'On the heath.'],
  ['matrush', 'Mat Rush', 'Lomandra longifolia', 'plants', 1, 'A dense clump of long strap-like leaves that arch over, tan at the tips. Some plants carry a branching head of cream flowers.', 'In the forest and on the heath.'],
  ['blueflaxlily', 'Blue Flax Lily', 'Dianella caerulea', 'plants', 1, 'A fan of upright strap leaves with a branching spray of small blue-violet flowers, followed by shining blue berries.', 'In the forest.'],
  ['cottontree', 'Cotton Tree', 'Hibiscus tiliaceus', 'plants', 1, 'A spreading coastal tree with a leaning trunk, heart-shaped leaves in layers, and big yellow hibiscus flowers with a dark eye.', 'Along the back of the beaches.'],
  ['asparagusfern', 'Asparagus Fern (a weed)', 'Asparagus aethiopicus', 'plants', 1, 'An invasive weed: a sprawling mound of arching green stems with feathery tufts and small red berries. It smothers native plants.', 'Where gardens meet the bush.'],
];
export const GROUPS = [['all', 'All'], ['birds', 'Birds'], ['fish', 'Fish and sharks'], ['sea', 'Other sea life'], ['reptiles', 'Reptiles'], ['mammals', 'Mammals'], ['insects', 'Insects'], ['trees', 'Trees'], ['plants', 'Wildflowers and shrubs']];
export const GUIDE = G.map(([id, name, latin, group, n, text, where]) => ({ id, name, latin, group, n, text, where }));

// ---------- spotting: an animal counts as spotted when you have seen it in the map (spotting.js); plants and trees are only listed ----------
export const ANIMALS = GUIDE.filter(a => a.group !== 'trees' && a.group !== 'plants');
const inGroup = (g) => ANIMALS.filter(a => a.group === g);
export const counts = () => { const c = { total: 0, max: ANIMALS.length }; for (const g of ['birds', 'fish', 'sea', 'reptiles', 'mammals', 'insects']) { c[g] = inGroup(g).filter(a => seen.has(a.id)).length; c[g + 'Max'] = inGroup(g).length; } c.total = ANIMALS.filter(a => seen.has(a.id)).length; return c; };
// [id, title, what to do, test]
export const ACH = [
  ['first', 'First sighting', 'Spot your first animal', (c) => c.total >= 1],
  ['ten', 'Getting your eye in', 'Spot 10 different animals', (c) => c.total >= 10],
  ['twentyfive', 'Naturalist', 'Spot 25 different animals', (c) => c.total >= 25],
  ['fifty', 'Field expert', 'Spot 50 different animals', (c) => c.total >= 50],
  ['all', 'The whole island', 'Spot every animal in the guide', (c) => c.total >= c.max],
  ['birds5', 'Bird watcher', 'Spot 5 kinds of bird', (c) => c.birds >= 5],
  ['birdsall', 'Every bird', 'Spot every bird', (c) => c.birds >= c.birdsMax],
  ['fish10', 'Sharp-eyed angler', 'Spot 10 kinds of fish', (c) => c.fish >= 10],
  ['fishall', 'Every fish', 'Spot every fish and shark', (c) => c.fish >= c.fishMax],
  ['sea5', 'Sea watcher', 'Spot 5 kinds of other sea life', (c) => c.sea >= 5],
  ['seaall', 'Everything in the water', 'Spot all the other sea life', (c) => c.sea >= c.seaMax],
  ['rept5', 'Reptile spotter', 'Spot 5 reptiles', (c) => c.reptiles >= 5],
  ['reptall', 'Every reptile', 'Spot every reptile', (c) => c.reptiles >= c.reptilesMax],
  ['mam4', 'Night walker', 'Spot 4 mammals', (c) => c.mammals >= 4],
  ['mamall', 'Every mammal', 'Spot every mammal', (c) => c.mammals >= c.mammalsMax],
  ['insall', 'Bug hunter', 'Spot every insect', (c) => c.insects >= c.insectsMax],
  ['whale', 'Whale watch', 'Spot a humpback whale', () => seen.has('humpback')],
  ['dugong', 'Sea cow', 'Spot a dugong', () => seen.has('dugong')],
  ['peregrine', 'Fastest animal on earth', 'Spot a peregrine falcon', () => seen.has('peregrine')],
  ['shark', 'Shark!', 'Spot a shark', () => seen.has('whaler') || seen.has('tigershark')],
];

// ---------- the panel: a grid of the entries, search and group buttons; a tap on one opens its page ----------
export function makeGuide() {
  const root = document.getElementById('guide'), grid = root.querySelector('.gd-grid'), page = root.querySelector('.gd-page'), search = root.querySelector('.gd-search'), chips = root.querySelector('.gd-chips'), count = root.querySelector('.gd-count'), prog = root.querySelector('.gd-prog');
  let group = 'all', open = null, shown = [];
  const src = (id, k) => 'assets/guide/' + id + (k > 1 ? '_' + k : '') + '.jpg';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const isAnimal = (a) => a.group !== 'trees' && a.group !== 'plants';
  // An animal you have not spotted yet keeps its secrets: its picture is blurred, its name and Latin name, what it is and where to look are
  // hidden (only its group shows), and a search does not find it by them. Trees and plants are not spotted, so they are always shown.
  const hidden = (a) => isAnimal(a) && !seen.has(a.id);
  const groupName = (a) => (GROUPS.find(g => g[0] === a.group) || [0, a.group])[1];
  chips.innerHTML = [...GROUPS, ['new', 'Not seen yet']].map(([k, t]) => `<button data-g="${k}" class="${k === 'all' ? 'on' : ''}">${t}</button>`).join('') + '<button data-g="ach" class="gd-achbtn">Achievements</button>';
  function head() { const c = counts(); prog.innerHTML = `Spotted <b>${c.total}</b> of ${c.max} animals<i style="width:${Math.round(100 * c.total / c.max)}%"></i>`; }
  function draw() {
    const q = search.value.trim().toLowerCase();
    shown = GUIDE.filter(a => (group === 'all' || a.group === group || (group === 'new' && isAnimal(a) && !seen.has(a.id))) && (!q || (hidden(a) ? '' : a.name + ' ' + a.latin + ' ' + a.where).toLowerCase().includes(q)));
    grid.innerHTML = shown.map(a => { const st = isAnimal(a) ? (seen.has(a.id) ? ' seen' : ' unseen') : ''; return `<button class="gd-card${st}" data-id="${a.id}">${a.n ? `<img loading="lazy" alt="" src="${src(a.id, 1)}">` : '<span class="gd-none">no picture</span>'}<b>${hidden(a) ? '???' : esc(a.name)}</b><i>${hidden(a) ? esc(groupName(a)) : esc(a.latin || ' ')}</i>${st ? `<em>${st === ' seen' ? 'Spotted' : 'Not seen yet'}</em>` : ''}</button>`; }).join('') || '<p class="gd-empty">Nothing matches that.</p>';
    count.textContent = shown.length + (shown.length === 1 ? ' entry' : ' entries'); head();
  }
  function show(id) {
    const a = GUIDE.find(x => x.id === id); if (!a) return; open = a;
    const st = isAnimal(a) ? (seen.has(a.id) ? '<span class="gd-tag seen">Spotted</span>' : '<span class="gd-tag">Not seen yet</span>') : '';
    page.innerHTML = `<div class="gd-top"><button class="gd-back">← All entries</button><span class="gd-nav"><button class="gd-prev" title="Previous">‹</button><button class="gd-next" title="Next">›</button></span></div>` +
      (a.n ? `<div class="gd-pic${hidden(a) ? ' unseen' : ''}"><img alt="${hidden(a) ? '' : esc(a.name)}" src="${src(a.id, 1)}"></div>` + (a.n > 1 ? `<div class="gd-thumbs${hidden(a) ? ' unseen' : ''}">${Array.from({ length: a.n }, (_, k) => `<button data-k="${k + 1}" class="${k ? '' : 'on'}"><img alt="" src="${src(a.id, k + 1)}"></button>`).join('')}</div>` : '') : '') +
      (hidden(a) ? `<h3>??? ${st}</h3><p class="gd-latin">${esc(groupName(a))}</p><p>You have not spotted this one yet. Its name, and what it is, show here once you have.</p>`
        : `<h3>${esc(a.name)} ${st}</h3>${a.latin ? `<p class="gd-latin">${esc(a.latin)}</p>` : ''}<p>${esc(a.text)}</p><p class="gd-where"><b>In the map</b> ${esc(a.where)}</p>`);
    page.hidden = false; grid.parentElement.hidden = true; page.scrollTop = 0;
  }
  function achievements() {
    const got = seen.ach();
    page.innerHTML = `<div class="gd-top"><button class="gd-back">← All entries</button></div><h3>Achievements</h3><p class="gd-latin">${ACH.filter(a => got[a[0]]).length} of ${ACH.length} unlocked</p><div class="gd-ach">` +
      ACH.map(([id, t, d]) => `<div class="${got[id] ? 'got' : ''}"><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join('') + '</div>';
    open = null; page.hidden = false; grid.parentElement.hidden = true; page.scrollTop = 0;
  }
  function list() { page.hidden = true; grid.parentElement.hidden = false; open = null; draw(); }
  function step(d) { if (!open || !shown.length) return; const i = (shown.findIndex(x => x.id === open.id) + d + shown.length) % shown.length; show(shown[i].id); }
  grid.addEventListener('click', (e) => { const b = e.target.closest('.gd-card'); if (b) show(b.dataset.id); });
  chips.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.g === 'ach') return achievements(); group = b.dataset.g; for (const c of chips.children) c.classList.toggle('on', c === b); if (!page.hidden) list(); else draw(); });
  search.addEventListener('input', () => { if (!page.hidden) list(); else draw(); });
  page.addEventListener('click', (e) => {
    if (e.target.closest('.gd-back')) return list();
    if (e.target.closest('.gd-prev')) return step(-1); if (e.target.closest('.gd-next')) return step(1);
    const t = e.target.closest('.gd-thumbs button'); if (t && open) { page.querySelector('.gd-pic img').src = src(open.id, +t.dataset.k); for (const c of t.parentElement.children) c.classList.toggle('on', c === t); }
  });
  // the map behind must not hear the keys, the wheel or the taps made on the guide
  for (const ev of ['pointerdown', 'pointerup', 'wheel', 'touchstart', 'touchmove', 'contextmenu']) root.addEventListener(ev, (e) => e.stopPropagation());
  root.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.code === 'Escape') { if (!page.hidden) list(); else close(); } if (open && e.code === 'ArrowRight') step(1); if (open && e.code === 'ArrowLeft') step(-1); });
  root.querySelector('.gd-close').onclick = () => close();
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  function openGuide(id) { root.hidden = false; document.body.classList.add('guide-open'); draw(); if (id) show(id); else { page.hidden = true; grid.parentElement.hidden = false; search.focus(); } }
  function close() { root.hidden = true; document.body.classList.remove('guide-open'); }
  seen.on(() => { if (!root.hidden && page.hidden) draw(); });
  return { open: openGuide, close, toggle: () => (root.hidden ? openGuide() : close()), get isOpen() { return !root.hidden; } };
}
