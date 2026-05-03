// zscore_panel.js — Z-score educational panel with normal distribution SVG

function buildZScorePanel(plants) {
  // Find highest absolute z-score among plants with data
  let topPlant = null;
  let topZ = 0;
  (plants || []).forEach(p => {
    if (p.zscore != null && Math.abs(p.zscore) > Math.abs(topZ)) {
      topZ = p.zscore; topPlant = p.name;
    }
  });

  // Normal distribution SVG curve
  function normalCurve(highlightZ) {
    const W = 380, H = 100;
    // Generate bell curve points
    const pts = [];
    for (let i = 0; i <= 100; i++) {
      const z = -4 + i * 0.08;
      const y = Math.exp(-0.5 * z * z);
      const px = ((z + 4) / 8) * W;
      const py = H - 10 - y * (H - 20);
      pts.push(`${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`);
    }
    // Shade area beyond |highlightZ|
    const shade = Math.min(Math.abs(highlightZ), 4);
    const leftX = ((-shade + 4) / 8) * W;
    const rightX = ((shade + 4) / 8) * W;
    const baseY = H - 10;

    // z markers
    const zLines = [-3,-2,-1,0,1,2,3].map(z => {
      const x = ((z + 4) / 8) * W;
      const isShaded = Math.abs(z) >= shade && shade > 0.5;
      return `<line x1="${x}" y1="0" x2="${x}" y2="${baseY}" 
        stroke="${isShaded ? '#d163a7' : '#ffffff18'}" stroke-width="${z===0?1.5:1}" stroke-dasharray="3,3"/>
        <text x="${x}" y="${baseY+12}" text-anchor="middle" font-size="9" fill="#9a9996">${z}σ</text>`;
    }).join('');

    // Current z marker
    const clampedZ = Math.max(-4, Math.min(4, highlightZ));
    const czX = ((clampedZ + 4) / 8) * W;
    const czLabel = highlightZ !== 0 ? `<line x1="${czX}" y1="0" x2="${czX}" y2="${baseY}"
      stroke="#fdab43" stroke-width="2"/>
      <circle cx="${czX}" cy="${baseY - 5}" r="4" fill="#fdab43"/>
      <text x="${czX}" y="-4" text-anchor="middle" font-size="10" fill="#fdab43" font-weight="700">z=${highlightZ.toFixed(1)}</text>` : '';

    return `<svg viewBox="0 0 ${W} ${H+20}" style="width:100%;height:120px">
      <!-- Tail shading -->
      ${shade > 0.5 ? `
        <path d="${pts.slice(0, Math.round((4-shade)/8*100)).join(' ')} L${leftX},${baseY} L0,${baseY} Z" 
          fill="rgba(209,99,167,0.15)"/>
        <path d="${pts.slice(Math.round((4+shade)/8*100)).join(' ')} L${W},${baseY} L${rightX},${baseY} Z"
          fill="rgba(209,99,167,0.15)"/>` : ''}
      <!-- Bell curve -->
      <path d="${pts.join(' ')} L${W},${baseY} L0,${baseY} Z" 
        fill="rgba(79,152,163,0.15)" stroke="#4f98a3" stroke-width="1.5" fill-opacity="0.4"/>
      ${zLines}
      ${czLabel}
    </svg>`;
  }

  // Interpretation table rows
  const rows = [
    { z:'0',   pct:'50%',   cls:'ok',    meaning:'Exactly average — no anomaly' },
    { z:'±1',  pct:'31.7%', cls:'ok',    meaning:'Normal day-to-day variation' },
    { z:'±2',  pct:'4.6%',  cls:'watch', meaning:'Unusual — flag for review' },
    { z:'±3',  pct:'0.27%', cls:'watch', meaning:'Rare — investigate cross-sources' },
    { z:'±4',  pct:'0.006%',cls:'risk',  meaning:'Extreme — escalate if confirmed' },
  ].map(r => `<tr>
    <td><code>${r.z}</code></td>
    <td>${r.pct}</td>
    <td><span class="badge ${r.cls}" style="font-size:10px">${r.cls.toUpperCase()}</span></td>
    <td style="color:var(--color-text-muted);font-size:var(--text-xs)">${r.meaning}</td>
  </tr>`).join('');

  // Accident probability framing
  const zAbs = Math.abs(topZ);
  let interpretation = 'All readings within expected background range.';
  let intClass = 'ok';
  if (topPlant && zAbs >= 4) {
    interpretation = `<strong>${topPlant}</strong> z=${topZ.toFixed(2)}: Extreme anomaly. This reading would occur by chance in fewer than 1 in 15,000 cycles. Requires immediate cross-source confirmation. Does NOT confirm a release — equipment fault, rain scavenging, or a nearby non-nuclear source must be ruled out first.`;
    intClass = 'risk';
  } else if (topPlant && zAbs >= 3) {
    interpretation = `<strong>${topPlant}</strong> z=${topZ.toFixed(2)}: Rare deviation (top 0.27% of normal readings). Check wind direction for plume transport, review ASN/FANC RSS, and compare with neighbouring Safecast stations.`;
    intClass = 'watch';
  } else if (topPlant && zAbs >= 2) {
    interpretation = `<strong>${topPlant}</strong> z=${topZ.toFixed(2)}: Elevated above baseline. Could be sensor drift, precipitation, or a background fluctuation. Monitor for 2–3 more cycles before escalating.`;
    intClass = 'watch';
  } else if (topPlant && zAbs >= 1) {
    interpretation = `<strong>${topPlant}</strong> z=${topZ.toFixed(2)}: Slightly above average — well within normal statistical variation. Log only.`;
    intClass = 'ok';
  }

  return `
    <section class="grid">
      <article class="card span-12">
        <h3>Understanding Z-Scores &amp; Accident Probability</h3>
        <p>The z-score measures how many standard deviations a reading is from its local baseline. It converts raw CPM readings into a dimensionless anomaly score that is comparable across sites with different background levels.</p>
        <div class="grid" style="margin-top:var(--space-4)">
          <div class="span-7">
            <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-2)">
              Normal distribution — shaded tails show probability of readings more extreme than current highest z-score
              ${topPlant ? `(${topPlant}, z=${topZ.toFixed(2)})` : ''}
            </div>
            ${normalCurve(topZ)}
            <div style="background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-3);margin-top:var(--space-3)">
              <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-2)">FORMULA</div>
              <code style="font-size:0.85rem">z = (current_reading − rolling_median) / standard_deviation</code>
              <p style="margin-top:var(--space-2)">Baseline = median of last 30–50 Safecast readings within 80 km of the plant. Sigma = standard deviation of those same readings.</p>
            </div>
          </div>
          <div class="span-5">
            <table class="table">
              <thead><tr><th>Z-score</th><th>Outside chance</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="footer-note" style="margin-top:var(--space-4);border-left:3px solid var(--color-${intClass === 'ok' ? 'success' : intClass === 'watch' ? 'orange' : 'error'})">
              <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-1)">CURRENT READING INTERPRETATION</div>
              <p style="font-size:var(--text-sm)">${interpretation}</p>
            </div>
            <div class="footer-note" style="margin-top:var(--space-3)">
              <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-1)">⚠ IMPORTANT CAVEAT</div>
              <p style="font-size:var(--text-xs)">A high z-score alone does NOT confirm a nuclear accident or radioactive release. Z-scores measure statistical deviation only. Sensor malfunctions, calibration drift, rain-scavenging of natural radon daughters, wildfire smoke, and cosmic ray bursts all produce elevated readings. This system requires cross-confirmation from at least two independent source families (measurement + weather plume analysis or measurement + regulatory notice) before escalating to an alert.</p>
            </div>
          </div>
        </div>
      </article>
    </section>`;
}
