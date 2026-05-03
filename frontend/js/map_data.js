// map_data.js — SVG France map geometry + coordinate projection
// Bounding box: lon -5.5→9.7 lat 42.0→51.8  => viewBox 0 0 1000 680
// All country path vertices were derived from this formula:
//   x = ((lon + 5.5) / 15.2) * 1000
//   y = 680 - ((lat - 42.0) / 9.8) * 680

const MAP_W = 1000, MAP_H = 680;
const LON_MIN = -5.5, LON_MAX = 9.7, LAT_MIN = 42.0, LAT_MAX = 51.8;

function lonLatToXY(lon, lat) {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * MAP_W;
  const y = MAP_H - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * MAP_H;
  return { x: Math.round(x), y: Math.round(y) };
}

// France outline — 42 boundary points from real coastline/border coordinates
// Starting from Dunkerque, going west (Channel coast → Brittany → Atlantic →
// Pyrenees → Mediterranean → Alps → Rhine → Belgium border → back)
const FRANCE_PATH = [
  // English Channel coast (NE → NW)
  "M515,54",  // Dunkerque 51.03°N 2.33°E
  "L483,60",  // Calais    50.95°N 1.85°E
  "L467,75",  // Boulogne  50.73°N 1.58°E
  "L452,123", // Le Tréport 50.06°N 1.37°E
  "L433,132", // Dieppe    49.93°N 1.08°E
  "L388,145", // Fécamp    49.76°N 0.38°E
  "L373,150", // Cap Antifer 49.69°N 0.17°E
  "L369,164", // Le Havre  49.49°N 0.11°E
  "L346,178", // Ouistreham 49.28°N -0.25°E
  // Cotentin peninsula hook (south coast → north tip → back south)
  "L255,153", // Cherbourg  49.64°N -1.62°E
  "L234,148", // Cap Hague  49.72°N -1.94°E
  "L239,162", // Flamanville 49.53°N -1.88°E
  "L257,210", // Granville  48.84°N -1.59°E
  // Brittany coast
  "L230,224", // Saint-Malo 48.65°N -2.01°E
  "L211,221", // Cap Fréhel 48.68°N -2.30°E
  "L99,219",  // Roscoff   48.72°N -3.99°E
  "L66,242",  // Brest     48.39°N -4.49°E
  "L51,267",  // Pte du Raz 48.03°N -4.73°E
  // Atlantic south
  "L141,287", // Lorient   47.75°N -3.37°E
  "L157,299", // Quiberon  47.49°N -3.12°E
  "L217,314", // Saint-Nazaire 47.27°N -2.20°E
  "L268,389", // Île de Ré 46.20°N -1.43°E
  "L286,391", // La Rochelle 46.16°N -1.15°E
  "L294,428", // Royan     45.63°N -1.03°E
  "L285,496", // Arcachon  44.66°N -1.17°E
  // Pyrenees (west → east)
  "L245,585", // Hendaye   43.37°N -1.78°E
  "L327,626", // Somport   42.78°N -0.53°E
  "L461,640", // Andorra   42.57°N  1.50°E
  "L570,651", // Cerbère   42.42°N  3.17°E
  // Mediterranean coast (SW → NE)
  "L559,598", // Narbonne  43.18°N  3.00°E
  "L590,591", // Cap d'Agde 43.28°N  3.46°E
  "L616,568", // Montpellier 43.61°N 3.87°E
  "L714,590", // Marseille  43.30°N  5.36°E
  "L751,602", // Toulon    43.12°N  5.93°E
  "L839,562", // Nice      43.70°N  7.26°E
  "L857,557", // Menton    43.77°N  7.52°E
  // Alpine borders (Italy → Switzerland → Germany/Rhine)
  "L816,454", // Mont Cenis 45.25°N  6.90°E
  "L770,395", // Geneva    46.10°N  6.20°E
  "L861,295", // Basel     47.55°N  7.59°E
  "L903,196", // Lauterbourg 48.97°N 8.23°E
  // Belgian/Luxembourg border (east → west)
  "L781,162", // Luxembourg 49.47°N  6.37°E
  "L679,116", // Givet     50.14°N  4.83°E
  "L604,97",  // Quiévrain 50.40°N  3.68°E
  "Z"
].join(" ");

// Belgium + southern Netherlands (approximate)
const BELGIUM_PATH = [
  "M530,55",  // France-Belgium coast border ~51.0°N 2.55°E
  "L579,31",  // Knokke coast  51.36°N 3.30°E
  "L642,22",  // Vlissingen border 51.48°N 4.22°E
  "L730,60",  // NL-BE border  51.00°N 5.65°E (Maastricht area)
  "L762,71",  // Aachen border 50.77°N 6.08°E
  "L778,104", // DE border S  50.30°N 6.32°E
  "L739,147", // Lux border   49.68°N 5.81°E
  "L679,116", // Givet (France) 50.14°N 4.83°E
  "L604,97",  // Quiévrain    50.40°N 3.68°E
  "L515,54",  // Dunkerque    51.03°N 2.33°E
  "Z"
].join(" ");

const PLANTS_DATA = [
  {name:"Doel",             lat:51.326, lon:4.258,  country:"BE", priority:"high"},
  {name:"Tihange",          lat:50.534, lon:5.276,  country:"BE", priority:"high"},
  {name:"Gravelines",       lat:51.015, lon:2.136,  country:"FR", priority:"high"},
  {name:"Chooz",            lat:50.089, lon:4.789,  country:"FR", priority:"high"},
  {name:"Cattenom",         lat:49.415, lon:6.218,  country:"FR", priority:"high"},
  {name:"Nogent-sur-Seine", lat:48.514, lon:3.518,  country:"FR", priority:"medium"},
  {name:"Tricastin",        lat:44.327, lon:4.732,  country:"FR", priority:"medium"},
  {name:"Bugey",            lat:45.798, lon:5.272,  country:"FR", priority:"medium"},
  {name:"Blayais",          lat:45.256, lon:-0.686, country:"FR", priority:"medium"},
  {name:"Golfech",          lat:44.106, lon:0.845,  country:"FR", priority:"low"},
  {name:"Belleville",       lat:47.514, lon:2.876,  country:"FR", priority:"low"},
  {name:"Chinon",           lat:47.230, lon:0.169,  country:"FR", priority:"low"},
  {name:"Civaux",           lat:46.443, lon:0.654,  country:"FR", priority:"low"},
  {name:"Cruas",            lat:44.633, lon:4.757,  country:"FR", priority:"low"},
  {name:"Dampierre",        lat:47.731, lon:2.518,  country:"FR", priority:"low"},
  {name:"Flamanville",      lat:49.538, lon:-1.881, country:"FR", priority:"low"},
  {name:"Paluel",           lat:49.859, lon:0.633,  country:"FR", priority:"low"},
  {name:"Penly",            lat:49.976, lon:1.210,  country:"FR", priority:"low"},
  {name:"Saint-Alban",      lat:45.407, lon:4.754,  country:"FR", priority:"low"},
  {name:"Saint-Laurent",    lat:47.721, lon:1.579,  country:"FR", priority:"low"},
];

const CITIES = [
  {name:"Maastricht",       lat:50.851, lon:5.691, flag:"🇳🇱", highlight:true},
  {name:"Traben-Trarbach",  lat:49.948, lon:7.116, flag:"🇩🇪", highlight:true},
  {name:"Paris",            lat:48.853, lon:2.350, flag:"🇫🇷", highlight:false},
  {name:"Brussels",         lat:50.850, lon:4.352, flag:"🇧🇪", highlight:false},
];

function degToRad(d) { return d * Math.PI / 180; }

function dirArrowChar(deg) {
  const dirs = ['↑','↗','→','↘','↓','↙','←','↖'];
  return dirs[Math.round(deg / 45) % 8];
}

function buildSVGMap(plantsJSON) {
  const liveMap = {};
  if (plantsJSON) plantsJSON.forEach(p => liveMap[p.name] = p);

  const statusColor = { ok:'#6daa45', watch:'#fdab43', risk:'#d163a7' };

  function windArrow(cx, cy, speed, dir) {
    if (!speed || speed < 1) return '';
    const rad = degToRad(dir - 90);
    const len = Math.min(38, 12 + speed * 0.65);
    const ex = cx + Math.cos(rad) * len;
    const ey = cy + Math.sin(rad) * len;
    const color = speed > 30 ? '#d163a7' : speed > 15 ? '#fdab43' : '#4f98a3';
    const dur = (1.4 + Math.random() * 0.8).toFixed(1);
    return `<line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}"
      stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="0.8">
      <animateTransform attributeName="transform" type="translate"
        values="0,0;${((ex-cx)*0.1).toFixed(1)},${((ey-cy)*0.1).toFixed(1)};0,0"
        dur="${dur}s" repeatCount="indefinite"/>
    </line>
    <circle cx="${ex}" cy="${ey}" r="2.5" fill="${color}" opacity="0.8"/>`;
  }

  let plantSVG = '';
  PLANTS_DATA.forEach(pd => {
    const {x, y} = lonLatToXY(pd.lon, pd.lat);
    const live = liveMap[pd.name] || {};
    const status = live.status || 'ok';
    const col = statusColor[status];
    const zs = live.zscore != null ? live.zscore : null;
    const label = pd.name.split('-')[0];
    const ws = live.wind_speed, wd = live.wind_dir;
    const r = pd.priority === 'high' ? 7 : pd.priority === 'medium' ? 5 : 3.5;
    const pulseVals = pd.priority === 'high' ? `${r};${r+2};${r}` : `${r};${r+1};${r}`;
    const dur = (2 + Math.random() * 2).toFixed(1);

    const isLow = pd.priority === 'low';
    const labelSize  = isLow ? '9'  : '11';
    const labelColor = isLow ? '#9a9996' : '#cdccca';
    const windColor  = !ws ? '#4f98a3' : ws > 30 ? '#d163a7' : ws > 15 ? '#fdab43' : '#4f98a3';
    const zLabel     = zs !== null && !isLow ? ` (z:${zs})` : '';
    const windLabel  = ws != null ? `${ws}km/h ${wd != null ? dirArrowChar(wd) : ''}` : '';

    plantSVG += `<g class="plant-marker" data-plant="${pd.name}" style="cursor:pointer">
      <circle cx="${x}" cy="${y}" r="${r}" fill="${col}"
        stroke="rgba(0,0,0,0.45)" stroke-width="1.5" opacity="0.95">
        <animate attributeName="r" values="${pulseVals}" dur="${dur}s" repeatCount="indefinite"/>
      </circle>
      <text x="${x + r + 3}" y="${y + 4}" font-size="${labelSize}" fill="${labelColor}"
        font-family="Satoshi,Inter,sans-serif">${label}${zLabel}</text>
      ${ws != null ? `<text x="${x + r + 3}" y="${y + 14}" font-size="9" fill="${windColor}"
        font-family="sans-serif" opacity="0.85">${windLabel}</text>` : ''}
      ${ws != null && wd != null ? windArrow(x, y, ws, wd) : ''}
    </g>`;
  });

  let citySVG = '';
  CITIES.forEach(c => {
    const {x, y} = lonLatToXY(c.lon, c.lat);
    const size = c.highlight ? 10 : 6;
    const stroke = c.highlight ? '#fdab43' : '#9a9996';
    const sw = c.highlight ? 2 : 1;
    citySVG += `<g class="city-marker">
      <rect x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}"
        fill="none" stroke="${stroke}" stroke-width="${sw}" rx="2"
        transform="rotate(45,${x},${y})"/>
      <text x="${x+12}" y="${y+4}" font-size="${c.highlight?12:10}" fill="${stroke}"
        font-family="Satoshi,Inter,sans-serif"
        font-weight="${c.highlight?'700':'400'}">${c.flag} ${c.name}</text>
    </g>`;
  });

  // Lat/lon grid
  const latLines = [43, 45, 47, 49, 51].map(lat => {
    const {y} = lonLatToXY(0, lat);
    return `<line x1="0" y1="${y}" x2="${MAP_W}" y2="${y}" stroke="#ffffff08" stroke-width="1"/>
            <text x="4" y="${y-3}" font-size="9" fill="#ffffff20">${lat}°N</text>`;
  }).join('');

  const lonLines = [-4, 0, 4, 8].map(lon => {
    const {x} = lonLatToXY(lon, 0);
    return `<line x1="${x}" y1="0" x2="${x}" y2="${MAP_H}" stroke="#ffffff08" stroke-width="1"/>
            <text x="${x+2}" y="${MAP_H-4}" font-size="9" fill="#ffffff20">${lon}°E</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;height:100%;border-radius:12px">
    <defs>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <rect width="${MAP_W}" height="${MAP_H}" fill="#0d1b2a" rx="12"/>
    <path d="${FRANCE_PATH}" fill="#1a2d1a" stroke="#2d4a2d" stroke-width="1.5"/>
    <path d="${BELGIUM_PATH}" fill="#1a1f2d" stroke="#2d3550" stroke-width="1"/>
    ${latLines}
    ${lonLines}
    ${plantSVG}
    ${citySVG}
    <g transform="translate(10,${MAP_H-62})">
      <rect width="162" height="57" rx="6" fill="rgba(0,0,0,0.6)"/>
      <circle cx="16" cy="14" r="5" fill="#6daa45"/>
      <text x="26" y="18" font-size="10" fill="#cdccca" font-family="sans-serif">Routine</text>
      <circle cx="16" cy="30" r="5" fill="#fdab43"/>
      <text x="26" y="34" font-size="10" fill="#cdccca" font-family="sans-serif">Watch</text>
      <circle cx="16" cy="46" r="5" fill="#d163a7"/>
      <text x="26" y="50" font-size="10" fill="#cdccca" font-family="sans-serif">Risk</text>
      <rect x="86" y="9" width="10" height="10" fill="none" stroke="#fdab43"
        stroke-width="2" rx="1" transform="rotate(45,91,14)"/>
      <text x="101" y="18" font-size="10" fill="#fdab43" font-family="sans-serif">Watch city</text>
      <rect x="86" y="25" width="8" height="8" fill="none" stroke="#9a9996"
        stroke-width="1" rx="1" transform="rotate(45,90,29)"/>
      <text x="101" y="34" font-size="10" fill="#9a9996" font-family="sans-serif">City</text>
    </g>
  </svg>`;
}
