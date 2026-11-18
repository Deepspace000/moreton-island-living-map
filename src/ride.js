// Riding along: tap a 4WD on the beach and you sit in its back seat, looking out through the windscreen as it drives.
// Tap a yacht, a cruiser, a jet ski or a ferry and you stand at its helm: watch it sail itself, or take the wheel.
// The cabin is drawn round the view (roof lining, sun visors, mirror, pillars, dashboard, a screen with the speed and
// heading, the wheel on the right); drag to look about, and the cabin slides the other way as your head turns.
import * as THREE from 'three';
import { clamp } from './common.js';
import { OPT } from './drive.js';

const CABIN = /* html */`
<div class="cab">
  <svg class="shell" viewBox="0 0 1800 1000" preserveAspectRatio="none">
    <defs>
      <linearGradient id="rdRoof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101113"/><stop offset="0.24" stop-color="#2a2d30"/><stop offset="1" stop-color="#1b1d20"/></linearGradient>
      <linearGradient id="rdDash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3e42"/><stop offset="0.07" stop-color="#24272a"/><stop offset="0.5" stop-color="#15171a"/><stop offset="1" stop-color="#0a0b0c"/></linearGradient>
      <linearGradient id="rdTint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(20,40,60,0.42)"/><stop offset="1" stop-color="rgba(20,40,60,0)"/></linearGradient>
      <linearGradient id="rdGlare" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,255,255,0)"/><stop offset="1" stop-color="rgba(220,225,215,0.16)"/></linearGradient>
      <linearGradient id="rdVisor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4f54"/><stop offset="1" stop-color="#2e3236"/></linearGradient>
      <!-- the weave of the roof lining, the grain of the dash plastic and the perforated leather of the seats, each a small tile -->
      <pattern id="rdCloth" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="none"/><path d="M0,1.5 H7 M0,5 H7" stroke="rgba(255,255,255,0.05)" stroke-width="1"/><path d="M1.5,0 V7 M5,0 V7" stroke="rgba(0,0,0,0.22)" stroke-width="1"/></pattern>
      <pattern id="rdGrain" width="11" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.9" fill="rgba(255,255,255,0.07)"/><circle cx="7.5" cy="6" r="0.8" fill="rgba(255,255,255,0.055)"/><circle cx="9" cy="1.5" r="0.7" fill="rgba(0,0,0,0.3)"/><circle cx="4" cy="6.8" r="0.9" fill="rgba(0,0,0,0.28)"/></pattern>
      <pattern id="rdMesh" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.3" fill="#050606"/></pattern>
    </defs>
    <!-- everything that is not glass: the roof, the pillars, the doors and the dashboard, with the windscreen and the two side windows cut out -->
    <path id="rdShell" fill="url(#rdRoof)" fill-rule="evenodd" d="M -50,-50 H 1850 V 1050 H -50 Z
      M 512,236 Q 900,200 1288,236 Q 1332,240 1340,290 L 1380,566 Q 1384,604 1340,604 Q 900,574 460,604 Q 416,604 420,566 L 460,290 Q 468,240 512,236 Z
      M 96,286 Q 104,262 136,258 L 350,246 Q 380,245 378,278 L 346,560 Q 342,596 308,598 L 80,612 Q 50,614 54,580 Z
      M 1704,286 Q 1696,262 1664,258 L 1450,246 Q 1420,245 1422,278 L 1454,560 Q 1458,596 1492,598 L 1720,612 Q 1750,614 1746,580 Z"/>
    <use href="#rdShell" fill="url(#rdCloth)"/>
    <path fill="url(#rdTint)" d="M 512,236 Q 900,200 1288,236 Q 1332,240 1340,290 L 1344,320 Q 900,284 456,320 L 460,290 Q 468,240 512,236 Z"/>
    <!-- the dash thrown back by the glass, the wipers at rest, the black frit round the edge -->
    <path fill="url(#rdGlare)" d="M 440,470 L 1360,470 L 1380,566 Q 1384,604 1340,604 Q 900,574 460,604 Q 416,604 420,566 Z"/>
    <path d="M 512,236 Q 900,200 1288,236 Q 1332,240 1340,290 L 1380,566 Q 1384,604 1340,604 Q 900,574 460,604 Q 416,604 420,566 L 460,290 Q 468,240 512,236 Z" fill="none" stroke="#050606" stroke-width="9" vector-effect="non-scaling-stroke"/>
    <path d="M 500,597 Q 700,560 884,588 M 930,589 Q 1120,556 1300,590" fill="none" stroke="#0a0b0c" stroke-width="6" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <path d="M 468,300 L 428,570 M 1332,300 L 1372,570" stroke="#3a3e42" stroke-width="5" opacity="0.8" vector-effect="non-scaling-stroke"/>
    <!-- grab handles over the doors, door tops under the side windows with their pulls and switches -->
    <path d="M 150,206 Q 220,180 300,200" fill="none" stroke="#3b3f44" stroke-width="12" stroke-linecap="round"/><path d="M 1650,206 Q 1580,180 1500,200" fill="none" stroke="#3b3f44" stroke-width="12" stroke-linecap="round"/>
    <path d="M 40,640 L 330,622 Q 360,620 362,650 L 356,760 H 30 Z" fill="#202326"/><path d="M 1760,640 L 1470,622 Q 1440,620 1438,650 L 1444,760 H 1770 Z" fill="#202326"/>
    <rect x="150" y="668" width="150" height="26" rx="13" fill="#0c0d0e"/><rect x="1500" y="668" width="150" height="26" rx="13" fill="#0c0d0e"/>
    <g fill="#5a6066"><rect x="168" y="676" width="22" height="10" rx="3"/><rect x="198" y="676" width="22" height="10" rx="3"/><rect x="1580" y="676" width="22" height="10" rx="3"/><rect x="1610" y="676" width="22" height="10" rx="3"/></g>
    <!-- sun visors, the overhead console and the mirror -->
    <rect x="520" y="150" width="280" height="92" rx="26" fill="url(#rdVisor)"/><rect x="1000" y="150" width="280" height="92" rx="26" fill="url(#rdVisor)"/>
    <rect x="520" y="150" width="280" height="92" rx="26" fill="url(#rdCloth)"/><rect x="1000" y="150" width="280" height="92" rx="26" fill="url(#rdCloth)"/>
    <rect x="532" y="158" width="130" height="20" rx="6" fill="#d8d2a8" opacity="0.55"/><path d="M 540,164 H 600 M 540,171 H 650" stroke="#6b6748" stroke-width="2"/>
    <path d="M 815,118 H 985 Q 1000,118 998,140 L 990,214 Q 988,232 970,232 H 830 Q 812,232 810,214 L 802,140 Q 800,118 815,118 Z" fill="#2c3033" stroke="#15171a" stroke-width="3"/>
    <rect x="838" y="196" width="124" height="18" rx="6" fill="#16181a"/><circle cx="860" cy="160" r="12" fill="#e9e2c4" opacity="0.5"/><circle cx="940" cy="160" r="12" fill="#e9e2c4" opacity="0.5"/>
    <rect x="788" y="250" width="224" height="58" rx="22" fill="#0d0f10"/><rect x="798" y="257" width="204" height="44" rx="16" fill="#6f8ea0"/><rect x="798" y="257" width="204" height="18" rx="12" fill="#a9c6d2" opacity="0.7"/><path d="M 798,290 Q 900,278 1002,292 L 1002,301 H 798 Z" fill="#c9b98a" opacity="0.6"/>
    <!-- the dashboard: a padded, grained top with a line of stitching, a speaker grille, air vents either side of the screen, the hood over the instruments, the glovebox -->
    <path id="rdDashP" d="M 300,640 Q 900,560 1500,640 L 1560,1050 H 240 Z" fill="url(#rdDash)"/>
    <use href="#rdDashP" fill="url(#rdGrain)"/>
    <path d="M 330,668 Q 900,600 1470,668" fill="none" stroke="#c98a2a" stroke-width="2" stroke-dasharray="9 7" opacity="0.75" vector-effect="non-scaling-stroke"/>
    <path d="M 330,676 Q 900,608 1470,676" fill="none" stroke="rgba(0,0,0,0.45)" stroke-width="3" vector-effect="non-scaling-stroke"/>
    <ellipse cx="900" cy="606" rx="120" ry="9" fill="url(#rdMesh)" opacity="0.8"/>
    <path d="M 1080,640 Q 1230,566 1390,636 L 1400,700 H 1075 Z" fill="#15171a"/><path d="M 1090,640 Q 1230,580 1380,638" fill="none" stroke="#3a3e42" stroke-width="3"/>
    <g fill="#0c0d0e" stroke="#4a4f55" stroke-width="2"><rect x="748" y="650" width="58" height="150" rx="12"/><rect x="994" y="650" width="58" height="150" rx="12"/><rect x="350" y="664" width="110" height="46" rx="12"/><rect x="1410" y="704" width="80" height="40" rx="12"/></g>
    <g stroke="#2e3236" stroke-width="3"><path d="M 756,676 H 798 M 756,700 H 798 M 756,724 H 798 M 756,748 H 798 M 756,772 H 798 M 1002,676 H 1044 M 1002,700 H 1044 M 1002,724 H 1044 M 1002,748 H 1044 M 1002,772 H 1044 M 360,680 H 450 M 360,694 H 450 M 1418,718 H 1482 M 1418,730 H 1482"/></g>
    <rect x="320" y="800" width="560" height="10" rx="5" fill="#8d949b" opacity="0.5"/>
    <rect x="380" y="826" width="330" height="120" rx="14" fill="none" stroke="rgba(0,0,0,0.6)" stroke-width="4"/><rect x="520" y="840" width="50" height="12" rx="5" fill="#5a6066"/>
  </svg>
  <!-- a straw hat left on the dash -->
  <svg class="hat" viewBox="0 0 200 90"><defs><pattern id="rdStraw" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0,3 H6 M3,0 V6" stroke="rgba(60,70,30,0.35)" stroke-width="1"/></pattern></defs>
    <ellipse cx="104" cy="74" rx="92" ry="12" fill="rgba(0,0,0,0.35)"/><ellipse cx="100" cy="68" rx="96" ry="20" fill="#7f8f5c"/><ellipse cx="100" cy="64" rx="96" ry="19" fill="#9aa870"/><ellipse cx="100" cy="64" rx="96" ry="19" fill="url(#rdStraw)"/>
    <path d="M 46,62 Q 48,10 100,10 Q 152,10 154,62 Q 100,78 46,62 Z" fill="#8c9b64"/><path d="M 46,62 Q 48,10 100,10 Q 152,10 154,62 Q 100,78 46,62 Z" fill="url(#rdStraw)"/><path d="M 46,56 Q 100,72 154,56" fill="none" stroke="#5d4a2c" stroke-width="5"/><path d="M 60,30 Q 100,16 140,30" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="3"/></svg>
  <!-- the screen in the middle of the dash -->
  <div class="screen"><div class="cam"></div><div class="spd"><b id="rdSpeed">35</b><span>km/h</span></div><div class="row"><span id="rdHead">N</span><span id="rdBeach">Eastern Beach</span></div><div class="near" id="rdNear"></div><div class="knobs"><i></i><i></i><i></i></div></div>
  <!-- instruments, and the wheel on the right: a leather rim with its stitching, three spokes with their buttons, the boss in the middle -->
  <div class="dials"><b id="rdSpeed2">35</b><span>km/h</span></div>
  <svg class="wheel" viewBox="0 0 200 200"><defs><radialGradient id="rdRim" cx="0.5" cy="0.5" r="0.5"><stop offset="0.78" stop-color="#050606"/><stop offset="0.88" stop-color="#2a2d31"/><stop offset="0.96" stop-color="#0d0e10"/><stop offset="1" stop-color="#000"/></radialGradient></defs>
    <circle cx="100" cy="100" r="88" fill="none" stroke="url(#rdRim)" stroke-width="20"/>
    <circle cx="100" cy="100" r="80.5" fill="none" stroke="#c98a2a" stroke-width="1.2" stroke-dasharray="2.2 2.6" opacity="0.8"/>
    <circle cx="100" cy="100" r="95.5" fill="none" stroke="#4a5056" stroke-width="2" stroke-dasharray="120 480" transform="rotate(-150 100 100)" opacity="0.9"/>
    <path d="M 22,92 Q 60,80 80,90 L 80,120 Q 56,116 28,130 Z M 178,92 Q 140,80 120,90 L 120,120 Q 144,116 172,130 Z M 86,124 H 114 L 122,186 H 78 Z" fill="#17191c" stroke="#2c3034" stroke-width="1.5"/>
    <g fill="#6b7178"><circle cx="40" cy="106" r="4"/><circle cx="52" cy="102" r="4"/><circle cx="46" cy="116" r="4"/><circle cx="160" cy="106" r="4"/><circle cx="148" cy="102" r="4"/><circle cx="154" cy="116" r="4"/></g>
    <rect x="64" y="76" width="72" height="56" rx="22" fill="#1b1e21" stroke="#30343a" stroke-width="2"/><ellipse cx="100" cy="104" rx="21" ry="10" fill="none" stroke="#8d949b" stroke-width="2.5"/>
    <rect x="97" y="6" width="6" height="14" rx="2" fill="#c98a2a"/></svg>
  <!-- the tops of the two front seats -->
  <div class="seat l"><i></i></div><div class="seat r"><i></i></div>
  <!-- the rest of the cabin, for looking round: a rear door window either side of you, the pillars, the small windows of the load space, the back
       window with its wiper and the spare wheel beyond it, and the top of the seat you are sitting on with its head rests. One drawing, used on both sides. -->
  <template id="rdRearT"><svg viewBox="0 0 2000 1000" preserveAspectRatio="none">
    <path class="rs" fill="url(#rdRoof)" fill-rule="evenodd" d="M -50,-50 H 2050 V 1050 H -50 Z
      M 52,258 L 462,246 Q 492,245 492,276 L 484,564 Q 482,600 448,602 L 70,616 Q 38,618 40,584 Z
      M 526,266 Q 528,248 548,248 L 724,254 Q 744,255 744,276 L 740,524 Q 739,552 714,552 L 544,550 Q 520,549 520,524 Z
      M 816,262 Q 1000,240 1184,262 Q 1214,266 1214,294 L 1210,524 Q 1209,556 1178,556 Q 1000,544 822,556 Q 791,556 790,524 L 786,294 Q 786,266 816,262 Z
      M 1474,266 Q 1472,248 1452,248 L 1276,254 Q 1256,255 1256,276 L 1260,524 Q 1261,552 1286,552 L 1456,550 Q 1480,549 1480,524 Z
      M 1948,258 L 1538,246 Q 1508,245 1508,276 L 1516,564 Q 1518,600 1552,602 L 1930,616 Q 1962,618 1960,584 Z"/>
    <path fill="url(#rdCloth)" fill-rule="evenodd" d="M -50,-50 H 2050 V 1050 H -50 Z
      M 52,258 L 462,246 Q 492,245 492,276 L 484,564 Q 482,600 448,602 L 70,616 Q 38,618 40,584 Z
      M 526,266 Q 528,248 548,248 L 724,254 Q 744,255 744,276 L 740,524 Q 739,552 714,552 L 544,550 Q 520,549 520,524 Z
      M 816,262 Q 1000,240 1184,262 Q 1214,266 1214,294 L 1210,524 Q 1209,556 1178,556 Q 1000,544 822,556 Q 791,556 790,524 L 786,294 Q 786,266 816,262 Z
      M 1474,266 Q 1472,248 1452,248 L 1276,254 Q 1256,255 1256,276 L 1260,524 Q 1261,552 1286,552 L 1456,550 Q 1480,549 1480,524 Z
      M 1948,258 L 1538,246 Q 1508,245 1508,276 L 1516,564 Q 1518,600 1552,602 L 1930,616 Q 1962,618 1960,584 Z"/>
    <!-- the glass: a tint across the top of each pane, heater lines and the wiper on the back window, the spare wheel hanging outside it -->
    <path fill="url(#rdTint)" d="M 830,268 Q 1000,246 1170,268 Q 1200,272 1200,300 L 1200,340 Q 1000,318 800,340 L 800,300 Q 800,272 830,268 Z"/>
    <path d="M 900,556 Q 1000,462 1100,556 Z" fill="rgba(8,9,10,0.9)"/><path d="M 928,556 Q 1000,492 1072,556" fill="none" stroke="#2a2d31" stroke-width="8"/>
    <g fill="none" stroke="rgba(190,120,60,0.16)" stroke-width="1"><path vector-effect="non-scaling-stroke" d="M 812,330 Q 1000,312 1188,330 M 810,370 Q 1000,352 1190,370 M 808,410 Q 1000,392 1192,410 M 808,450 Q 1000,432 1192,450 M 806,490 Q 1000,472 1194,490"/></g>
    <path d="M 1000,548 Q 1090,500 1170,536" fill="none" stroke="#0a0b0c" stroke-width="6" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <rect x="950" y="252" width="100" height="12" rx="6" fill="#3a1414"/>
    <g fill="none" stroke="#050606" stroke-width="8" vector-effect="non-scaling-stroke">
      <path d="M 52,258 L 462,246 Q 492,245 492,276 L 484,564 Q 482,600 448,602 L 70,616 Q 38,618 40,584 Z"/>
      <path d="M 526,266 Q 528,248 548,248 L 724,254 Q 744,255 744,276 L 740,524 Q 739,552 714,552 L 544,550 Q 520,549 520,524 Z"/>
      <path d="M 816,262 Q 1000,240 1184,262 Q 1214,266 1214,294 L 1210,524 Q 1209,556 1178,556 Q 1000,544 822,556 Q 791,556 790,524 L 786,294 Q 786,266 816,262 Z"/>
      <path d="M 1474,266 Q 1472,248 1452,248 L 1276,254 Q 1256,255 1256,276 L 1260,524 Q 1261,552 1286,552 L 1456,550 Q 1480,549 1480,524 Z"/>
      <path d="M 1948,258 L 1538,246 Q 1508,245 1508,276 L 1516,564 Q 1518,600 1552,602 L 1930,616 Q 1962,618 1960,584 Z"/></g>
    <!-- grab handles and coat hooks over the doors, the light in the roof, seat belts down the pillars, door tops with their pulls and switches -->
    <path d="M 210,206 Q 290,180 370,200" fill="none" stroke="#3b3f44" stroke-width="12" stroke-linecap="round"/><path d="M 1790,206 Q 1710,180 1630,200" fill="none" stroke="#3b3f44" stroke-width="12" stroke-linecap="round"/>
    <rect x="930" y="110" width="140" height="62" rx="20" fill="#2c3033" stroke="#15171a" stroke-width="3"/><rect x="946" y="122" width="108" height="38" rx="12" fill="#e9e2c4" opacity="0.45"/>
    <path d="M 506,236 Q 514,470 496,740" fill="none" stroke="#3d4146" stroke-width="16" stroke-linecap="round"/><path d="M 1494,236 Q 1486,470 1504,740" fill="none" stroke="#3d4146" stroke-width="16" stroke-linecap="round"/>
    <rect x="494" y="222" width="24" height="30" rx="6" fill="#15171a"/><rect x="1482" y="222" width="24" height="30" rx="6" fill="#15171a"/>
    <path d="M 20,646 L 440,622 Q 470,620 472,650 L 466,790 H 10 Z" fill="#202326"/><path d="M 1980,646 L 1560,622 Q 1530,620 1528,650 L 1534,790 H 1990 Z" fill="#202326"/>
    <rect x="200" y="672" width="170" height="26" rx="13" fill="#0c0d0e"/><rect x="1630" y="672" width="170" height="26" rx="13" fill="#0c0d0e"/>
    <g fill="#5a6066"><rect x="220" y="680" width="22" height="10" rx="3"/><rect x="250" y="680" width="22" height="10" rx="3"/><rect x="1730" y="680" width="22" height="10" rx="3"/><rect x="1760" y="680" width="22" height="10" rx="3"/></g>
    <!-- the load space sill under the small windows, and the back of your own seat: padded leather with a line of stitching and three head rests on their posts -->
    <path d="M 540,566 L 800,572 L 800,640 L 520,640 Z M 1460,566 L 1200,572 L 1200,640 L 1480,640 Z" fill="#17191c"/>
    <g stroke="#7d848b" stroke-width="8"><path d="M 650,660 V 720 M 750,660 V 720 M 968,660 V 700 M 1032,660 V 700 M 1250,660 V 720 M 1350,660 V 720"/></g>
    <g fill="#24272b" stroke="#0c0d0e" stroke-width="4"><rect x="585" y="524" width="230" height="166" rx="60"/><rect x="910" y="580" width="180" height="104" rx="40"/><rect x="1185" y="524" width="230" height="166" rx="60"/></g>
    <g fill="url(#rdGrain)"><rect x="585" y="524" width="230" height="166" rx="60"/><rect x="910" y="580" width="180" height="104" rx="40"/><rect x="1185" y="524" width="230" height="166" rx="60"/></g>
    <path d="M 400,700 Q 1000,640 1600,700 L 1660,1050 H 340 Z" fill="#1b1e21"/><path d="M 400,700 Q 1000,640 1600,700 L 1660,1050 H 340 Z" fill="url(#rdGrain)"/>
    <path d="M 430,724 Q 1000,666 1570,724" fill="none" stroke="#c98a2a" stroke-width="2" stroke-dasharray="9 7" opacity="0.75" vector-effect="non-scaling-stroke"/>
    <path d="M 805,690 Q 800,900 790,1050 M 1195,690 Q 1200,900 1210,1050" fill="none" stroke="rgba(0,0,0,0.55)" stroke-width="5" vector-effect="non-scaling-stroke"/>
  </svg></template>
  <div class="rear l"></div><div class="rear r"></div>
</div>
<button id="rideExit" class="pill">Leave the car</button>
<div class="zoom"><button id="rideOut" class="pill" title="Watch from further away (scroll, pinch, or the - key)">&minus; Further</button><button id="rideIn" class="pill" title="Closer, and back aboard (scroll, pinch, or the + key)">+ Closer</button></div>
<div class="tip" id="rideTip">Drag to look around</div>
<div class="helm">
  <div class="gauges"><span><b id="hmSpeed">0.0</b> <i id="hmUnit">kn</i></span><span><b id="hmHead">N</b></span><span>wind <b id="hmWind">-</b></span><span><i id="hmDepthL">depth</i> <b id="hmDepth">-</b></span><span class="where" id="hmNear"></span></div>
  <div class="keys">
    <button id="hmLeft" class="pill" title="Steer to port (A or left arrow)">&#9664;</button>
    <button id="hmSlow" class="pill" title="Brake, stop, then back (S or down arrow)">&minus;</button>
    <svg class="spokes" id="hmWheel" viewBox="0 0 100 100"><circle cx="50" cy="50" r="36" fill="none" stroke="#6a4a2a" stroke-width="7"/><circle cx="50" cy="50" r="9" fill="#8a6234"/><g stroke="#8a6234" stroke-width="5" stroke-linecap="round"><path d="M50,2 V98 M2,50 H98 M16,16 L84,84 M84,16 L16,84"/></g><circle cx="50" cy="6" r="5" fill="#d9b25c"/></svg>
    <button id="hmFast" class="pill" title="More speed (W or up arrow)">+</button>
    <button id="hmRight" class="pill" title="Steer to starboard (D or right arrow)">&#9654;</button>
  </div>
  <div class="foot">
    <button id="ftFwd" class="pill" title="Walk forward and keep walking until Stop (W or the up arrow walks while you hold it)">&#9650; Forward</button>
    <div class="ft-row"><button id="ftLeft" class="pill" title="Turn left (A or left arrow)">&#9664; Left</button><button id="ftStop" class="pill" title="Stop (down arrow)">&#9632; Stop</button><button id="ftRight" class="pill" title="Turn right (D or right arrow)">Right &#9654;</button></div>
    <div class="ft-speed"><span>Speed</span><button class="pill" data-g="0">Slow</button><button class="pill on" data-g="1">Walk</button><button class="pill" data-g="2">Run</button></div>
  </div>
  <div class="acts"><button id="hmTake" class="pill">Take the helm</button><button id="hmCamp" class="pill" title="Pitch the tent and rest; press again to pack up and walk on">Camp</button></div>
</div>`;

export function makeRide(camera, canvas, cars, getBoats, env = {}) {
  const el = document.createElement('div'); el.id = 'ride'; el.innerHTML = CABIN;
  document.getElementById('c').after(el);
  for (const r of el.querySelectorAll('.rear')) r.appendChild(el.querySelector('#rdRearT').content.cloneNode(true));
  const rears = [...el.querySelectorAll('.rear')]; let rearW = 0;
  const cab = el.querySelector('.cab'), helmEl = el.querySelector('.helm'), wheelEl = el.querySelector('.wheel'), $ = (id) => el.querySelector('#' + id), v = new THREE.Vector3(), d = new THREE.Vector3(), q = new THREE.Vector3();
  const R = { active: false, kind: '', car: null, boat: null, bird: null, pos: new THREE.Vector3(), look: 0, tilt: 0, zoom: 0, helm: false, onExit: null }, S = 1.45, COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  let tipT = 0, fov0 = 38, near0 = 3, uiT = 0, shake = 0, drag = null, steer = 0, gas = 0, fast = false, slow = false, pace = 1, sm = {};
  // On foot: Forward keeps you walking until Stop; a finger (or the mouse button) held on the view walks for as long as it is held, and held
  // towards the left or the right of the screen it turns you that way as you go. Three speeds, in metres a second.
  let walkGo = false, press = null, gear = 1; const PACES = [0.9, 1.7, 4.2];
  const onFoot = () => !!(R.active && R.bird && R.bird.kind === 'person' && R.bird.ctl);
  const setGo = (on) => { walkGo = on; const b = el.querySelector('#ftFwd'); if (b) b.classList.toggle('on', on); };
  const sideOf = (x) => { const u = (x / innerWidth - 0.5) * 2, a = Math.abs(u); return a < 0.22 ? 0 : Math.sign(u) * Math.min(0.75, (a - 0.22) / 0.5); };          // (the middle of the screen is straight ahead)
  // Smooth following. A value eases toward its target at a rate that does not depend on the frame time, so nothing the eye rides on
  // (height, pitch, roll, heading) can jump from one frame to the next; angles go the short way round.
  const ease = (key, to, rate, dt, ang) => { let v0 = sm[key]; if (v0 === undefined || !(dt >= 0)) return (sm[key] = to); let d0 = to - v0; if (ang) d0 -= Math.PI * 2 * Math.round(d0 / (Math.PI * 2)); return (sm[key] = v0 + d0 * (1 - Math.exp(-dt * rate))); };
  const point = (ang) => COMPASS[(Math.round(((ang * 180 / Math.PI) + 360) % 360 / 45)) % 8];
  // what is under a tap: the nearest 4WD or boat whose place on the screen is within about its own size (and never less than a fingertip)
  const things = () => [...(env.birds || []), ...(env.others ? env.others() : [])];
  R.pick = (cx, cy) => {
    let best = null, bd = 1e9; camera.getWorldDirection(d);
    const px = innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360));
    const test = (kind, obj, pos, up, size) => {
      v.copy(pos); v.y += up; const dist = v.distanceTo(camera.position); if (q.copy(v).sub(camera.position).dot(d) <= 0) return;
      v.project(camera); const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight, rad = Math.max(30, size / dist * px), e = Math.hypot(sx - cx, sy - cy);
      if (e < rad * 1.25 && e / rad < bd) { bd = e / rad; best = { kind, obj }; }
    };
    for (const c of cars) test('car', c, c.m.position, 1.3, 5);
    for (const b of getBoats()) test('boat', b, b.m.position, 2, (b.len || 12) * 0.55);
    for (const p of things()) test('bird', p, p.m.position, p.kind === 'plane' ? 1.5 : p.kind === 'walker' ? 1.0 : 0.3, p.kind === 'plane' ? 9 : 2.8);
    return best;
  };
  R.enter = (hit) => {
    R.active = true; R.kind = hit.kind; R.car = hit.kind === 'car' ? hit.obj : null; R.boat = hit.kind === 'boat' ? hit.obj : null; R.bird = hit.kind === 'bird' ? hit.obj : null; R.look = 0; R.tilt = 0; R.helm = false; steer = 0; gas = 0; press = null; setGo(false); el.classList.toggle('person', !!(R.bird && R.bird.kind === 'person')); R.yaw0 = undefined; R.wheel = 0; sm = {}; R.zoom = R.bird ? base() : 0;
    fov0 = camera.fov; near0 = camera.near; camera.near = 0.2;
    if (R.car) { R.car.m.visible = false; camera.fov = innerWidth < innerHeight ? 82 : 66; }
    else camera.fov = innerWidth < innerHeight ? 84 : 70;
    camera.updateProjectionMatrix();
    cab.style.display = R.car ? 'block' : 'none'; helmEl.style.display = 'flex'; el.classList.toggle('incar', !!R.car);
    $('rideExit').textContent = R.car ? 'Leave the car' : R.boat ? (R.boat.jet ? 'Leave the jet ski' : R.boat.sail ? 'Leave the yacht' : 'Leave the boat') : (R.bird.kind === 'person' ? 'Back to the map' : 'Leave the ' + ({ walker: 'traveller', eagle: 'sea eagle' }[R.bird.kind] || R.bird.kind || 'bird'));
    $('hmUnit').textContent = R.boat ? 'kn' : 'km/h'; $('hmDepthL').textContent = R.boat ? 'depth' : 'height'; el.classList.toggle('walker', !!(R.bird && R.bird.kind === 'walker'));
    const b = R.boat, can = canSteer(); $('hmTake').style.display = can && !(R.bird && R.bird.kind === 'person') ? '' : 'none';
    $('rideTip').textContent = R.car ? 'Drag to look around · take the wheel to drive' : R.bird ? (R.bird.kind === 'person' ? 'On foot · A and D turn, W faster, down arrow slower · tap a vehicle to get in' : R.bird.kind === 'walker' ? 'Drag to look around · walk them yourself, or press Camp to rest' : R.bird.kind === 'plane' ? 'Drag to look around · fly it yourself: steer, climb, and land on a strip' : R.bird.kind === 'pelican' ? 'Drag to look around · fly it yourself to steer, climb and land' : 'Drag to look around · fly it yourself to steer, climb and dive') : can ? 'Drag to look around · take the helm to steer' : b.ferry ? 'Drag to look around · the ferry keeps to its route' : 'Drag to look around · this boat is at anchor'; $('rideTip').textContent += ' · scroll or pinch to watch from outside';
    sync(); syncZoom(); if (hit.control === true || (b && b.jet && hit.control !== false)) take(true);       // a jet ski is yours to ride as soon as you are on it (unless you asked only to watch)
    el.style.display = 'block'; uiT = 0; R.update(0, 0);
    const tip = $('rideTip'); tip.style.opacity = 1; clearTimeout(tipT); tipT = setTimeout(() => { tip.style.opacity = 0; }, 7000);       // the hint says its piece and goes
  };
  const canSteer = () => !!(R.car || R.bird || (R.boat && R.boat.move && !R.boat.ferry));
  const WORDS = { car: ['Take the wheel', 'Let it drive itself'], boat: ['Take the helm', 'Let her sail herself'], bird: ['Fly it yourself', 'Let it fly on'], walker: ['Walk them yourself', 'Let them walk on'] };
  const sync = () => { el.classList.toggle('steering', R.helm); $('hmTake').textContent = (R.boat && R.boat.jet ? ['Ride it yourself', 'Let it run itself'] : R.bird && R.bird.kind === 'walker' ? WORDS.walker : WORDS[R.kind] || WORDS.boat)[R.helm ? 1 : 0]; $('hmTake').classList.toggle('on', R.helm); };
  const take = (on) => {
    if (!canSteer()) return; R.helm = on; steer = 0; gas = 0;
    if (R.boat) R.boat.helm = on ? { turn: 0, throttle: 1 } : null; else if (R.car) R.car.setDrive(on); else R.bird.ctl = on ? { turn: 0, climb: 0 } : null;
    sync();
  };
  R.exit = () => {
    if (!R.active) return; if (R.helm) take(false); R.active = false; R.autoSteer = null; if (R.car) R.car.m.visible = true; if (R.boat) R.boat.helm = null; if (R.bird) { R.bird.ctl = null; R.bird.m.visible = true; if (env.showWalker) env.showWalker(true); } R.helm = false;
    el.style.display = 'none'; camera.near = near0; camera.fov = fov0; camera.up.set(0, 1, 0); camera.updateProjectionMatrix(); drag = null;
  };
  // Watching from outside. Zoom out (wheel, pinch, the Further button or the - key) and the eye leaves the seat and follows from behind and above,
  // as far back as you like; drag to swing round it. Zoom all the way in and you are back aboard.
  const base = () => (R.bird ? R.bird.zoom0 || (R.bird.kind === 'eagle' ? 7 : 8) : 0);
  const minD = () => (R.car ? 9 : R.boat ? Math.max(9, (R.boat.len || 12) * 1.1) : base() * 0.8);
  // three set views: 0 through the eyes, 1 close behind, 2 far behind
  R.setView = (lv) => { if (!R.active) return; const lo = minD(); R.zoom = lv <= 0 ? 0 : lv === 1 ? (R.bird ? base() : lo * 1.25) : (R.bird ? base() * 7 : lo * 6); syncZoom(); };
  R.view = () => (R.zoom < 1 ? 0 : R.zoom < minD() * 3 ? 1 : 2);
  const syncZoom = () => { $('rideIn').style.opacity = R.zoom > 0 ? 1 : 0.45; el.classList.toggle('outside', R.zoom > 0); };
  R.zoomBy = (f) => { if (!R.active) return; const lo = minD(); let z = R.zoom < lo ? (f > 1 ? lo : 0) : R.zoom * f; if (z < lo * 0.93) z = 0; R.zoom = Math.min(z, 700); syncZoom(); };
  const chase = (a, tx, ty, tz, dist, dt, sea) => {
    const ca = ease('ca', a, 4, dt, true), elv = clamp(0.3 - R.tilt * 1.7, 0.04, 1.35), ang = ca - R.look, ce = Math.cos(elv);
    const cx = tx - Math.cos(ang) * ce * dist, cz = tz + Math.sin(ang) * ce * dist;
    camera.position.set(cx, Math.max(ty + Math.sin(elv) * dist, sea + 0.6, env.ground ? env.ground(cx, cz) + 1.5 : -1e9), cz);
    camera.up.set(0, 1, 0); v.set(tx, ty, tz); camera.lookAt(v); camera.updateMatrixWorld();
  };
  // the hands on the wheel: applied before the vehicles move this frame
  R.control = (dt) => {
    // held keys change the pace of whatever you are in control of: Shift up to nearly twice as fast, S down to half; let go and it eases back
    pace += ((!R.helm ? 1 : fast ? 1.8 : slow ? 0.5 : 1) - pace) * (1 - Math.exp(-dt * 2.2));
    { const h = R.car ? R.car.drive : R.bird ? R.bird.ctl : R.boat ? R.boat.helm : null; if (h) h.pace = pace; }
    const steer0 = steer, gas0 = gas, foot = onFoot();
    if (press && !foot) press = null;
    if (press && !press.on && performance.now() - press.t > 170) { press.on = true; R.halt = true; }          // (held, not tapped: a tap picks things, and two of them get you into a vehicle)
    if (!steer && press && press.on) steer = press.steer * OPT.invX;          // (where the finger is does not turn round with the setting: left is left)
    R.steering = steer !== 0; steer = R.autoSteer != null && !R.steering ? R.autoSteer : steer * OPT.invX;          // (autoSteer: heading for a spot picked on the mini map; a hand on the keys overrules it)
    if (R.bird && R.bird.kind !== 'walker' && R.bird.kind !== 'person') gas *= OPT.invY;          // (up and down turned round is for flying: push forward to dive)
    if (foot) { if (gas < 0 && walkGo) setGo(false); const c = R.bird.ctl; c.go = walkGo || gas > 0 || !!(press && press.on); c.speed = PACES[gear]; if (press && press.on) R.look += (0 - R.look) * (1 - Math.exp(-dt * 4)); }          // (walking by a held finger, you look where you go)
    // Braking (S, the down arrow or the minus button) bites harder than the throttle opens; a car or a boat brought to a stop stays stopped for
    // half a second, so it can be stopped on the spot, and if the key is still held a car then backs, slowly (a boat cannot)
    const brakeTo = (h, rate, back) => {
      if (gas >= 0) { h.held = 0; return clamp(h.throttle + gas * dt * rate, back, 1.6); }
      if (h.throttle > 0) { h.held = 0; return Math.max(0, h.throttle - dt * rate * 2.2); }
      if (back < 0 && (h.v || 0) > 0.4) { h.held = 0; return back; }          // (a car still rolling forward: brake against it until it stands)
      h.held = (h.held || 0) + dt; return h.held < 0.5 ? Math.min(h.throttle, 0) * (h.throttle < -0.05 && (h.v || 0) < -0.4 ? 1 : 0) : Math.max(back, h.throttle - dt * rate * 0.6);
    };
    if (R.car && R.car.drive) { const c = R.car; c.drive.turn += (steer - c.drive.turn) * (1 - Math.exp(-dt * 3.5)); c.drive.throttle = brakeTo(c.drive, 0.7, -0.4); }
    if (R.bird && R.bird.ctl) { const p = R.bird; p.ctl.turn += (steer - p.ctl.turn) * (1 - Math.exp(-dt * 3)); p.ctl.climb += (gas - p.ctl.climb) * (1 - Math.exp(-dt * 3)); }
    if (R.boat && R.boat.helm) { const b = R.boat; b.helm.turn += (steer - b.helm.turn) * (1 - Math.exp(-dt * 3)); b.helm.throttle = Math.min(1.5, brakeTo(b.helm, 0.6, 0)); }
    steer = steer0; gas = gas0;
  };
  // the eye: placed after everything has moved this frame, so the view never trails the thing you ride by a frame
  R.update = (dt, t) => {
    if (R.car) {
      const c = R.car, m = c.m, yaw = m.rotation.y, fx = Math.cos(yaw), fz = -Math.sin(yaw);
      R.pos.copy(m.position);
      // eyes in the middle of the back seat; the car rides the bumps of the sand, but the springs take the sharpness out of them
      shake += dt * c.sp; const bump = Math.sin(shake * 1.9) * 0.008 + Math.sin(shake * 0.53 + 1.0) * 0.016;
      const cy = ease('cy', m.position.y, 7, dt), pitch = ease('cp', m.rotation.z, 4, dt), cyaw = ease('cyaw', yaw, 9, dt, true);
      const zm = ease('zm', R.zoom, 5, dt), outside = zm > 1;
      if (m.visible !== outside) { m.visible = outside; cab.style.display = outside ? 'none' : 'block'; }
      if (outside) chase(yaw, m.position.x, cy + 1.2 * S, m.position.z, zm, dt, env.sea ? env.sea() : -1e9);
      else {
      camera.position.set(m.position.x - fx * 0.95 * S, cy + 1.44 * S + bump, m.position.z - fz * 0.95 * S);
      camera.rotation.set(R.tilt + pitch * 0.7 * Math.cos(R.look) - 0.03, cyaw - Math.PI / 2 - R.look, -pitch * 0.7 * Math.sin(R.look) + Math.sin(shake * 0.8) * 0.003, 'YXZ');      // looking out of the side, the car's nose-up shows as a tilt of the horizon, not a nod
      camera.updateMatrixWorld();
      }
      // the wheel in the driver's hands: turned as far as the car is turning, never quite still on the sand, and spinning back as the car straightens
      if (dt > 0) {
        let dy = yaw - (R.yaw0 ?? yaw); dy = ((dy + Math.PI * 3) % (Math.PI * 2)) - Math.PI; R.yaw0 = yaw;
        const want = c.drive ? c.drive.turn * 140 : clamp(-dy / dt * 150, -200, 200) + Math.sin(shake * 0.9) * 2.5 + Math.sin(shake * 2.3 + 1) * 1.5;
        R.wheel = (R.wheel ?? 0) + (want - (R.wheel ?? 0)) * (1 - Math.exp(-dt * 6));
        wheelEl.style.transform = `rotate(${R.wheel.toFixed(1)}deg)`; $('hmWheel').style.transform = wheelEl.style.transform;
      }
      // the cabin stays with the car: as the head turns one way it slides the other, all the way round (the back of the cabin is drawn on both sides)
      const hf = 2 * Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect), rw = Math.max(110, Math.PI * 2 / hf * 100 - 180);
      if (Math.abs(rw - rearW) > 0.2) { rearW = rw; for (const r of rears) r.style.width = rw.toFixed(1) + 'vw'; }
      cab.style.transform = `translate(${Math.round(-R.look / hf * innerWidth)}px, ${Math.round((R.tilt / (camera.fov * Math.PI / 180) + bump * 0.3) * innerHeight)}px)`;
      uiT -= dt; if (uiT <= 0) {
        uiT = 0.3; const kmh = Math.round(c.sp * 3.6);
        $('rdSpeed').textContent = kmh; $('rdSpeed2').textContent = kmh; $('rdHead').textContent = point(Math.atan2(fx, -fz)); $('rdBeach').textContent = c.side > 0 ? 'Eastern Beach' : 'Western Beach';
        $('rdNear').textContent = env.where ? env.where(m.position.x, m.position.z) : '';
      }
      return;
    }
    if (R.bird) {            // following a bird: just behind and above it, swinging round after it as it turns and rising and falling a little after it
      const p = R.bird, sea = env.sea ? env.sea() : 0; R.pos.copy(p.m.position);
      let by = ease('by', p.y, 3.2, dt); by = sm.by = clamp(by, p.y - 1.5, p.y + 1.5);        // it may lag the bird a little, never lose it
      const zm = ease('zm', R.zoom, 5, dt), fp = zm < 1, show = !fp || p.hideInFP === false;
      if (p.m.visible !== show) p.m.visible = show; if (p.kind === 'walker' && env.showWalker) env.showWalker(show);
      if (!fp) chase(p.hd, p.x, by + (p.kind === 'walker' || p.kind === 'person' ? 1.3 : p.kind === 'plane' ? 2.2 : 0.5), p.z, zm, dt, sea);
      else {                 // through its own eyes: the horizon tips as it banks, lifts and drops as it climbs and dives
        // (the eye is fixed in the creature's or the machine's own frame, so it stays put on the nose when that pitches up or banks)
        const a = ease('ca', p.hd, 7, dt, true), e = p.fpEye || [0.6, 0.3];
        p.m.updateMatrixWorld(); v.set(e[0], e[1], 0); p.m.localToWorld(v); camera.position.copy(v);
        camera.rotation.set(R.tilt + (p.nose || 0) * 0.8 * Math.cos(R.look) - 0.04, a - Math.PI / 2 - R.look, -(p.roll || 0) * 0.85 * Math.cos(R.look), 'YXZ'); camera.updateMatrixWorld();
      }
      if (p.ctl) $('hmWheel').style.transform = `rotate(${(p.ctl.turn * 60).toFixed(1)}deg)`;
      uiT -= dt; if (uiT <= 0) {
        uiT = 0.3; $('hmSpeed').textContent = Math.round((p.v ?? p.sp) * 3.6); $('hmHead').textContent = point(Math.atan2(Math.cos(p.hd), Math.sin(p.hd)));
        $('hmWind').textContent = env.wind ? env.wind() : '-'; $('hmDepth').textContent = p.afloat ? 'on the water' : Math.max(0, (p.y - sea) / 1.7).toFixed(0) + ' m'; $('hmNear').textContent = (p.next ? p.next + ' · ' : '') + (env.where ? env.where(p.x, p.z) : '');
        if (p.kind === 'walker') { const cb = $('hmCamp'); cb.textContent = p.camped ? 'Break camp' : 'Camp'; cb.classList.toggle('on', !!p.camped); }
      }
      return;
    }
    // aboard a boat: eyes at the helm, moving with the hull as it pitches, rolls and heels; the head steadies itself a little against the motion
    const b = R.boat, m = b.m, eye = b.eye || [-3, 3];
    m.updateMatrixWorld(); R.pos.copy(m.position);
    v.set(eye[0], eye[1], eye[2] || 0); m.localToWorld(v); q.set(eye[0] + 20, eye[1] - 0.8, eye[2] || 0); m.localToWorld(q); q.sub(v).normalize();
    const pit = ease('bp', Math.asin(clamp(q.y, -1, 1)), 5, dt), rol = ease('br', m.rotation.x, 5, dt), zmB = ease('zm', R.zoom, 5, dt);
    if (zmB > 1) chase(b.hd, m.position.x, m.position.y + eye[1] * 0.6 * 1.6, m.position.z, zmB, dt, env.sea ? env.sea() : -1e9);
    else {
    camera.position.copy(v);
    camera.rotation.set((pit * Math.cos(R.look) - rol * Math.sin(R.look)) * 0.6 + R.tilt, Math.atan2(-q.x, -q.z) - R.look, -(rol * Math.cos(R.look) + pit * Math.sin(R.look)) * 0.6, 'YXZ');       // looking abeam, her pitching tilts the horizon and her rolling lifts and drops it
    camera.updateMatrixWorld();
    }
    if (b.helm) $('hmWheel').style.transform = `rotate(${(b.helm.turn * 110).toFixed(1)}deg)`;
    uiT -= dt; if (uiT <= 0) {
      uiT = 0.3; $('hmSpeed').textContent = (b.sp / 1.6 * 1.944).toFixed(1); $('hmHead').textContent = point(Math.atan2(Math.cos(b.hd), Math.sin(b.hd)));
      $('hmWind').textContent = env.wind ? env.wind() : '-'; $('hmDepth').textContent = env.depth ? Math.max(0, env.depth(b.x, b.z)).toFixed(1) + ' m' : '-'; $('hmNear').textContent = env.where ? env.where(b.x, b.z) : '';
    }
  };
  // dragging turns the head (a car steers itself; a boat does too unless you have taken the helm)
  const pts = new Map(); let pinch = 0, pinchAcc = 1;
  canvas.addEventListener('pointerdown', (e) => { if (!R.active) return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 1) { drag = { x: e.clientX, y: e.clientY }; press = onFoot() && e.button === 0 ? { id: e.pointerId, t: performance.now(), on: false, steer: sideOf(e.clientX) } : null; } else { drag = null; press = null; pinch = 0; pinchAcc = 1; } });
  canvas.addEventListener('wheel', (e) => { if (!R.active) return; e.preventDefault(); R.zoomBy(Math.exp(clamp(e.deltaY, -240, 240) * 0.0016)); }, { passive: false });
  addEventListener('pointermove', (e) => {
    if (R.active && pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (R.active && pts.size === 2) {             // two fingers: pinch them together to draw back, spread them to come closer
      const [a, bq] = [...pts.values()], dd = Math.hypot(a[0] - bq[0], a[1] - bq[1]);
      if (pinch > 0 && dd > 0) { const f = pinch / dd; if (R.zoom >= minD()) R.zoomBy(f); else { pinchAcc *= f; if (pinchAcc > 1.12) { R.zoomBy(1.1); pinchAcc = 1; } } }
      pinch = dd; return;
    }
    if (!R.active || !drag) return;
    if (press && e.pointerId === press.id) press.steer = sideOf(e.clientX);
    // all the way round, in a car as on a boat (on foot the press walks and turns you instead: only up and down is a look)
    if (!press) R.look += (e.clientX - drag.x) * 0.0035 * OPT.invX; R.look -= Math.PI * 2 * Math.round(R.look / (Math.PI * 2));
    { const tight = R.car && R.zoom < 1; R.tilt = clamp(R.tilt - (e.clientY - drag.y) * 0.0025 * OPT.invY, tight ? -0.2 : -0.6, tight ? 0.16 : 0.5); } drag.x = e.clientX; drag.y = e.clientY;
  });
  for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, (e) => { pts.delete(e.pointerId); drag = null; press = null; pinch = 0; });
  // the helm: buttons you hold, or the keys
  const hold = (id, on, off) => { const b = $(id); b.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, off); };
  hold('hmLeft', () => { steer = -1; }, () => { steer = 0; }); hold('hmRight', () => { steer = 1; }, () => { steer = 0; });
  hold('hmSlow', () => { gas = -1; }, () => { gas = 0; }); hold('hmFast', () => { gas = 1; }, () => { gas = 0; });
  hold('ftLeft', () => { steer = -1; }, () => { steer = 0; }); hold('ftRight', () => { steer = 1; }, () => { steer = 0; });
  $('ftFwd').onclick = () => setGo(true); $('ftStop').onclick = () => { setGo(false); R.halt = true; };          // (Stop also gives up a spot you were heading for)
  { const gs = [...el.querySelectorAll('.ft-speed button')]; for (const b of gs) b.onclick = () => { gear = +b.dataset.g; for (const o of gs) o.classList.toggle('on', o === b); }; }
  $('hmTake').onclick = () => take(!R.helm);
  $('hmCamp').onclick = () => { const p = R.bird; if (p && p.kind === 'walker') { p.askCamp = !p.camped; if (R.helm && !p.camped) take(false); } };
  $('rideOut').onclick = () => R.zoomBy(1.6); $('rideIn').onclick = () => R.zoomBy(1 / 1.6);
  const KEY = { KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0], KeyW: [0, 1], ArrowUp: [0, 1], ArrowDown: [0, -1] };          // (in a car or a boat S brakes, stops and backs, as the down arrow does; flying or on foot it is the slow key, below)
  const vehicle = () => R.helm && (R.car || R.boat);
  addEventListener('keydown', (e) => { if (!R.active) return; if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') fast = true; if (e.code === 'KeyS') { if (vehicle()) gas = -1; else slow = true; if (R.helm) e.preventDefault(); } if (e.code === 'KeyH') return take(!R.helm); if (e.code === 'Minus' || e.code === 'NumpadSubtract') return R.zoomBy(1.4); if (e.code === 'Equal' || e.code === 'NumpadAdd') return R.zoomBy(1 / 1.4); const k = KEY[e.code]; if (k && R.helm) { if (k[0]) steer = k[0]; if (k[1]) gas = k[1]; e.preventDefault(); } });
  addEventListener('blur', () => { fast = slow = false; });
  addEventListener('keyup', (e) => { if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') fast = false; if (e.code === 'KeyS') { slow = false; if (gas < 0) gas = 0; } const k = KEY[e.code]; if (k) { if (k[0]) steer = 0; if (k[1]) gas = 0; } });
  $('rideExit').onclick = () => R.onExit && R.onExit();
  R.take = take; R.canSteer = canSteer;
  return R;
}
