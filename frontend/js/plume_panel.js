// plume_panel.js — Plume travel-time calculator: plant → monitored cities

const PLUME_TARGETS = [
  { name: 'Maastricht',      lat: 50.851, lon: 5.691, flag: '🇳🇱' },
  { name: 'Traben-Trarbach', lat: 49.948, lon: 7.116, flag: '🇩🇪' },
];

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function bearingDeg(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function angleDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function buildPlumePanel(plants) {
  const withWind = (plants || []).filter(p => p.wind_speed > 0 && p.wind_dir != null);

  const rows = [];
  withWind.forEach(p => {
    PLUME_TARGETS.forEach(t => {
      const dist = haversineKm(p.lat, p.lon, t.lat, t.lon);
      const bear = bearingDeg(p.lat, p.lon, t.lat, t.lon);
      const diff = angleDiff(p.wind_dir, bear);
      const isAligned = diff <= 45;
      rows.push({ plant: p, target: t, dist, bear, diff, isAligned, hours: dist / p.wind_speed });
    });
  });

  // Aligned first, then sorted by travel time
  rows.sort((a, b) => {
    if (a.isAligned !== b.isAligned) return a.isAligned ? -1 : 1;
    return a.hours - b.hours;
  });

  const tableRows = rows.map(r => {
    const hrs = r.hours;
    const timeText = hrs < 1 ? `${Math.round(hrs * 60)} min` : `${hrs.toFixed(1)} h`;
    const alignCls = r.diff <= 30 ? 'risk' : r.diff <= 60 ? 'watch' : 'ok';
    const alignLbl = r.diff <= 30 ? 'Direct' : r.diff <= 60 ? 'Partial' : 'Away';
    const zAbs = Math.abs(r.plant.zscore || 0);
    const zCls = zAbs >= 2 ? 'risk' : zAbs >= 1 ? 'watch' : 'ok';
    const rowBg = r.isAligned ? ' style="background:color-mix(in oklab,var(--color-error) 6%,transparent)"' : '';
    return `<tr${rowBg}>
      <td><strong>${r.plant.name}</strong></td>
      <td>${r.target.flag} ${r.target.name}</td>
      <td>${Math.round(r.dist)} km</td>
      <td>${r.plant.wind_speed} km/h @ ${r.plant.wind_dir}°</td>
      <td><strong>${timeText}</strong></td>
      <td><span class="badge ${alignCls}" style="font-size:10px">${alignLbl} (${Math.round(r.diff)}°off)</span></td>
      <td><span class="badge ${zCls}" style="font-size:10px">z=${r.plant.zscore || 0}</span></td>
    </tr>`;
  }).join('');

  const topThreats = rows.filter(r => r.isAligned).slice(0, 3);
  const threatSummary = topThreats.length
    ? topThreats.map(r =>
        `<strong>${r.plant.name}</strong> → ${r.target.name} in <strong>${r.hours.toFixed(1)}h</strong>`
      ).join(' · ')
    : 'No plant wind currently aligned toward monitored cities.';

  const alertColor = topThreats.length ? 'orange' : 'success';

  // SVG mini-map showing alignment arcs
  const miniMapSVG = buildPlumeMap(rows);

  return `
    <section class="grid">
      <article class="card span-7">
        <h3>Plume Travel-Time Calculator</h3>
        <p>Time for airborne material to reach Maastricht or Traben-Trarbach at current wind speed. Within ±45° of bearing = aligned.</p>
        <div class="footer-note" style="margin:var(--space-4) 0;border-left:3px solid var(--color-${alertColor})">
          <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-1)">ALIGNED WIND THREATS NOW</div>
          <p style="font-size:var(--text-sm)">${threatSummary}</p>
        </div>
        <table class="table">
          <thead><tr>
            <th>Plant</th><th>Target</th><th>Dist</th><th>Wind</th><th>Travel time</th><th>Alignment</th><th>Z-score</th>
          </tr></thead>
          <tbody>${tableRows || '<tr><td colspan="7">No wind data available.</td></tr>'}</tbody>
        </table>
      </article>
      <article class="card span-5">
        <h3>Wind Alignment Map</h3>
        <p>Lines show current wind direction from each plant. Red = aligned toward a monitored city.</p>
        <div style="margin-top:var(--space-3)">${miniMapSVG}</div>
        <div class="footer-note" style="margin-top:var(--space-4)">
          <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-1)">⚠ FIRST-ORDER ESTIMATE ONLY</div>
          <p style="font-size:var(--text-xs)">Assumes constant 10m wind, straight-line trajectory. Real plume transport needs a Lagrangian model (ARGOS, FLEXPART) accounting for wind shear, turbulence, and atmospheric stability. Actual arrival can be 2–5× longer due to meandering. Use as a triage signal only.</p>
        </div>
      </article>
    </section>`;
}

function buildPlumeMap(rows) {
  // Reuse the same bounding box as the SVG map (globals from map_data.js)
  const W = 460, H = 340;

  function xy(lon, lat) {
    return {
      x: ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * W,
      y: H - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * H,
    };
  }

  // Target city markers
  let cities = PLUME_TARGETS.map(t => {
    const { x, y } = xy(t.lon, t.lat);
    return `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" fill="none"
      stroke="#fdab43" stroke-width="2" rx="2" transform="rotate(45,${x},${y})"/>
      <text x="${x + 12}" y="${y + 4}" font-size="10" fill="#fdab43" font-family="sans-serif">${t.flag} ${t.name}</text>`;
  }).join('');

  // Wind direction lines (deduplicated per plant, use first row per plant)
  const seen = new Set();
  let arrows = '';
  rows.forEach(r => {
    if (seen.has(r.plant.name)) return;
    seen.add(r.plant.name);
    const { x, y } = xy(r.plant.lon, r.plant.lat);
    const rad = (r.plant.wind_dir - 90) * Math.PI / 180;
    const len = 28 + r.plant.wind_speed * 0.5;
    const ex = x + Math.cos(rad) * len;
    const ey = y + Math.sin(rad) * len;

    // Check alignment to any target
    const aligned = PLUME_TARGETS.some(t => {
      const bear = bearingDeg(r.plant.lat, r.plant.lon, t.lat, t.lon);
      return angleDiff(r.plant.wind_dir, bear) <= 45;
    });
    const col = aligned ? '#d163a7' : '#4f98a3';

    arrows += `<line x1="${x}" y1="${y}" x2="${ex}" y2="${ey}" stroke="${col}" stroke-width="2" stroke-linecap="round" opacity="0.85"/>
      <circle cx="${ex}" cy="${ey}" r="3" fill="${col}" opacity="0.85"/>
      <circle cx="${x}" cy="${y}" r="4" fill="${col}" opacity="0.7"/>
      <text x="${x + 6}" y="${y - 6}" font-size="9" fill="#cdccca" font-family="sans-serif">${r.plant.name.split('-')[0]}</text>`;
  });

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:220px;background:#0d1b2a;border-radius:10px">
    <rect width="${W}" height="${H}" fill="#0d1b2a" rx="10"/>
    <!-- Grid -->
    ${[43, 45, 47, 49, 51].map(lat => {
      const { y } = xy(0, lat);
      return `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#ffffff08" stroke-width="1"/>
              <text x="2" y="${y - 2}" font-size="8" fill="#ffffff20">${lat}°N</text>`;
    }).join('')}
    ${[-4, 0, 4, 8].map(lon => {
      const { x } = xy(lon, 0);
      return `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#ffffff08" stroke-width="1"/>`;
    }).join('')}
    ${arrows}
    ${cities}
    <!-- Legend -->
    <g transform="translate(4,${H - 36})">
      <rect width="140" height="32" rx="4" fill="rgba(0,0,0,0.6)"/>
      <line x1="8" y1="10" x2="28" y2="10" stroke="#d163a7" stroke-width="2"/>
      <text x="32" y="14" font-size="9" fill="#cdccca" font-family="sans-serif">Aligned</text>
      <line x1="8" y1="24" x2="28" y2="24" stroke="#4f98a3" stroke-width="2"/>
      <text x="32" y="28" font-size="9" fill="#cdccca" font-family="sans-serif">Not aligned</text>
    </g>
  </svg>`;
}
