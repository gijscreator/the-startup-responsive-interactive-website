// Hier komt later de api endpoint ipv de json files

const STATIONS = [
  { id: 1, file: 'data/veronica.json', container: '#veronica-shows' },
  { id: 2, file: 'data/slam.json', container: '#slam-shows' },
  { id: 3, file: 'data/100nl.json', container: '#hondernl-shows' }
];

// Welke radio welke id heeft in de json

const STATION_MAP = {
  1: '#veronica-shows',
  2: '#slam-shows',
  3: '#hondernl-shows'
};

// Dagen van de week
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];


// async function kende ik nog niet src="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function"

async function loadRadiogids() {
  try {
    const allData = await Promise.all(STATIONS.map(async function(station) {
      const response = await fetch(station.file);
      if (!response.ok) throw new Error('Failed to load: ' + station.file);
      
      const json = await response.json();
      const rawShows = Array.isArray(json) ? json : json.data;
      
      return rawShows.map(function(show) {
        return { ...show, radiostation: station.id };
      });
    }));

    renderShows(allData.flat());
  } catch (error) {
    console.error('Initialization Error:', error);
  }
}

// Render de radio programmas per station van de huidige dag

function renderShows(shows) {
  if (!shows.length) return;

  const now = new Date();
  const today = DAYS[now.getDay()];
  
  // Huidige tijd omrekenen naar minuten voor de vergelijking
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();

  Object.entries(STATION_MAP).forEach(function([stationId, selector]) {
    const container = document.querySelector(selector);
    if (!container) return;

    // Oude programma's weghalen die er nog stonden van de vorige dag
    container.querySelectorAll('article').forEach(function(article) {
      article.remove();
    });

    // Filteren op dag, tijd en radiostation
    const addedKeys = new Set();
    const filteredShows = shows
      .filter(function(item) {
        const isMatch = item.radiostation == stationId && item.day === today;
        const key = item.from + item.show_name;
        if (isMatch && !addedKeys.has(key)) {
          addedKeys.add(key);
          return true;
        }
        return false;
      })
      .sort(function(a, b) {
        return a.from.localeCompare(b.from);
      });

    // Html maken zodat deze correct geinjecteerd kan worden
    filteredShows.forEach(function(show) {
      const { from, until, show_name, dj_names, show_thumbnail } = show;
      
      // 23:59 = 24:00 voor de uren calc
      const endTime = (until === '23:59') ? '24:00' : until;
      
      // Hoelang ieder programma duurt berekenen
      const startParts = from.split(':').map(Number);
      const endParts = endTime.split(':').map(Number);
      
      const startMinutes = (startParts[0] * 60) + startParts[1];
      let endMinutes = (endParts[0] * 60) + endParts[1];

      // Als een programma na middernacht eindigt (bijv. van 22:00 tot 02:00)
      if (endMinutes <= startMinutes) {
        endMinutes += 1440; // 24 uur in minuten erbij
      }

      // Check of de huidige tijd binnen het programma valt
      const isLive = currentMinutes >= startMinutes && currentMinutes < endMinutes;
      const liveClass = isLive ? 'live' : '';

      const startHours = startMinutes / 60;
      const endHours = endMinutes / 60;
      
      let duration = endHours - startHours;

      // Alle variablen voor in de layout, Dj, hoelang het duurt etc
      const finalHours = Math.round(duration);
      const hourWord = NUMBER_WORDS[finalHours] || 'long';
      const durationClass = hourWord + (finalHours === 1 ? 'hour' : 'hours');
      const blockClass = finalHours >= 2 ? 'block' : '';

      // Final html die in de dom wordt geladen (liveClass toegevoegd)
      const html = `
        <article class="${blockClass} ${durationClass} ${liveClass}" style="--duration: ${finalHours};">
          <img 
            src="${show_thumbnail}" 
            alt="${show_name}"
            class="show-header"
          >
          <section>
            <h3 class="title">${show_name || 'Radio Show'}</h3>
            <p class="dj-names">${dj_names ? dj_names.replace(/,/g, ' & ') : ''}</p>
            <p class="time">${from.slice(0, 5)} - ${until.slice(0, 5)}</p>
          </section>
        </article>
      `;

      container.insertAdjacentHTML('beforeend', html);
    });
  });
}

// Run
loadRadiogids();