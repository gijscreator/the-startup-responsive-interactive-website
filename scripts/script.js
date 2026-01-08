/**
 * 1. FETCH ALL STATIONS simultaneously
 */
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
 * 2. RENDER LOGIC
 */
function renderShows(shows) {
  if (!shows || shows.length === 0) return;

  // Map station IDs to their respective HTML containers
  const stationMap = {
    1: '#veronica-shows',
    2: '#slam-shows',
    3: '#hondernl-shows'
  };

  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const today = days[new Date().getDay()];

  // Process shows station by station to manage the "addedShows" set per station
  Object.keys(stationMap).forEach(stationId => {
    const containerId = stationMap[stationId];
    const container = document.querySelector(containerId);
    if (!container) return;

    const addedShows = new Set();

    // Filter, Sort and Deduplicate shows for THIS specific station
    const todayShows = shows
      .filter(item => {
        return (
          item.radiostation == stationId && 
          item.day === today && 
          !addedShows.has(`${item.from}-${item.show_name}`) // Deduplicate based on time + name
        );
      })
      .map(item => {
        addedShows.add(`${item.from}-${item.show_name}`);
        return item;
      })
      .sort((a, b) => {
        if (!a.from || !b.from) return 0; 
        const [ah, am] = a.from.split(':').map(Number);
        const [bh, bm] = b.from.split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
      });

    // Build the HTML
    todayShows.forEach(item => {
      const startTime = item.from || '00:00';
      const endTime = item.until || '23:59'; 

      // Calculate Duration for layout logic
      const fromDate = new Date(`2026-01-01T${startTime}`);
      const untilDate = new Date(`2026-01-01T${endTime}`);
      let durationHours = (untilDate - fromDate) / 1000 / 60 / 60;
      if (durationHours < 0) durationHours += 24; 

      const timeText = `${startTime.substring(0, 5)} - ${endTime.substring(0, 5)}`;
      const djNames = item.dj_names ? item.dj_names.split(',').map(n => n.trim()) : [];
      const djImages = item.dj_images ? item.dj_images.split(',').map(i => i.trim()) : [];

      const figures = djNames.map((dj, i) => {
        // Use dj_images[i] if it exists and isn't empty, otherwise fallback
        const imgSrc = (djImages[i] && djImages[i] !== "") ? djImages[i] : 'assets/default-dj.webp';
        return `
          <figure class="${durationHours > 1 ? '' : 'normal-hidden'}">
            <img src="${imgSrc}" alt="DJ ${dj}">
            <figcaption>
              <p class="${durationHours > 1 ? 'block-hidden' : ''}">${dj}</p>
            </figcaption>
          </figure>
        `;
      }).join('');

      const html = `
        <article class="${durationHours > 1 ? 'block' : ''}">
          <img 
            src="${item.show_thumbnail || 'assets/default-show.webp'}" 
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