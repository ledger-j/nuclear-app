document.addEventListener('DOMContentLoaded', async () => {
  const loadData = async () => {
    try {
      const response = await fetch('./data/latest.json');
      if (!response.ok) throw new Error('Failed to fetch data');
      const data = await response.json();
      
      // Update top status and summary
      const listContainer = document.querySelector('.list');
      if (listContainer && data.total_score !== undefined) {
        // Clear previous current score badge if exists
        const existingBadge = document.getElementById('current-score-badge');
        if (existingBadge) existingBadge.remove();

        const scoreBadge = document.createElement('div');
        scoreBadge.id = 'current-score-badge';
        scoreBadge.className = 'item';
        scoreBadge.style.border = '2px solid var(--color-primary)';
        
        let badgeClass = 'ok';
        let statusText = 'Normal';
        if (data.total_score >= 85) { badgeClass = 'risk'; statusText = 'Alert'; }
        else if (data.total_score >= 70) { badgeClass = 'watch'; statusText = 'Investigate'; }
        else if (data.total_score >= 40) { badgeClass = 'watch'; statusText = 'Watch'; }

        scoreBadge.innerHTML = `
          <div><strong>Current Score: ${data.total_score}</strong><small>${data.summary}</small></div>
          <span class="badge ${badgeClass}">${statusText}</span>
        `;
        listContainer.prepend(scoreBadge);
      }
      
      // Update map plants
      const mapbox = document.querySelector('.mapbox');
      if (mapbox && data.plants) {
        const existingPlants = mapbox.querySelectorAll('.plant');
        existingPlants.forEach(p => p.remove());
        
        const positions = {
          "Doel": { left: "57%", top: "28%" },
          "Tihange": { left: "60%", top: "39%" },
          "Gravelines": { left: "49%", top: "23%" },
          "Chooz": { left: "53%", top: "31%" },
          "Cattenom": { left: "50%", top: "36%" },
          "Nogent": { left: "43%", top: "44%" },
          "Blayais": { left: "36%", top: "54%" },
          "Golfech": { left: "48%", top: "61%" },
          "Tricastin": { left: "54%", top: "66%" },
          "Bugey": { left: "62%", top: "58%" }
        };

        data.plants.forEach(plant => {
          const div = document.createElement('div');
          div.className = 'plant';
          const pos = positions[plant.name] || { left: "50%", top: "50%" };
          div.style.left = pos.left;
          div.style.top = pos.top;
          
          let dotColor = 'var(--color-success)';
          if (plant.status === 'watch') dotColor = 'var(--color-orange)';
          if (plant.status === 'risk') dotColor = 'var(--color-error)';
          
          div.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};margin-right:0.45rem;"></span>${plant.name} <small>(${plant.val})</small>`;
          mapbox.appendChild(div);
        });
      }

      // Update Sparkline
      const sparkContainer = document.querySelector('.spark');
      if (sparkContainer && data.trend) {
        sparkContainer.innerHTML = ''; // clear existing
        // Max height is 100%
        data.trend.forEach(val => {
          const span = document.createElement('span');
          span.style.height = `${Math.min(100, Math.max(5, val))}%`;
          // If value is very high, color it differently
          if (val >= 85) span.style.background = 'var(--color-error)';
          else if (val >= 70) span.style.background = 'var(--color-orange)';
          sparkContainer.appendChild(span);
        });
      }

      // Update Event Logs
      const logContainer = document.getElementById('event-log');
      if (logContainer && data.logs) {
        logContainer.innerHTML = '';
        data.logs.forEach(log => {
          const div = document.createElement('div');
          div.className = 'item';
          div.innerHTML = `<div><strong>${log.time}</strong><small>${log.msg}</small></div><span class="badge ${log.level}"></span>`;
          logContainer.appendChild(div);
        });
      }

    } catch (error) {
      console.error('Error loading latest data:', error);
    }
  };

  // Button Interactions
  const scanBtn = document.querySelector('.btn.primary');
  if (scanBtn) {
    scanBtn.addEventListener('click', () => {
      const originalText = scanBtn.textContent;
      scanBtn.textContent = 'Scanning...';
      scanBtn.style.opacity = '0.7';
      // Simulate network wait
      setTimeout(() => {
        loadData();
        scanBtn.textContent = originalText;
        scanBtn.style.opacity = '1';
      }, 800);
    });
  }

  const exportBtn = document.querySelectorAll('.btn')[1]; // Export alert rules
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const dummyRules = {
        "watchlists": ["Doel", "Tihange", "Cattenom"],
        "thresholds": {
          "watch": 40,
          "investigate": 70,
          "alert": 85
        },
        "notifications": ["telegram", "email"]
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dummyRules, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href",     dataStr);
      downloadAnchorNode.setAttribute("download", "alert_rules.json");
      document.body.appendChild(downloadAnchorNode); // required for firefox
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    });
  }

  // Initial load
  loadData();

  // Sidebar Accordion Logic
  const watchlistBtn = document.getElementById('btn-watchlist');
  const subWatchlist = document.getElementById('sub-watchlist');
  if (watchlistBtn && subWatchlist) {
    watchlistBtn.addEventListener('click', () => {
      subWatchlist.classList.toggle('open');
      const chevron = watchlistBtn.querySelector('.chevron');
      if(chevron) chevron.classList.toggle('open');
    });
  }
});
