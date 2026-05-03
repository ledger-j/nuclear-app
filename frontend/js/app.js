document.addEventListener('DOMContentLoaded', async () => {
  let currentView = 'overview';
  let appData = null;
  let historyData = [];
  const mainEl = document.querySelector('.main');

  const loadData = async () => {
    try {
      const [latestResp, histResp] = await Promise.all([
        fetch('./data/latest.json'),
        fetch('./data/history.json').catch(() => null),
      ]);
      if (!latestResp.ok) throw new Error('Fetch failed');
      appData = await latestResp.json();
      if (histResp && histResp.ok) historyData = await histResp.json();
      renderView();
    } catch (e) {
      mainEl.innerHTML = `<div class="topbar"><div class="title"><h2>Loading…</h2>
        <p style="color:var(--color-warning)">Could not load data — running kernel first, or check network.</p></div></div>`;
    }
  };

  function renderView() {
    if (!appData) return;
    ({ overview:renderOverview, radiation:renderRadiation, watchlist:renderWatchlist,
       weather:renderWeather, news:renderNews, kernel:renderKernel,
       zscore:renderZScore, plume:renderPlume }[currentView] || renderOverview)();
  }

  function badge(cls, txt) {
    return `<span class="badge ${cls}">${txt || cls}</span>`;
  }

  // ── OVERVIEW ──────────────────────────────────────────────────────────────
  function renderOverview() {
    const d = appData;
    const sc = d.total_score >= 85 ? 'risk' : d.total_score >= 40 ? 'watch' : 'ok';
    const lbl = d.total_score >= 85 ? 'Alert' : d.total_score >= 40 ? 'Watch' : 'Normal';
    const online = Object.values(d.connectors||{}).filter(v=>v==='online').length;
    const total  = Object.keys(d.connectors||{}).length;
    const risk   = (d.plants||[]).filter(p=>p.status==='risk');
    const watch  = (d.plants||[]).filter(p=>p.status==='watch');
    const ts     = d.timestamp ? new Date(d.timestamp).toLocaleString() : '—';
    const theme  = document.documentElement.getAttribute('data-theme');

    mainEl.innerHTML = `
      <div class="topbar">
        <div class="title"><h2>Live Overview</h2><p>Last updated: <strong>${ts}</strong> · 4× daily (00:00, 06:00, 12:00, 18:00 UTC)</p></div>
        <div class="actions">
          <button class="btn primary" id="btn-scan">↻ Refresh scan</button>
          <button class="btn" id="btn-export">↓ Export rules</button>
          <button class="toggle" data-theme-toggle aria-label="Switch theme">${theme==='dark'?'☀':'☾'}</button>
        </div>
      </div>
      <section class="grid">
        <article class="card span-3 metric">
          <span class="label">Aggregate Score</span>
          <span class="value">${d.total_score}</span>
          ${badge(sc, lbl)}
        </article>
        <article class="card span-3 metric">
          <span class="label">Sources Online</span>
          <span class="value">${online}/${total}</span>
          ${badge(online===total?'ok':'watch', online===total?'All connected':'Partial')}
        </article>
        <article class="card span-3 metric">
          <span class="label">Risk Plants</span>
          <span class="value">${risk.length}</span>
          ${badge(risk.length?'risk':'ok')}
          <p>${risk.map(p=>p.name).join(', ')||'None'}</p>
        </article>
        <article class="card span-3 metric">
          <span class="label">Watch Plants</span>
          <span class="value">${watch.length}</span>
          ${badge(watch.length?'watch':'ok')}
          <p>${watch.map(p=>p.name).join(', ')||'None'}</p>
        </article>
      </section>
      <section class="grid">
        <article class="card span-12">
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-4);align-items:flex-start">
            <div style="flex:3;min-width:0">
              <h3>Ukraine Nuclear Map</h3>
              <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-2)">War-zone plants · Dashed = bearing to Maastricht · Red = wind-aligned</p>
              <div id="ua-mapbox" style="width:100%;height:520px;border-radius:12px;overflow:hidden"></div>
            </div>
            <div style="flex:1;min-width:180px">
              <h3 style="margin-bottom:var(--space-3)">Ukraine Plants</h3>
              <div class="list" id="ua-plant-panel"></div>
            </div>
          </div>
        </article>
      </section>
      <section class="grid">
        <article class="card span-12">
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-4);align-items:flex-start">
            <div style="flex:3;min-width:0">
              <h3>France &amp; Neighbours Nuclear Map</h3>
              <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-2)">${d.summary||''}</p>
              <div id="mapbox" style="width:100%;height:540px;border-radius:12px;overflow:hidden"></div>
            </div>
            <div style="flex:1;min-width:180px">
              <h3 style="margin-bottom:var(--space-3)">Plants</h3>
              <div class="list" id="fr-plant-panel" style="max-height:540px;overflow-y:auto"></div>
            </div>
          </div>
        </article>
      </section>
      <section class="grid">
        <article class="card span-5">
          <h3>Recent Event Log</h3>
          <div class="list" id="event-log"></div>
        </article>
        <article class="card span-3">
          <h3>Score Trend (12 h)</h3>
          <div class="spark" id="spark"></div>
          <div class="tiny" id="spark-label" style="margin-top:var(--space-3)">Aggregate anomaly score over the last 12 kernel cycles.</div>
        </article>
        <article class="card span-4">
          <h3>System Diagnostics</h3>
          <div class="flow" id="diagnostics"></div>
        </article>
      </section>`;

    // inject Ukraine SVG map
    const uaBox = document.getElementById('ua-mapbox');
    if (uaBox && typeof buildUkraineMap === 'function') {
      uaBox.innerHTML = buildUkraineMap(d.plants);
      uaBox.querySelectorAll('.ua-plant-marker').forEach(g => {
        g.addEventListener('mouseenter', e => {
          const name = g.getAttribute('data-plant');
          const p = (d.plants||[]).find(x=>x.name===name)||{};
          const pd = (typeof UKRAINE_PLANTS_DATA !== 'undefined' ? UKRAINE_PLANTS_DATA : []).find(x=>x.name===name)||{};
          showTooltip(e, `<strong>${name}</strong><br>
            ${pd.note||''}<br>
            Wind: ${p.wind_speed??'—'} km/h @ ${p.wind_dir??'—'}°<br>
            Status: ${p.status||'—'}`);
        });
        g.addEventListener('mouseleave', hideTooltip);
      });
    }

    const uaPlantEl = document.getElementById('ua-plant-panel');
    if (uaPlantEl) uaPlantEl.innerHTML = buildUkrainePlantPanel(d.plants);

    // inject France SVG map
    const box = document.getElementById('mapbox');
    if (box && typeof buildSVGMap === 'function') {
      box.innerHTML = buildSVGMap(d.plants);
      // tooltip on plant click
      box.querySelectorAll('.plant-marker').forEach(g => {
        g.addEventListener('mouseenter', e => {
          const name = g.getAttribute('data-plant');
          const p = (d.plants||[]).find(x=>x.name===name)||{};
          showTooltip(e, `<strong>${name}</strong><br>
            CPM: ${p.val??'—'} | Base: ${p.baseline??'—'} | z: ${p.zscore??'—'}<br>
            Wind: ${p.wind_speed??'—'} km/h @ ${p.wind_dir??'—'}°<br>
            Status: ${p.status||'—'}`);
        });
        g.addEventListener('mouseleave', hideTooltip);
      });
    }

    const frPlantEl = document.getElementById('fr-plant-panel');
    if (frPlantEl) frPlantEl.innerHTML = buildFrancePlantPanel(d.plants);
    populateLogs(d.logs);
    populateSparkline(historyData.length >= 2 ? historyData : null, d.trend);
    populateDiagnostics(d.connectors);
    wireButtons();
  }

  // ── RADIATION ─────────────────────────────────────────────────────────────
  function renderRadiation() {
    const plants = (appData.plants||[]).filter(p=>p.val!==null);
    const rows = plants.map(p=>`<tr>
      <td>${p.name}</td><td>${p.val??'—'} ${p.unit||'cpm'}</td>
      <td>${p.baseline??'—'}</td><td>${p.zscore??'—'}</td>
      <td>${badge(p.status)}</td><td>${p.sample_count??0}</td>
    </tr>`).join('');
    mainEl.innerHTML = `
      <div class="topbar"><div class="title"><h2>Radiation Network</h2>
        <p>Safecast community sensor readings near each plant. Z-score = deviation from local baseline.</p></div></div>
      <section class="grid"><article class="card span-12">
        <table class="table"><thead><tr>
          <th>Plant</th><th>Latest avg</th><th>Baseline (median)</th><th>Z-score</th><th>Status</th><th>Samples</th>
        </tr></thead><tbody>${rows||'<tr><td colspan="6">No radiation data yet.</td></tr>'}</tbody></table>
      </article></section>`;
  }

  // ── WATCHLIST ─────────────────────────────────────────────────────────────
  function renderWatchlist() {
    const rssItems = appData.rss_items || [];
    const ua = appData.plants.filter(p => p.country === 'UA');
    const be = appData.plants.filter(p => p.country === 'BE');
    const fr = appData.plants.filter(p => p.country === 'FR');

    // Derive per-plant anomaly score (0-100) from z-score + status
    function plantScore(p) {
      const z = Math.abs(p.zscore || 0);
      const base = p.status === 'risk' ? 65 : p.status === 'watch' ? 35 : 0;
      return Math.min(100, Math.round(base + z * 18));
    }

    // Match RSS items to a plant by name keyword
    function plantNews(p) {
      const kw = p.name.toLowerCase().split(/[-\s]/)[0];
      return rssItems.filter(i => i.title.toLowerCase().includes(kw));
    }

    function plantCard(p) {
      const score = plantScore(p);
      const scoreColor = score >= 65 ? 'var(--color-error)' : score >= 35 ? 'var(--color-orange)' : 'var(--color-success)';
      const wDir = p.wind_dir != null ? `${p.wind_dir}° ${dirArrow(p.wind_dir)}` : '—';
      const news = plantNews(p);
      const newsHTML = news.length
        ? news.slice(0,2).map(i => `<div style="margin-top:6px;padding:6px 8px;background:var(--color-surface-offset);border-radius:6px;border-left:2px solid var(--color-orange)">
            <span style="font-size:10px;color:var(--color-text-muted)">${i.source}</span>
            <div style="font-size:11px;margin-top:2px">${i.title.slice(0,100)}${i.title.length>100?'…':''}</div>
            ${i.link ? `<a href="${i.link}" target="_blank" rel="noopener" style="font-size:10px;color:var(--color-primary)">Open →</a>` : ''}
          </div>`).join('')
        : '';

      return `<div class="item" style="flex-direction:column;gap:var(--space-2)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong>${p.name}</strong>
          <div style="display:flex;gap:6px;align-items:center">
            <span style="font-size:11px;color:var(--color-text-muted)">score ${score}</span>
            ${badge(p.status)}
          </div>
        </div>
        <div style="background:var(--color-surface-dynamic);height:4px;border-radius:2px;overflow:hidden">
          <div style="width:${score}%;height:100%;background:${scoreColor};border-radius:2px;transition:width 0.6s"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:var(--text-xs);color:var(--color-text-muted)">
          <span>CPM: <strong style="color:var(--color-text)">${p.val ?? '—'}</strong></span>
          <span>Baseline: <strong style="color:var(--color-text)">${p.baseline ?? '—'}</strong></span>
          <span>Z-score: <strong style="color:var(--color-text)">${p.zscore ?? '—'}</strong></span>
          <span>Wind: <strong style="color:var(--color-text)">${p.wind_speed ?? '—'} km/h</strong></span>
          <span>Dir: <strong style="color:var(--color-text)">${wDir}</strong></span>
          <span>Temp: <strong style="color:var(--color-text)">${p.temp ?? '—'}°C</strong></span>
          <span>Rain: <strong style="color:var(--color-text)">${p.precip ?? '—'} mm</strong></span>
          <span>RSS hits: <strong style="color:var(--color-text)">${p.rss_mentions ?? 0}</strong></span>
        </div>
        ${newsHTML}
      </div>`;
    }

    // Group France plants
    const frHi  = fr.filter(p => p.priority === 'high');
    const frMed = fr.filter(p => p.priority === 'medium');
    const frLow = fr.filter(p => p.priority === 'low');

    mainEl.innerHTML = `
      <div class="topbar"><div class="title"><h2>Plant Watchlist</h2>
        <p>Individual anomaly scores, wind data, radiation readings, and matched news per plant.</p></div></div>

      <section class="grid" id="watchlist-ukraine">
        <article class="card span-12">
          <h3>🇺🇦 Ukraine — War-Zone High Risk</h3>
          <p style="font-size:var(--text-xs);color:var(--color-warning);margin-bottom:var(--space-3)">
            Four plants under active wartime conditions. Zaporizhzhia occupied by Russia since 2022. Wind alignment toward Maastricht/Traben-Trarbach tracked in Live Overview.
          </p>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-3)">
            ${ua.map(plantCard).join('') || '<div class="item"><small>No Ukraine data yet.</small></div>'}
          </div>
        </article>
      </section>

      <section class="grid" id="watchlist-belgium">
        <article class="card span-12">
          <h3>🇧🇪 Belgium — Priority</h3>
          <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-3)">
            Doel and Tihange are the two closest operational plants to Maastricht. Tihange is ~100 km upstream on the Meuse.
          </p>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-3)">
            ${be.map(plantCard).join('') || '<div class="item"><small>No Belgium data yet.</small></div>'}
          </div>
        </article>
      </section>

      <section class="grid" id="watchlist-france">
        <article class="card span-6">
          <h3>🇫🇷 France — Border Focus</h3>
          <div style="display:grid;gap:var(--space-3);margin-top:var(--space-3)">${frHi.map(plantCard).join('')}</div>
        </article>
        <article class="card span-6">
          <h3>🇫🇷 France — Medium Priority</h3>
          <div style="display:grid;gap:var(--space-3);margin-top:var(--space-3)">${frMed.map(plantCard).join('')}</div>
        </article>
      </section>

      <section class="grid">
        <article class="card span-12">
          <h3>🇫🇷 France — Other Active Plants</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-3);margin-top:var(--space-3)">
            ${frLow.map(plantCard).join('')}
          </div>
        </article>
      </section>`;
  }

  // ── WEATHER ───────────────────────────────────────────────────────────────
  function renderWeather() {
    const plants = (appData.plants||[]).filter(p=>p.wind_speed!==null);
    const rows = plants.map(p=>`<tr>
      <td>${p.name}</td><td>${p.wind_speed} km/h</td><td>${p.wind_dir??'—'}°</td>
      <td>${p.temp??'—'}°C</td><td>${p.precip??0} mm</td>
      <td>${badge(p.wind_speed>25?'watch':'ok')}</td>
    </tr>`).join('');
    mainEl.innerHTML = `
      <div class="topbar"><div class="title"><h2>Weather Stress</h2>
        <p>Current conditions via Open-Meteo. High wind, heavy rain, or extreme heat compound nuclear risk signals.</p></div></div>
      <section class="grid"><article class="card span-12">
        <table class="table"><thead><tr>
          <th>Plant</th><th>Wind</th><th>Direction</th><th>Temp</th><th>Precip</th><th>Stress</th>
        </tr></thead><tbody>${rows||'<tr><td colspan="6">No weather data.</td></tr>'}</tbody></table>
      </article></section>`;
  }

  // ── NEWS ──────────────────────────────────────────────────────────────────
  function renderNews() {
    const items = appData.rss_items||[];
    const rows = items.map(i=>`<div class="item">
      <div><strong>${i.source}</strong><small>${i.title}</small>
        ${i.link?`<small><a href="${i.link}" target="_blank" rel="noopener">Open →</a></small>`:''}
      </div>${badge(i.nuclear?'watch':'ok')}
    </div>`).join('');
    mainEl.innerHTML = `
      <div class="topbar"><div class="title"><h2>News Anomaly Engine</h2>
        <p>RSS feeds from ASN (France) and FANC (Belgium) nuclear regulators. Nuclear keywords and plant names are flagged.</p></div></div>
      <section class="grid"><article class="card span-12">
        <div class="list">${rows||'<div class="item"><small>No RSS items available.</small></div>'}</div>
      </article></section>`;
  }

  // ── AGENT KERNEL ──────────────────────────────────────────────────────────
  function renderKernel() {
    const sigs = appData.signals||[];
    const rows = sigs.map(s=>`<tr>
      <td>${s.source}</td><td>${s.region}</td><td>${s.metric}</td>
      <td>${s.value}</td><td>${s.baseline}</td>
      <td>${badge(s.confidence>0.5?'watch':'ok', (s.confidence*100).toFixed(0)+'%')}</td>
      <td>${s.kind}</td>
    </tr>`).join('');
    mainEl.innerHTML = `
      <div class="topbar"><div class="title"><h2>Agent Kernel</h2>
        <p>Raw signal table from the last kernel cycle. Ingest → Normalize → Score → Explain.</p></div></div>
      <section class="grid"><article class="card span-12">
        <div class="flow">
          <div class="step"><strong>1. Ingest</strong> Safecast radiation, Open-Meteo weather, ASN/FANC RSS.</div>
          <div class="step"><strong>2. Normalize</strong> All readings → Signal (source, region, metric, value, baseline, confidence, kind).</div>
          <div class="step"><strong>3. Score</strong> Z-scores → weighted caps: measurement 35, weather 20, news 25, notice 20. Cross-source bonus +10.</div>
          <div class="step"><strong>4. Explain</strong> (Future: LLM triage for shortlisted anomalies.)</div>
        </div>
      </article></section>
      <section class="grid"><article class="card span-12">
        <h3>Raw Signals (${sigs.length})</h3>
        <table class="table"><thead><tr>
          <th>Source</th><th>Region</th><th>Metric</th><th>Value</th><th>Baseline</th><th>Confidence</th><th>Kind</th>
        </tr></thead><tbody>${rows||'<tr><td colspan="7">No signals.</td></tr>'}</tbody></table>
      </article></section>`;
  }

  // ── Z-SCORE EXPLAINER ─────────────────────────────────────────────────────
  function renderZScore() {
    mainEl.innerHTML = `
      <div class="topbar"><div class="title"><h2>Z-Score Explainer</h2>
        <p>Statistical foundation of the anomaly scoring system, with live interpretation of current readings.</p></div></div>
      ${typeof buildZScorePanel === 'function' ? buildZScorePanel(appData.plants) : '<p>Panel not loaded.</p>'}`;
  }

  // ── PLUME CALCULATOR ──────────────────────────────────────────────────────
  function renderPlume() {
    mainEl.innerHTML = `
      <div class="topbar"><div class="title"><h2>Plume Calculator</h2>
        <p>Estimated airborne transport time from each plant to Maastricht &amp; Traben-Trarbach at current wind speed.</p></div></div>
      ${typeof buildPlumePanel === 'function' ? buildPlumePanel(appData.plants) : '<p>Panel not loaded.</p>'}`;
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────
  function buildUkrainePlantPanel(plants) {
    if (typeof UKRAINE_PLANTS_DATA === 'undefined') return '<p class="tiny">No data.</p>';
    return UKRAINE_PLANTS_DATA.map(pd => {
      const live = (plants||[]).find(p => p.name === pd.name) || {};
      const ws = live.wind_speed, wd = live.wind_dir;
      const status = live.status || 'ok';
      const bear = typeof _bearingTo === 'function'
        ? Math.round(_bearingTo(pd.lat, pd.lon, 50.851, 5.691)) : null;
      const delta = wd != null && bear != null
        ? Math.round(Math.abs(((wd - bear) + 360) % 360)) : null;
      const aligned = delta != null && (delta < 45 || delta > 315);
      const borderStyle = aligned
        ? 'border-color:var(--color-error);background:color-mix(in oklab,var(--color-error) 6%,var(--color-surface-2))' : '';
      return `<div class="item" style="flex-direction:column;gap:3px;${borderStyle}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong style="font-size:var(--text-xs)">${pd.name}</strong>
          ${badge(status)}
        </div>
        <small>${pd.reactors} reactors</small>
        <small>Wind: ${ws != null ? ws+' km/h @ '+wd+'°' : '—'}</small>
        ${aligned ? `<small style="color:var(--color-error)">⚠ Wind → Maastricht (Δ${delta}°)</small>` : ''}
      </div>`;
    }).join('');
  }

  function buildFrancePlantPanel(plants) {
    if (typeof PLANTS_DATA === 'undefined') return '<p class="tiny">No data.</p>';
    const priority = ['high', 'medium', 'low'];
    const sorted = [...PLANTS_DATA].sort((a, b) =>
      priority.indexOf(a.priority) - priority.indexOf(b.priority));
    return sorted.map(pd => {
      const live = (plants||[]).find(p => p.name === pd.name) || {};
      const ws = live.wind_speed, wd = live.wind_dir;
      const status = live.status || 'ok';
      const arrow = wd != null ? dirArrow(wd) : '';
      const flag = pd.country === 'BE' ? '🇧🇪' : '🇫🇷';
      return `<div class="item" style="flex-direction:column;gap:3px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong style="font-size:var(--text-xs)">${flag} ${pd.name}</strong>
          ${badge(status)}
        </div>
        <small>${ws != null ? ws+' km/h '+arrow : 'no wind'} · ${pd.priority}</small>
      </div>`;
    }).join('');
  }

  function populateWindPanel(plants) {
    const el = document.getElementById('wind-panel');
    if (!el || !plants) return;
    const withWind = plants.filter(p=>p.wind_speed!=null)
      .sort((a,b)=>b.wind_speed-a.wind_speed).slice(0,6);
    if (!withWind.length) { el.innerHTML='<p class="tiny">No wind data available.</p>'; return; }
    el.innerHTML = withWind.map(p=>{
      const spd = p.wind_speed;
      const cls = spd>30?'risk':spd>15?'watch':'ok';
      const pct = Math.min(100, (spd/50)*100);
      const arrow = dirArrow(p.wind_dir);
      return `<div style="margin-bottom:var(--space-3)">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:var(--text-xs)">${p.name} ${arrow}</span>
          <span class="badge ${cls}" style="font-size:10px">${spd} km/h</span>
        </div>
        <div style="background:var(--color-surface-2);border-radius:4px;height:6px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:var(--color-${cls==='risk'?'error':cls==='watch'?'orange':'success'});border-radius:4px;transition:width 0.6s"></div>
        </div>
      </div>`;
    }).join('');
  }

  function dirArrow(deg) {
    if (deg == null) return '·';
    const dirs = ['↑','↗','→','↘','↓','↙','←','↖'];
    return dirs[Math.round(deg/45)%8];
  }

  function populateLogs(logs) {
    const el = document.getElementById('event-log');
    if (!el||!logs) return;
    el.innerHTML = logs.map(l=>`<div class="item">
      <div><strong>${l.time}</strong><small>${l.msg}</small></div>
      <span class="badge ${l.level}"></span>
    </div>`).join('');
  }

  function populateSparkline(history, fallbackTrend) {
    const el = document.getElementById('spark');
    const lbl = document.getElementById('spark-label');
    if (!el) return;
    el.innerHTML = '';

    if (history && history.length >= 2) {
      // Real 12-h history: plot aggregate scores with timestamps
      const vals = history.map(h => h.score);
      vals.forEach((v, i) => {
        const s = document.createElement('span');
        s.style.height = `${Math.min(100, Math.max(5, v))}%`;
        if (v >= 85) s.style.background = 'var(--color-error)';
        else if (v >= 40) s.style.background = 'var(--color-orange)';
        const ts = history[i].ts ? new Date(history[i].ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
        s.title = `${ts} — score ${v}`;
        el.appendChild(s);
      });
      if (lbl) lbl.textContent = `${history.length} cycle${history.length!==1?'s':''} of actual history. Oldest → newest.`;
    } else if (fallbackTrend) {
      // Fallback: per-plant z-score proxy from latest.json
      fallbackTrend.forEach(v => {
        const s = document.createElement('span');
        s.style.height = `${Math.min(100, Math.max(5, v))}%`;
        if (v >= 85) s.style.background = 'var(--color-error)';
        else if (v >= 40) s.style.background = 'var(--color-orange)';
        el.appendChild(s);
      });
      if (lbl) lbl.textContent = 'History building — showing z-score magnitudes from this cycle.';
    }
  }

  function populateDiagnostics(conn) {
    const el = document.getElementById('diagnostics');
    if (!el||!conn) return;
    const labels={safecast:'Safecast Radiation',open_meteo:'Open-Meteo Weather',rss_feeds:'ASN/FANC RSS'};
    el.innerHTML=Object.entries(conn).map(([k,v])=>`<div class="step" style="display:flex;justify-content:space-between">
      <strong>${labels[k]||k}</strong>${badge(v==='online'?'ok':'watch',v)}
    </div>`).join('');
  }

  // Tooltip
  let tip = null;
  function showTooltip(e, html) {
    if (!tip) { tip=document.createElement('div'); tip.style.cssText='position:fixed;background:var(--color-surface);border:1px solid var(--color-border);border-radius:8px;padding:8px 12px;font-size:12px;line-height:1.5;pointer-events:none;z-index:999;max-width:220px;box-shadow:var(--shadow-lg)'; document.body.appendChild(tip); }
    tip.innerHTML=html; tip.style.display='block';
    tip.style.left=Math.min(e.clientX+12,window.innerWidth-230)+'px';
    tip.style.top=Math.min(e.clientY+12,window.innerHeight-120)+'px';
  }
  function hideTooltip() { if(tip) tip.style.display='none'; }

  function wireButtons() {
    document.getElementById('btn-scan')?.addEventListener('click',()=>loadData());
    document.getElementById('btn-export')?.addEventListener('click',()=>{
      const rules={watchlists:(appData.plants||[]).filter(p=>p.priority!=='low').map(p=>p.name),
        thresholds:{watch:40,investigate:70,alert:85},connectors:appData.connectors,timestamp:appData.timestamp};
      const a=document.createElement('a');
      a.href='data:text/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(rules,null,2));
      a.download='alert_rules.json'; document.body.appendChild(a); a.click(); a.remove();
    });
    document.querySelector('[data-theme-toggle]')?.addEventListener('click',()=>{
      const r=document.documentElement;
      const m=r.getAttribute('data-theme')==='dark'?'light':'dark';
      r.setAttribute('data-theme',m);
      document.querySelectorAll('[data-theme-toggle]').forEach(b=>b.textContent=m==='dark'?'☀':'☾');
    });
  }

  // ── NAVIGATION ────────────────────────────────────────────────────────────
  const NAV_MAP = {
    'Live overview':'overview','Radiation network':'radiation',
    'Plant watchlist':'watchlist','Weather stress':'weather',
    'News anomaly engine':'news','Agent kernel':'kernel',
    'Z-Score explainer':'zscore','Plume calculator':'plume',
  };

  document.querySelectorAll('.nav button:not(#btn-watchlist)').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const label=btn.textContent.replace(/[\d▼]+$/,'').trim();
      const view=NAV_MAP[label];
      if(view){
        currentView=view;
        document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        renderView();
      }
    });
  });

  document.querySelectorAll('.sub-nav a').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      currentView = 'watchlist';
      document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
      document.getElementById('btn-watchlist')?.classList.add('active');
      const section = link.dataset.section;
      renderView();
      if (section) {
        requestAnimationFrame(() => {
          const el = document.getElementById('watchlist-' + section);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    });
  });

  const wlBtn=document.getElementById('btn-watchlist');
  const wlSub=document.getElementById('sub-watchlist');
  if(wlBtn&&wlSub) wlBtn.addEventListener('click',()=>{
    wlSub.classList.toggle('open');
    wlBtn.querySelector('.chevron')?.classList.toggle('open');
  });

  loadData();
});
