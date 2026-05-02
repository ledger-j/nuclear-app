document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('./data/latest.json');
    if (!response.ok) throw new Error('Failed to fetch data');
    const data = await response.json();
    
    // Update Signal Score list based on data
    const listContainer = document.querySelector('.list');
    if (listContainer && data.total_score !== undefined) {
      // Just inject a current score highlight
      const scoreBadge = document.createElement('div');
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
      // Clear existing plants and re-add them based on json data
      const existingPlants = mapbox.querySelectorAll('.plant');
      existingPlants.forEach(p => p.remove());
      
      // Default positions
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
        
        // Apply status color indicator via inline style for now or use the badge colors
        let dotColor = 'var(--color-success)';
        if (plant.status === 'watch') dotColor = 'var(--color-orange)';
        if (plant.status === 'risk') dotColor = 'var(--color-error)';
        
        div.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};margin-right:0.45rem;"></span>${plant.name} <small>(${plant.val})</small>`;
        mapbox.appendChild(div);
      });
    }

  } catch (error) {
    console.error('Error loading latest data:', error);
  }
});
