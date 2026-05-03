// ukraine_map.js — SVG Ukraine nuclear map + wind-alignment toward Maastricht/Traben-Trarbach
// Bounding box: lon 22.0→41.0 lat 44.0→53.5  => viewBox 0 0 950 475

const UA_MAP_W = 950, UA_MAP_H = 475;
const UA_LON_MIN = 22.0, UA_LON_MAX = 41.0;
const UA_LAT_MIN = 44.0, UA_LAT_MAX = 53.5;

function lonLatToXY_UA(lon, lat) {
  const x = ((lon - UA_LON_MIN) / (UA_LON_MAX - UA_LON_MIN)) * UA_MAP_W;
  const y = UA_MAP_H - ((lat - UA_LAT_MIN) / (UA_LAT_MAX - UA_LAT_MIN)) * UA_MAP_H;
  return { x: Math.round(x), y: Math.round(y) };
}

// Ukraine outline — simplified ~22 boundary points, clockwise from SW (Transcarpathia)
const UKRAINE_PATH = [
  "M8,255",   // SW Transcarpathia  48.4°N 22.15°E
  "L25,180",  // NW                 49.9°N 22.5°E
  "L50,140",  // NW                 50.7°N 23.0°E
  "L80,110",  // N                  51.3°N 23.6°E
  "L125,100", // N Belarus border   51.5°N 24.5°E
  "L250,80",  // N mid              51.9°N 27.0°E
  "L475,60",  // N                  52.3°N 31.5°E
  "L590,70",  // NE Chernihiv       52.1°N 33.8°E
  "L725,125", // NE Russia border   51.0°N 36.5°E
  "L890,175", // E Kharkiv          50.0°N 39.8°E
  "L910,225", // E Luhansk          49.0°N 40.2°E
  "L855,290", // SE Donetsk         47.7°N 39.1°E
  "L815,335", // Azov coast         46.8°N 38.3°E
  "L740,350", // Azov W             46.5°N 36.8°E
  "L675,375", // Black Sea NE       46.0°N 35.5°E
  "L600,375", // Black Sea          46.0°N 34.0°E  (isthmus — Crimea below)
  "L450,375", // Black Sea W        46.0°N 31.0°E
  "L385,400", // Danube delta       45.5°N 29.7°E
  "L325,395", // Romania border     45.6°N 28.5°E
  "L300,360", // Moldova            46.3°N 28.0°E
  "L240,320", // Chernivtsi         47.1°N 26.8°E
  "Z"
].join(" ");

// Crimea peninsula (occupied territory — dashed border)
const CRIMEA_PATH = [
  "M600,375", // NW isthmus         46.0°N 34.0°E
  "L575,385", // isthmus narrows    45.8°N 33.5°E
  "L525,410", // W coast            45.3°N 32.5°E
  "L575,455", // S cape             44.4°N 33.5°E
  "L625,450", // SE                 44.5°N 34.5°E
  "L675,410", // E coast            45.3°N 35.5°E
  "L675,375", // NE join            46.0°N 35.5°E
  "Z"
].join(" ");

const UKRAINE_PLANTS_DATA = [
  { name:"Zaporizhzhia",  lat:47.510, lon:34.590, country:"UA", priority:"high", reactors:6,
    note:"Largest in Europe. Russian-occupied since 2022." },
  { name:"South Ukraine", lat:47.812, lon:31.215, country:"UA", priority:"high", reactors:3,
    note:"Yuzhnoukrainsk. Operational." },
  { name:"Khmelnytskyi",  lat:50.296, lon:26.658, country:"UA", priority:"high", reactors:2,
    note:"Netishyn. Operational, expansion planned." },
  { name:"Rivne",         lat:51.387, lon:25.895, country:"UA", priority:"high", reactors:4,
    note:"Varash. Operational." },
];

const UA_CITIES_INTERNAL = [
  { name:"Kyiv",    lat:50.450, lon:30.523, flag:"🇺🇦" },
  { name:"Kharkiv", lat:49.988, lon:36.233, flag:"🇺🇦" },
  { name:"Odesa",   lat:46.477, lon:30.732, flag:"🇺🇦" },
];

const MAASTRICHT_REF = { lat:50.851, lon:5.691,  name:"Maastricht" };
const TRABEN_REF     = { lat:49.948, lon:7.116,  name:"Traben-Trarbach" };

function dirArrowChar(deg) {
  const dirs = ['↑','↗','→','↘','↓','↙','←','↖'];
  return dirs[Math.round(deg / 45) % 8];
}

function _bearingTo(lat1, lon1, lat2, lon2) {
  const f1 = lat1 * Math.PI / 180, f2 = lat2 * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function _haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function buildUkraineMap(plantsJSON) {
  const liveMap = {};
  if (plantsJSON) plantsJSON.forEach(p => liveMap[p.name] = p);

  const statusColor = { ok:'#6daa45', watch:'#fdab43', risk:'#d163a7' };

  function windArrowUA(cx, cy, speed, dir) {
    if (!speed || speed < 1) return '';
    const rad = (dir - 90) * Math.PI / 180;
    const len = Math.min(50, 14 + speed * 0.8);
    const ex = cx + Math.cos(rad) * len;
    const ey = cy + Math.sin(rad) * len;
    const color = speed > 30 ? '#d163a7' : speed > 15 ? '#fdab43' : '#4f98a3';
    const dur = (2.0 + Math.random() * 0.8).toFixed(1);
    return `<line x1="${cx}" y1="${cy}" x2="${Math.round(ex)}" y2="${Math.round(ey)}"
      stroke="${color}" stroke-width="2.5" stroke-linecap="round" opacity="0.85">
      <animateTransform attributeName="transform" type="translate"
        values="0,0;${((ex-cx)*0.1).toFixed(1)},${((ey-cy)*0.1).toFixed(1)};0,0"
        dur="${dur}s" repeatCount="indefinite"/>
    </line>
    <circle cx="${Math.round(ex)}" cy="${Math.round(ey)}" r="3" fill="${color}" opacity="0.85"/>`;
  }

  // Dashed bearing arrow toward Maastricht (always drawn), colour by wind alignment
  function bearingGuide(cx, cy, fromLat, fromLon, windDir) {
    const bear = _bearingTo(fromLat, fromLon, MAASTRICHT_REF.lat, MAASTRICHT_REF.lon);
    const rad = (bear - 90) * Math.PI / 180;
    const len = 38;
    const ex = cx + Math.cos(rad) * len;
    const ey = cy + Math.sin(rad) * len;
    const delta = windDir != null ? Math.abs(((windDir - bear) + 360) % 360) : 999;
    const aligned = delta < 45 || delta > 315;
    const color = aligned ? '#d163a7' : '#5591c7';
    const opacity = aligned ? '0.9' : '0.45';
    return `<line x1="${cx}" y1="${cy}" x2="${Math.round(ex)}" y2="${Math.round(ey)}"
      stroke="${color}" stroke-width="1.5" stroke-dasharray="4,3" opacity="${opacity}"/>
      <circle cx="${Math.round(ex)}" cy="${Math.round(ey)}" r="2" fill="${color}" opacity="${opacity}"/>`;
  }

  let plantSVG = '';
  UKRAINE_PLANTS_DATA.forEach(pd => {
    const {x, y} = lonLatToXY_UA(pd.lon, pd.lat);
    const live = liveMap[pd.name] || {};
    const status = live.status || 'ok';
    const col = statusColor[status];
    const zsRaw = live.zscore != null ? Math.abs(live.zscore) : 0;
    const zs = live.zscore != null ? parseFloat(live.zscore).toFixed(1) : '—';
    const ws = live.wind_speed, wd = live.wind_dir;
    const r = 8;

    const bear = _bearingTo(pd.lat, pd.lon, MAASTRICHT_REF.lat, MAASTRICHT_REF.lon);
    const delta = wd != null ? Math.abs(((wd - bear) + 360) % 360) : 999;
    const aligned = delta < 45 || delta > 315;
    const windLine = ws != null ? `${ws} km/h ${dirArrowChar(wd ?? 0)}${aligned ? ' ⚠' : ''}` : '—';
    const zsColor = zsRaw > 2 ? '#d163a7' : zsRaw > 1 ? '#fdab43' : '#9a9996';
    const statusLabel = status === 'risk' ? 'Risk' : status === 'watch' ? 'Watch' : 'Routine';

    const lx = x + r + 5;
    const ly = y < 30 ? y + 8 : y - 10;

    plantSVG += `<g class="ua-plant-marker" data-plant="${pd.name}" style="cursor:pointer">
      <circle cx="${x}" cy="${y}" r="${r}" fill="${col}"
        stroke="rgba(0,0,0,0.5)" stroke-width="1.5" opacity="0.95">
        <animate attributeName="r" values="${r};${r+3};${r}" dur="2.8s" repeatCount="indefinite"/>
      </circle>
      ${bearingGuide(x, y, pd.lat, pd.lon, wd)}
      ${ws != null && wd != null ? windArrowUA(x, y, ws, wd) : ''}
      <rect x="${lx}" y="${ly}" width="160" height="54" rx="4"
        fill="rgba(0,0,0,0.62)" stroke="rgba(255,255,255,0.07)" stroke-width="0.5"/>
      <text x="${lx+6}" y="${ly+13}" font-size="11" fill="${col}"
        font-family="Satoshi,Inter,sans-serif" font-weight="600">${pd.name}</text>
      <text x="${lx+6}" y="${ly+26}" font-size="9" fill="${aligned ? '#d163a7' : '#5591c7'}"
        font-family="sans-serif">• Wind: ${windLine}</text>
      <text x="${lx+6}" y="${ly+38}" font-size="9" fill="${zsColor}"
        font-family="sans-serif">• z-score: ${zs}</text>
      <text x="${lx+6}" y="${ly+50}" font-size="9" fill="${col}"
        font-family="sans-serif">• ${statusLabel}</text>
    </g>`;
  });

  let citySVG = '';
  UA_CITIES_INTERNAL.forEach(c => {
    const {x, y} = lonLatToXY_UA(c.lon, c.lat);
    citySVG += `<g class="ua-city">
      <circle cx="${x}" cy="${y}" r="4" fill="none" stroke="#9a9996" stroke-width="1"/>
      <text x="${x+8}" y="${y+4}" font-size="10" fill="#9a9996"
        font-family="sans-serif">${c.flag} ${c.name}</text>
    </g>`;
  });

  const latLines = [45, 47, 49, 51, 53].map(lat => {
    const {y} = lonLatToXY_UA(22, lat);
    return `<line x1="0" y1="${y}" x2="${UA_MAP_W}" y2="${y}" stroke="#ffffff08" stroke-width="1"/>
            <text x="4" y="${y-3}" font-size="9" fill="#ffffff20">${lat}°N</text>`;
  }).join('');

  const lonLines = [24, 28, 32, 36, 40].map(lon => {
    const {x} = lonLatToXY_UA(lon, 44);
    return `<line x1="${x}" y1="0" x2="${x}" y2="${UA_MAP_H}" stroke="#ffffff08" stroke-width="1"/>
            <text x="${x+2}" y="${UA_MAP_H-4}" font-size="9" fill="#ffffff20">${lon}°E</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${UA_MAP_W} ${UA_MAP_H}" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;height:100%;border-radius:12px">
    <defs>
      <filter id="ua-glow">
        <feGaussianBlur stdDeviation="2.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <rect width="${UA_MAP_W}" height="${UA_MAP_H}" fill="#0d1b2a" rx="12"/>
    <path d="${UKRAINE_PATH}" fill="#1f2d1a" stroke="#304d30" stroke-width="1.5"/>
    <path d="${CRIMEA_PATH}" fill="#2d1a1a" stroke="#4d3030" stroke-width="1" stroke-dasharray="5,3"/>
    ${latLines}
    ${lonLines}
    ${plantSVG}
    ${citySVG}
    <!-- Bearing legend label at left edge -->
    <text x="6" y="18" font-size="10" fill="#fdab43" font-family="sans-serif" font-weight="600">◀ Maastricht / Traben-Trarbach (west, ~1400–2200 km)</text>
    <line x1="0" y1="22" x2="${UA_MAP_W}" y2="22" stroke="#fdab4318" stroke-width="1" stroke-dasharray="6,5"/>
    <!-- Crimea note -->
    <text x="${UA_MAP_W-218}" y="${UA_MAP_H-8}" font-size="9" fill="#ffffff30"
      font-family="sans-serif">Crimea: occupied territory (dashed border)</text>
    <!-- Legend -->
    <g transform="translate(10,${UA_MAP_H-80})">
      <rect width="260" height="75" rx="6" fill="rgba(0,0,0,0.65)"/>
      <circle cx="16" cy="14" r="6" fill="#6daa45"/>
      <text x="28" y="18" font-size="10" fill="#cdccca" font-family="sans-serif">Routine</text>
      <circle cx="16" cy="32" r="6" fill="#fdab43"/>
      <text x="28" y="36" font-size="10" fill="#cdccca" font-family="sans-serif">Watch</text>
      <circle cx="16" cy="50" r="6" fill="#d163a7"/>
      <text x="28" y="54" font-size="10" fill="#cdccca" font-family="sans-serif">Risk</text>
      <line x1="108" y1="14" x2="138" y2="14" stroke="#d163a7" stroke-width="2" stroke-dasharray="4,3"/>
      <text x="143" y="18" font-size="10" fill="#d163a7" font-family="sans-serif">Wind → Maastricht (aligned)</text>
      <line x1="108" y1="32" x2="138" y2="32" stroke="#5591c7" stroke-width="2" stroke-dasharray="4,3"/>
      <text x="143" y="36" font-size="10" fill="#5591c7" font-family="sans-serif">Bearing to Maastricht</text>
      <line x1="108" y1="50" x2="138" y2="50" stroke="#fdab43" stroke-width="2"/>
      <text x="143" y="54" font-size="10" fill="#fdab43" font-family="sans-serif">Wind vector</text>
    </g>
  </svg>`;
}

function buildUkraineWindAlignment(plantsJSON) {
  const liveMap = {};
  if (plantsJSON) plantsJSON.forEach(p => liveMap[p.name] = p);

  const targets = [MAASTRICHT_REF, TRABEN_REF];

  const rows = [];
  UKRAINE_PLANTS_DATA.forEach(pd => {
    const live = liveMap[pd.name] || {};
    const wd = live.wind_dir, ws = live.wind_speed;
    targets.forEach(t => {
      const bearing = Math.round(_bearingTo(pd.lat, pd.lon, t.lat, t.lon));
      const dist    = Math.round(_haversineKm(pd.lat, pd.lon, t.lat, t.lon));
      const delta   = wd != null ? Math.round(Math.abs(((wd - bearing) + 360) % 360)) : null;
      const aligned = delta != null && (delta < 45 || delta > 315);
      const hours   = ws && ws > 0 ? (dist / ws).toFixed(0) : null;
      rows.push({ pd, t, bearing, dist, delta, aligned, hours, ws, wd });
    });
  });

  // Aligned pairs first
  rows.sort((a, b) => (b.aligned ? 1 : 0) - (a.aligned ? 1 : 0));

  if (!rows.length) return '<p class="tiny">No Ukraine plant data available.</p>';

  return rows.map(r => {
    const cls = r.aligned ? 'risk' : 'ok';
    const lbl = r.aligned ? '⚠ Wind aligned' : 'Not aligned';
    return `<div class="item" style="flex-direction:column;gap:3px;${r.aligned ? 'border-color:var(--color-error);background:color-mix(in oklab,var(--color-error) 6%,var(--color-surface-2))' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <strong style="font-size:var(--text-xs)">${r.pd.name} → ${r.t.name}</strong>
        <span class="badge ${cls}" style="font-size:10px">${lbl}</span>
      </div>
      <small>Bearing: ${r.bearing}° | Wind dir: ${r.wd != null ? r.wd+'°' : '—'} | Δ ${r.delta != null ? r.delta+'°' : '—'}</small>
      <small>Distance: ${r.dist} km${r.hours ? ' | Transit ~'+r.hours+'h @ '+r.ws+' km/h' : ''}</small>
    </div>`;
  }).join('');
}
