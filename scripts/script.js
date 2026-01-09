const stations = [
  { id: 1, file: 'data/veronica.json', container: '#veronica-shows' },
  { id: 2, file: 'data/slam.json', container: '#slam-shows' },
  { id: 3, file: 'data/100nl.json', container: '#hondernl-shows' }
];

Promise.all(
  stations.map(station =>
    fetch(station.file)
      .then(res => {
        if (!res.ok) throw new Error(`Could not load ${station.file}`);
        return res.json();
      })
      .then(json => {
        // Handle both Directus {"data": []} format and raw [] arrays
        const rawShows = Array.isArray(json) ? json : json.data;
        // Inject the station ID so the renderer knows where to put it
        return rawShows.map(show => ({ ...show, radiostation: station.id }));
      })
  )
)
  .then(allStationsData => {
    // Flatten the array of arrays into one single list for the renderer
    const flattenedShows = allStationsData.flat();
    renderShows(flattenedShows);
  })
  .catch(err => {
    console.error("Error loading show data:", err);
  });

/**
 * 2. RENDER LOGIC (Updated)
 */
function renderShows(shows) {
  if (!shows || shows.length === 0) return;

  const stationMap = {
    1: '#veronica-shows',
    2: '#slam-shows',
    3: '#hondernl-shows'
  };

  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const today = days[new Date().getDay()];

  Object.keys(stationMap).forEach(stationId => {
    const container = document.querySelector(stationMap[stationId]);
    if (!container) return;

    const addedShows = new Set();

    const todayShows = shows
      .filter(item => {
        return (
          item.radiostation == stationId && 
          item.day === today && 
          !addedShows.has(`${item.from}-${item.show_name}`)
        );
      })
      .map(item => {
        addedShows.add(`${item.from}-${item.show_name}`);
        return item;
      })
      .sort((a, b) => {
        const [ah, am] = (a.from || "00:00").split(':').map(Number);
        const [bh, bm] = (b.from || "00:00").split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
      });

    todayShows.forEach(item => {
      const startTime = item.from || '00:00';
      const endTime = item.until || '23:59'; 

      // Duration Logic
      const fromDate = new Date(`2026-01-01T${startTime}`);
      const untilDate = new Date(`2026-01-01T${endTime}`);
      let durationHours = (untilDate - fromDate) / 1000 / 60 / 60;
      if (durationHours < 0) durationHours += 24; 

      const timeText = `${startTime.substring(0, 5)} - ${endTime.substring(0, 5)}`;
      const djNames = item.dj_names ? item.dj_names.split(',').map(n => n.trim()) : [];
      
      // FIX: Use show_thumbnail as the source for DJ images
      const displayImg = item.show_thumbnail || 'assets/default-dj.webp';

      const figures = djNames.map((dj) => `
          <figure class="${durationHours > 1 ? '' : 'normal-hidden'}">
            <img src="${displayImg}" alt="DJ ${dj}">
            <figcaption>
              <p class="${durationHours > 1 ? 'block-hidden' : ''}">${dj}</p>
            </figcaption>
          </figure>
        `).join('');

      const html = `
        <article class="${durationHours > 1 ? 'block' : ''}">
          <img 
            src="${displayImg}" 
            alt="Show van ${item.show_name}" 
            class="show-header"
          >
          <section>
            <h3 class="title">${item.show_name || 'Onbekende Show'}</h3>
            <p class="${durationHours > 1 ? 'block-hidden' : ''} dj-names">
              ${djNames.join(' & ')}
            </p>
            <p class="time">${timeText}</p>
            <div class="dj-figures">${figures}</div>
          </section>
        </article>
      `;

      container.insertAdjacentHTML('beforeend', html);
    });
  });
}