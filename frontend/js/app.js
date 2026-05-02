document.addEventListener('DOMContentLoaded', async () => {
  // State
  let currentView = 'overview';
  let appData = null;

  const mainEl = document.querySelector('.main');

  const loadData = async () => {
    try {
      const r = await fetch('./data/latest.json');
      if (!r.ok) throw new Error('Fetch failed');
      appData = await r.json();
      renderView();
    } catch (e) {
      console.error('Data load error:', e);
    }
  };

  // --- Renderers for each view ---

  function renderView() {
    if (!appData) return;
    const views = {
      overview: renderOverview,
      radiation: renderRadiation,
      watchlist: renderWatchlist,
      weather: renderWeather,
      news: renderNews,
      kernel: renderKernel,
    };
    (views[currentView] || renderOverview)();
  }

  function statusBadge(status) {
    return `<span class="badge ${status}">${status}</span>`;
  }

  function renderOverview() {
    const d = appData;
    let scoreClass = 'ok';
    let scoreLabel = 'Normal';
    if (d.total_score >= 85) { scoreClass = 'risk'; scoreLabel = 'Alert'; }
    else if (d.total_score >= 40) { scoreClass = 'watch'; scoreLabel = 'Watch'; }

    const onlineSrc = d.connectors ? Object.values(d.connectors).filter(v => v === 'online').length : 0;
    const totalSrc = d.connectors ? Object.keys(d.connectors).length : 0;
    const riskPlants = d.plants.filter(p => p.status === 'risk');
    const watchPlants = d.plants.filter(p => p.status === 'watch');
    const ts = d.timestamp ? new Date(d.timestamp).toLocaleString() : '—';

    mainEl.innerHTML = `
      <div class="topbar">
        <div class="title"><h2>Live Overview</h2>
          <p>Last kernel run: ${ts}</p></div>
        <div class="actions">
          <button class="btn primary" id="btn-scan">Run anomaly scan</button>
          <button class="btn" id="btn-export">Export alert rules</button>
          <button class="toggle" data-theme-toggle aria-label="Switch theme">${document.documentElement.getAttribute('data-theme') === 'dark' ? '☀' : '☾'}</button>
        </div>
      </div>
      <section class="grid">
        <article class="card span-3 metric">
          <span class="label">Aggregate Score</span>
          <span class="value">${d.total_score}</span>
          ${statusBadge(scoreClass)}
          <p>${scoreLabel}</p>
        </article>
        <article class="card span-3 metric">
          <span class="label">Sources Online</span>
          <span class="value">${onlineSrc}/${totalSrc}</span>
          <span class="badge ${onlineSrc === totalSrc ? 'ok' : 'watch'}">${onlineSrc === totalSrc ? 'All connected' : 'Partial'}</span>
        </article>
        <article class="card span-3 metric">
          <span class="label">Risk Plants</span>
          <span class="value">${riskPlants.length}</span>
          ${statusBadge(riskPlants.length > 0 ? 'risk' : 'ok')}
          <p>${riskPlants.map(p => p.name).join(', ') || 'None'}</p>
        </article>
        <article class="card span-3 metric">
          <span class="label">Watch Plants</span>
          <span class="value">${watchPlants.length}</span>
          ${statusBadge(watchPlants.length > 0 ? 'watch' : 'ok')}
          <p>${watchPlants.map(p => p.name).join(', ') || 'None'}</p>
        </article>
      </section>
      <section class="grid">
        <article class="card span-7">
          <h3>Plant Map</h3>
          <p>${d.summary || ''}</p>
          <div class="mapbox" id="mapbox"></div>
          <div class="legend">
            <span class="l1">Routine</span><span class="l2">Watch</span><span class="l3">Risk</span>
          </div>
        </article>
        <article class="card span-5">
          <h3>Recent Event Log</h3>
          <div class="list" id="event-log"></div>
        </article>
      </section>
      <section class="grid">
        <article class="card span-4">
          <h3>Score Trend</h3>
          <div class="spark" id="spark"></div>
          <div class="tiny" style="margin-top:var(--space-3)">Per-plant z-score magnitude over the last kernel cycle.</div>
        </article>
        <article class="card span-4">
          <h3>System Diagnostics</h3>
          <div class="flow" id="diagnostics"></div>
        </article>
        <article class="card span-4">
          <h3>Signal Breakdown</h3>
          <div class="list" id="signal-list"></div>
        </article>
      </section>`;

    populateMap(d.plants);
    populateLogs(d.logs);
    populateSparkline(d.trend);
    populateDiagnostics(d.connectors);
    populateSignals(d.signals);
    wireButtons();
  }

  function renderRadiation() {
    const plants = (appData.plants || []).filter(p => p.val !== null);
    let rows = plants.map(p => `<tr>
      <td>${p.name}</td><td>${p.val ?? '—'} ${p.unit || 'cpm'}</td>
      <td>${p.baseline ?? '—'}</td><td>${p.zscore ?? '—'}</td>
      <td>${statusBadge(p.status)}</td><td>${p.sample_count ?? 0}</td>
    </tr>`).join('');
    mainEl.innerHTML = `
      <div class="topbar"><div class="title"><h2>Radiation Network</h2>
        <p>Safecast community sensor readings near each plant. Z-score measures deviation from the local baseline.</p></div></div>
      <section class="grid"><article class="card span-12">
        <table class="table"><thead><tr>
          <th>Plant</th><th>Latest (avg)</th><th>Baseline (median)</th><th>Z-score</th><th>Status</th><th>Samples</th>
        </tr></thead><tbody>${rows || '<tr><td colspan="6">No radiation data available yet.</td></tr>'}</tbody></table>
      </article></section>`;
  }

  function renderWatchlist() {
    const be = appData.plants.filter(p => p.country === 'BE');
    const frHigh = appData.plants.filter(p => p.country === 'FR' && p.priority === 'high');
    const frMed = appData.plants.filter(p => p.country === 'FR' && p.priority === 'medium');
    const frLow = appData.plants.filter(p => p.country === 'FR' && p.priority === 'low');

    function plantCards(list) {
      return list.map(p => `<div class="item" style="flex-direction:column;gap:var(--space-2)">
        <div style="display:flex;justify-content:space-between;width:100%">
          <strong>${p.name}</strong> ${statusBadge(p.status)}
        </div>
        <small>Reading: ${p.val ?? '—'} ${p.unit || ''} | Baseline: ${p.baseline ?? '—'} | Z: ${p.zscore ?? '—'}</small>
        <small>Wind: ${p.wind_speed ?? '—'} km/h ${p.wind_dir != null ? '@ ' + p.wind_dir + '°' : ''} | Temp: ${p.temp ?? '—'}°C | Rain: ${p.precip ?? '—'} mm | RSS: ${p.rss_mentions ?? 0}</small>
      </div>`).join('');
    }

    mainEl.innerHTML = `
      <div class="topbar"><div class="title"><h2>Plant Watchlist</h2>
        <p>Detailed per-plant view with radiation, weather, and news context for all monitored sites.</p></div></div>
      <section class="grid">
        <article class="card span-6"><h3>🇧🇪 Belgium — Priority</h3><div class="list">${plantCards(be)}</div></article>
        <article class="card span-6"><h3>🇫🇷 France — Border Focus</h3><div class="list">${plantCards(frHigh)}</div></article>
      </section>
      <section class="grid">
        <article class="card span-6"><h3>🇫🇷 France — Medium Priority</h3><div class="list">${plantCards(frMed)}</div></article>
        <article class="card span-6"><h3>🇫🇷 France — Other Active</h3><div class="list">${plantCards(frLow)}</div></article>
      </section>`;
  }

  function renderWeather() {
    const plants = (appData.plants || []).filter(p => p.wind_speed !== null);
    let rows = plants.map(p => `<tr>
      <td>${p.name}</td><td>${p.wind_speed} km/h</td><td>${p.wind_dir ?? '—'}°</td>
      <td>${p.temp ?? '—'}°C</td><td>${p.precip ?? 0} mm</td>
      <td>${p.wind_speed > 25 ? statusBadge('watch') : statusBadge('ok')}</td>
    </tr>`).join('');
    mainEl.innerHTML = `
      <div class="topbar"><div class="title"><h2>Weather Stress</h2>
        <p>Current conditions at each plant via Open-Meteo. High wind, heavy rain, or extreme heat can compound nuclear risk signals.</p></div></div>
      <section class="grid"><article class="card span-12">
        <table class="table"><thead><tr>
          <th>Plant</th><th>Wind</th><th>Direction</th><th>Temp</th><th>Precip</th><th>Stress</th>
        </tr></thead><tbody>${rows || '<tr><td colspan="6">No weather data available.</td></tr>'}</tbody></table>
      </article></section>`;
  }

  function renderNews() {
    const items = appData.rss_items || [];
    let rows = items.map(i => `<div class="item">
      <div><strong>${i.source}</strong><small>${i.title}</small>
        ${i.link ? `<small><a href="${i.link}" target="_blank" rel="noopener">Open →</a></small>` : ''}
      </div>
      ${i.nuclear ? statusBadge('watch') : statusBadge('ok')}
    </div>`).join('');
    mainEl.innerHTML = `
      <div class="topbar"><div class="title"><h2>News Anomaly Engine</h2>
        <p>RSS feeds from ASN (France) and FANC (Belgium) regulators. Items mentioning plant names or nuclear keywords are flagged.</p></div></div>
      <section class="grid"><article class="card span-12">
        <div class="list">${rows || '<div class="item"><div><small>No RSS items available.</small></div></div>'}</div>
      </article></section>`;
  }

  function renderKernel() {
    const signals = appData.signals || [];
    let rows = signals.map(s => `<tr>
      <td>${s.source}</td><td>${s.region}</td><td>${s.metric}</td>
      <td>${s.value}</td><td>${s.baseline}</td><td>${s.confidence}</td><td>${s.kind}</td>
    </tr>`).join('');
    mainEl.innerHTML = `
      <div class="topbar"><div class="title"><h2>Agent Kernel</h2>
        <p>Raw signal table from the last kernel cycle. The kernel ingests all sources, normalizes into signals, scores with z-scores and cross-source bonuses, then generates the dashboard state.</p></div></div>
      <section class="grid"><article class="card span-12">
        <h3>Kernel Loop</h3>
        <div class="flow">
          <div class="step"><strong>1. Ingest</strong> Safecast radiation, Open-Meteo weather, ASN/FANC RSS feeds.</div>
          <div class="step"><strong>2. Normalize</strong> All readings → Signal schema (source, region, metric, value, baseline, confidence, kind).</div>
          <div class="step"><strong>3. Score</strong> Z-scores per station, weighted category caps (measurement 35, weather 20, news 25, notice 20), cross-source bonus +10.</div>
          <div class="step"><strong>4. Explain</strong> (Future: LLM triage for shortlisted anomalies.)</div>
        </div>
      </article></section>
      <section class="grid"><article class="card span-12">
        <h3>Raw Signals (${signals.length})</h3>
        <table class="table"><thead><tr>
          <th>Source</th><th>Region</th><th>Metric</th><th>Value</th><th>Baseline</th><th>Confidence</th><th>Kind</th>
        </tr></thead><tbody>${rows || '<tr><td colspan="7">No signals.</td></tr>'}</tbody></table>
      </article></section>`;
  }

  // --- Helpers ---

  const MAP_POSITIONS = {
    "Doel":{left:"57%",top:"18%"},"Tihange":{left:"60%",top:"28%"},
    "Gravelines":{left:"49%",top:"13%"},"Chooz":{left:"53%",top:"22%"},
    "Cattenom":{left:"55%",top:"30%"},"Nogent-sur-Seine":{left:"43%",top:"38%"},
    "Blayais":{left:"32%",top:"58%"},"Golfech":{left:"42%",top:"68%"},
    "Tricastin":{left:"52%",top:"62%"},"Bugey":{left:"58%",top:"52%"},
    "Belleville":{left:"40%",top:"42%"},"Chinon":{left:"30%",top:"45%"},
    "Civaux":{left:"32%",top:"50%"},"Cruas":{left:"50%",top:"60%"},
    "Dampierre":{left:"38%",top:"40%"},"Flamanville":{left:"22%",top:"20%"},
    "Paluel":{left:"30%",top:"18%"},"Penly":{left:"32%",top:"15%"},
    "Saint-Alban":{left:"52%",top:"55%"},"Saint-Laurent":{left:"35%",top:"42%"},
  };

  function populateMap(plants) {
    const box = document.getElementById('mapbox');
    if (!box || !plants) return;
    plants.forEach(p => {
      const pos = MAP_POSITIONS[p.name] || {left:"50%",top:"50%"};
      const colors = {ok:'var(--color-success)',watch:'var(--color-orange)',risk:'var(--color-error)'};
      const dot = colors[p.status] || colors.ok;
      const div = document.createElement('div');
      div.className = 'plant';
      div.style.left = pos.left;
      div.style.top = pos.top;
      div.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dot};margin-right:0.4rem"></span>${p.name}${p.val != null ? ' <small>('+p.val+')</small>' : ''}`;
      box.appendChild(div);
    });
  }

  function populateLogs(logs) {
    const el = document.getElementById('event-log');
    if (!el || !logs) return;
    el.innerHTML = logs.map(l => `<div class="item"><div><strong>${l.time}</strong><small>${l.msg}</small></div><span class="badge ${l.level}"></span></div>`).join('');
  }

  function populateSparkline(trend) {
    const el = document.getElementById('spark');
    if (!el || !trend) return;
    el.innerHTML = '';
    trend.forEach(v => {
      const s = document.createElement('span');
      s.style.height = `${Math.min(100,Math.max(5,v))}%`;
      if (v >= 85) s.style.background = 'var(--color-error)';
      else if (v >= 50) s.style.background = 'var(--color-orange)';
      el.appendChild(s);
    });
  }

  function populateDiagnostics(conn) {
    const el = document.getElementById('diagnostics');
    if (!el || !conn) return;
    const labels = {safecast:'Safecast Radiation',open_meteo:'Open-Meteo Weather',rss_feeds:'ASN/FANC RSS'};
    el.innerHTML = Object.entries(conn).map(([k,v]) => `<div class="step" style="display:flex;justify-content:space-between">
      <strong>${labels[k]||k}</strong><span class="badge ${v==='online'?'ok':'watch'}">${v}</span>
    </div>`).join('');
  }

  function populateSignals(signals) {
    const el = document.getElementById('signal-list');
    if (!el || !signals) return;
    if (signals.length === 0) { el.innerHTML = '<div class="item"><small>No signals.</small></div>'; return; }
    el.innerHTML = signals.slice(0,8).map(s => `<div class="item">
      <div><strong>${s.region}</strong><small>${s.source}: ${s.metric} = ${s.value} (baseline ${s.baseline})</small></div>
      <span class="badge ${s.confidence > 0.5 ? 'watch' : 'ok'}">${(s.confidence*100).toFixed(0)}%</span>
    </div>`).join('');
  }

  function wireButtons() {
    const scanBtn = document.getElementById('btn-scan');
    if (scanBtn) scanBtn.addEventListener('click', () => {
      scanBtn.textContent = 'Scanning…'; scanBtn.style.opacity = '0.6';
      setTimeout(() => { loadData(); }, 600);
    });
    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) exportBtn.addEventListener('click', () => {
      const rules = {watchlists:appData.plants.filter(p=>p.priority!=='low').map(p=>p.name),
        thresholds:{watch:40,investigate:70,alert:85},
        connectors:appData.connectors,timestamp:appData.timestamp};
      const a = document.createElement('a');
      a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rules,null,2));
      a.download = 'alert_rules.json'; document.body.appendChild(a); a.click(); a.remove();
    });
    const themeBtn = document.querySelector('[data-theme-toggle]');
    if (themeBtn) themeBtn.addEventListener('click', () => {
      const r = document.documentElement;
      const m = r.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      r.setAttribute('data-theme', m);
      themeBtn.textContent = m === 'dark' ? '☀' : '☾';
    });
  }

  // --- Navigation ---
  const NAV_MAP = {
    'Live overview': 'overview',
    'Radiation network': 'radiation',
    'Plant watchlist': 'watchlist',
    'Weather stress': 'weather',
    'News anomaly engine': 'news',
    'Agent kernel': 'kernel',
  };

  document.querySelectorAll('.nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = btn.textContent.replace(/[\d▼]+$/,'').trim();
      const view = NAV_MAP[label];
      if (view) {
        currentView = view;
        document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderView();
      }
    });
  });

  // Watchlist sub-nav plant links
  document.querySelectorAll('.sub-nav a').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      currentView = 'watchlist';
      document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
      renderView();
    });
  });

  // Watchlist accordion
  const wlBtn = document.getElementById('btn-watchlist');
  const wlSub = document.getElementById('sub-watchlist');
  if (wlBtn && wlSub) {
    wlBtn.addEventListener('click', () => {
      wlSub.classList.toggle('open');
      const ch = wlBtn.querySelector('.chevron');
      if (ch) ch.classList.toggle('open');
    });
  }

  // Initial load
  loadData();
});
