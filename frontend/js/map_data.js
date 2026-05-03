// map_data.js — SVG France map geometry + coordinate projection
// Bounding box: lon -5.5→9.7 lat 42.3→51.1  => viewBox 0 0 1000 680

const MAP_W = 1000, MAP_H = 680;
const LON_MIN = -5.5, LON_MAX = 9.7, LAT_MIN = 42.3, LAT_MAX = 51.1;

function lonLatToXY(lon, lat) {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * MAP_W;
  const y = MAP_H - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * MAP_H;
  return { x: Math.round(x), y: Math.round(y) };
}

// France outline — simplified polygon (Natural Earth)
const FRANCE_PATH = "M220,10 L250,18 L290,12 L340,5 L380,15 L430,8 L480,20 L520,15 L560,30 L600,20 L650,30 L700,15 L750,28 L780,40 L810,35 L840,55 L870,50 L890,70 L910,90 L930,110 L950,130 L960,155 L950,175 L970,200 L980,225 L960,250 L950,270 L930,290 L910,310 L880,330 L850,355 L830,380 L800,395 L770,410 L740,430 L720,455 L700,475 L670,490 L650,505 L620,520 L600,540 L580,560 L555,575 L530,590 L510,610 L490,625 L465,640 L440,650 L410,660 L380,665 L350,670 L320,668 L295,660 L270,648 L245,635 L225,620 L210,600 L195,580 L180,560 L165,540 L148,520 L130,500 L115,480 L100,460 L85,435 L70,415 L55,390 L42,365 L30,340 L22,315 L15,290 L10,265 L8,240 L10,215 L15,190 L20,165 L28,142 L38,120 L50,100 L65,82 L82,65 L100,50 L120,38 L145,28 L170,18 L195,12 Z";

// Belgian + Netherlands coast simplified
const BELGIUM_PATH = "M560,30 L600,20 L650,30 L700,15 L750,28 L780,40 L810,35 L800,80 L770,95 L730,85 L700,100 L670,90 L640,105 L610,95 L580,110 L555,100 L530,88 L510,75 L490,62 L470,50 L450,38 L430,28 Z";

const GERMANY_SIMPLIFIED = "M810,35 L840,55 L870,50 L890,70 L910,90 L930,110 L950,130 L960,155 L950,175 L970,200 L960,220 L940,210 L920,225 L900,215 L880,230 L860,220 L840,235 L820,225 L800,240 L780,230 L760,245 L740,235 L720,250 L700,240 L690,225 L700,205 L710,185 L720,165 L730,145 L740,125 L750,105 L760,85 L770,65 L780,45 Z";

const SPAIN_SIMPLIFIED = "M8,240 L10,265 L15,290 L22,315 L15,330 L10,350 L5,370 L2,395 L5,420 L10,445 L20,470 L35,490 L55,505 L75,515 L100,520 L125,525 L150,528 L175,525 L200,518 L220,510 L235,500 L245,485 L240,465 L230,445 L220,425 L210,405 L200,385 L192,365 L185,340 L180,560 L165,540 L148,520 L130,500 L115,480 L100,460 L85,435 L70,415 L55,390 L42,365 L30,340 L22,315 L15,290 L10,265 Z";

const PLANTS_DATA = [
  {name:"Doel",         lat:51.326, lon:4.258,  country:"BE", priority:"high"},
  {name:"Tihange",      lat:50.534, lon:5.276,  country:"BE", priority:"high"},
  {name:"Gravelines",   lat:51.015, lon:2.136,  country:"FR", priority:"high"},
  {name:"Chooz",        lat:50.089, lon:4.789,  country:"FR", priority:"high"},
  {name:"Cattenom",     lat:49.415, lon:6.218,  country:"FR", priority:"high"},
  {name:"Nogent-sur-Seine",lat:48.514,lon:3.518,country:"FR",priority:"medium"},
  {name:"Tricastin",    lat:44.327, lon:4.732,  country:"FR", priority:"medium"},
  {name:"Bugey",        lat:45.798, lon:5.272,  country:"FR", priority:"medium"},
  {name:"Blayais",      lat:45.256, lon:-0.686, country:"FR", priority:"medium"},
  {name:"Golfech",      lat:44.106, lon:0.845,  country:"FR", priority:"low"},
  {name:"Belleville",   lat:47.514, lon:2.876,  country:"FR", priority:"low"},
  {name:"Chinon",       lat:47.230, lon:0.169,  country:"FR", priority:"low"},
  {name:"Civaux",       lat:46.443, lon:0.654,  country:"FR", priority:"low"},
  {name:"Cruas",        lat:44.633, lon:4.757,  country:"FR", priority:"low"},
  {name:"Dampierre",    lat:47.731, lon:2.518,  country:"FR", priority:"low"},
  {name:"Flamanville",  lat:49.538, lon:-1.881, country:"FR", priority:"low"},
  {name:"Paluel",       lat:49.859, lon:0.633,  country:"FR", priority:"low"},
  {name:"Penly",        lat:49.976, lon:1.210,  country:"FR", priority:"low"},
  {name:"Saint-Alban",  lat:45.407, lon:4.754,  country:"FR", priority:"low"},
  {name:"Saint-Laurent",lat:47.721, lon:1.579,  country:"FR", priority:"low"},
];

// Notable cities
const CITIES = [
  {name:"Maastricht",  lat:50.851, lon:5.691, flag:"🇳🇱", highlight:true},
  {name:"Traben-Trarbach", lat:49.948, lon:7.116, flag:"🇩🇪", highlight:true},
  {name:"Paris",       lat:48.853, lon:2.350, flag:"🇫🇷", highlight:false},
  {name:"Brussels",    lat:50.850, lon:4.352, flag:"🇧🇪", highlight:false},
];

function degToRad(d){ return d * Math.PI / 180; }

function buildSVGMap(plantsJSON) {
  // Merge live data into plant definitions
  const liveMap = {};
  if (plantsJSON) plantsJSON.forEach(p => liveMap[p.name] = p);

  const statusColor = { ok:'#6daa45', watch:'#fdab43', risk:'#d163a7' };

  // Wind arrow helper
  function windArrow(cx, cy, speed, dir) {
    if (!speed || speed < 1) return '';
    const rad = degToRad(dir - 90);
    const len = Math.min(40, 15 + speed * 0.7);
    const ex = cx + Math.cos(rad) * len;
    const ey = cy + Math.sin(rad) * len;
    const color = speed > 30 ? '#d163a7' : speed > 15 ? '#fdab43' : '#4f98a3';
    return `<line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}" 
      stroke="${color}" stroke-width="2.5" stroke-linecap="round" opacity="0.85">
      <animateTransform attributeName="transform" type="translate"
        values="0,0;${(ex-cx)*0.12},${(ey-cy)*0.12};0,0"
        dur="${1.5 + Math.random()}s" repeatCount="indefinite"/>
    </line>
    <circle cx="${ex}" cy="${ey}" r="3" fill="${color}" opacity="0.85"/>`;
  }

  // Plant markers
  let plantSVG = '';
  PLANTS_DATA.forEach(pd => {
    const {x, y} = lonLatToXY(pd.lon, pd.lat);
    const live = liveMap[pd.name] || {};
    const status = live.status || 'ok';
    const col = statusColor[status];
    const zs = live.zscore != null ? live.zscore : null;
    const label = pd.name.split('-')[0];
    const ws = live.wind_speed, wd = live.wind_dir;

    plantSVG += `<g class="plant-marker" data-plant="${pd.name}" style="cursor:pointer">
      <circle cx="${x}" cy="${y}" r="${pd.priority==='high'?7:pd.priority==='medium'?5:4}"
        fill="${col}" stroke="rgba(0,0,0,0.5)" stroke-width="1.5" opacity="0.95">
        <animate attributeName="r" values="${pd.priority==='high'?'7;9;7':'5;6;5'}"
          dur="${2+Math.random()*2}s" repeatCount="indefinite"/>
      </circle>
      ${pd.priority !== 'low' ? `<text x="${x+10}" y="${y+4}" font-size="11" fill="#cdccca"
        font-family="Satoshi,Inter,sans-serif">${label}${zs!==null?' (z:'+zs+')':''}</text>` : ''}
      ${ws && wd ? windArrow(x, y, ws, wd) : ''}
    </g>`;
  });

  // City markers
  let citySVG = '';
  CITIES.forEach(c => {
    const {x, y} = lonLatToXY(c.lon, c.lat);
    const size = c.highlight ? 10 : 6;
    const stroke = c.highlight ? '#fdab43' : '#9a9996';
    const sw = c.highlight ? 2 : 1;
    citySVG += `<g class="city-marker">
      <rect x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}"
        fill="none" stroke="${stroke}" stroke-width="${sw}" rx="2" transform="rotate(45,${x},${y})"/>
      <text x="${x+12}" y="${y+4}" font-size="${c.highlight?12:10}" fill="${stroke}"
        font-family="Satoshi,Inter,sans-serif" font-weight="${c.highlight?'700':'400'}">${c.flag} ${c.name}</text>
    </g>`;
  });

  return `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;height:100%;border-radius:12px">
    <defs>
      <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <!-- Ocean background -->
    <rect width="${MAP_W}" height="${MAP_H}" fill="#0d1b2a" rx="12"/>
    <!-- Country fills -->
    <path d="${FRANCE_PATH}" fill="#1a2d1a" stroke="#2d4a2d" stroke-width="1.5"/>
    <path d="${BELGIUM_PATH}" fill="#1a1f2d" stroke="#2d3550" stroke-width="1"/>
    <!-- Grid lines (lat/lon) -->
    ${[44,46,48,50].map(lat => {
      const {y} = lonLatToXY(0, lat);
      return `<line x1="0" y1="${y}" x2="${MAP_W}" y2="${y}" stroke="#ffffff08" stroke-width="1"/>
              <text x="4" y="${y-3}" font-size="9" fill="#ffffff20">${lat}°N</text>`;
    }).join('')}
    ${[-4,0,4,8].map(lon => {
      const {x} = lonLatToXY(lon, 0);
      return `<line x1="${x}" y1="0" x2="${x}" y2="${MAP_H}" stroke="#ffffff08" stroke-width="1"/>
              <text x="${x+2}" y="${MAP_H-4}" font-size="9" fill="#ffffff20">${lon}°E</text>`;
    }).join('')}
    <!-- Plants -->
    ${plantSVG}
    <!-- Cities -->
    ${citySVG}
    <!-- Legend -->
    <g transform="translate(10,${MAP_H-60})">
      <rect width="160" height="55" rx="6" fill="rgba(0,0,0,0.55)"/>
      <circle cx="16" cy="14" r="5" fill="#6daa45"/>
      <text x="26" y="18" font-size="10" fill="#cdccca" font-family="sans-serif">Routine</text>
      <circle cx="16" cy="30" r="5" fill="#fdab43"/>
      <text x="26" y="34" font-size="10" fill="#cdccca" font-family="sans-serif">Watch</text>
      <circle cx="16" cy="46" r="5" fill="#d163a7"/>
      <text x="26" y="50" font-size="10" fill="#cdccca" font-family="sans-serif">Risk</text>
      <rect x="85" y="9" width="10" height="10" fill="none" stroke="#fdab43" stroke-width="2" rx="1" transform="rotate(45,90,14)"/>
      <text x="100" y="18" font-size="10" fill="#fdab43" font-family="sans-serif">Watch city</text>
      <rect x="85" y="25" width="8" height="8" fill="none" stroke="#9a9996" stroke-width="1" rx="1" transform="rotate(45,89,29)"/>
      <text x="100" y="34" font-size="10" fill="#9a9996" font-family="sans-serif">City</text>
    </g>
  </svg>`;
}
