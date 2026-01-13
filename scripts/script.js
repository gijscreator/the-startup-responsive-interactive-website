// --------------------------------------------------
// RADIO STATIONS EN CONTAINERS
// --------------------------------------------------
const RADIO_STATIONS = [
  { id: 1, file: 'data/veronica.json', containerSelector: '#veronica-shows' },
  { id: 2, file: 'data/slam.json', containerSelector: '#slam-shows' },
  { id: 3, file: 'data/100nl.json', containerSelector: '#hondernl-shows' }
];

const DAYS_OF_WEEK = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const NUMBER_WORDS = ['zero','one','two','three','four','five','six','seven','eight','nine','ten'];

// --------------------------------------------------
// FUNCTIE: Alles laden en weergeven
// --------------------------------------------------
function laadAlleStations() {
  const fetchPromises = RADIO_STATIONS.map(station => fetchStationData(station));

  Promise.all(fetchPromises)
    .then(results => {
      let alleShows = [];
      results.forEach(shows => alleShows = alleShows.concat(shows));
      renderShows(alleShows);
    })
    .catch(error => console.error('Fout bij laden shows:', error));
}

// --------------------------------------------------
// FUNCTIE: Haal data van een station
// --------------------------------------------------
function fetchStationData(station) {
  return fetch(station.file)
    .then(response => {
      if (!response.ok) throw new Error('Kon bestand niet laden: ' + station.file);
      return response.json();
    })
    .then(jsonData => {
      const shows = Array.isArray(jsonData) ? jsonData : jsonData.data;
      shows.forEach(show => {
        show.radiostation = station.id;
        show.containerSelector = station.containerSelector;
      });
      return shows;
    });
}

// --------------------------------------------------
// FUNCTIE: Shows renderen
// --------------------------------------------------
function renderShows(shows) {
  const vandaag = new Date();
  const vandaagNaam = DAYS_OF_WEEK[vandaag.getDay()];
  const huidigeMinuten = vandaag.getHours() * 60 + vandaag.getMinutes();

  RADIO_STATIONS.forEach(station => {
    const container = document.querySelector(station.containerSelector);
    if (!container) return;

    // We **wissen de container niet volledig**, zodat <figure> blijft
    // Alleen verwijderen van oude <button popovertarget> shows
    const oudeButtons = container.querySelectorAll('button[popovertarget]');
    oudeButtons.forEach(btn => btn.remove());

    const showsVoorDezeStation = [];
    const reedsToegevoegd = {};

    shows.forEach(show => {
      if (show.radiostation != station.id) return;
      if (show.day != vandaagNaam) return;

      const key = show.from + show.show_name;
      if (!reedsToegevoegd[key]) {
        showsVoorDezeStation.push(show);
        reedsToegevoegd[key] = true;
      }
    });

    // Sorteer op starttijd
    showsVoorDezeStation.sort((a,b) => a.from.localeCompare(b.from));

    // Render elke show
    showsVoorDezeStation.forEach(show => renderShow(show, container, huidigeMinuten));
  });
}

// --------------------------------------------------
// FUNCTIE: Render een enkele show
// --------------------------------------------------
function renderShow(show, container, huidigeMinuten) {
  const from = show.from;
  const until = show.until === '23:59' ? '24:00' : show.until;
  const showName = show.show_name || 'Radio Show';
  const djNames = show.dj_names ? show.dj_names.replace(/,/g,' & ') : '';
  const showThumbnail = show.show_thumbnail || '';

  const startMinutes = parseInt(from.split(':')[0])*60 + parseInt(from.split(':')[1]);
  let endMinutes = parseInt(until.split(':')[0])*60 + parseInt(until.split(':')[1]);
  if (endMinutes <= startMinutes) endMinutes += 1440;

  const isLive = huidigeMinuten >= startMinutes && huidigeMinuten < endMinutes;
  const liveClass = isLive ? 'live' : '';

  const durationHours = Math.round((endMinutes - startMinutes)/60);
  const hourWord = NUMBER_WORDS[durationHours] || 'long';
  const durationClass = hourWord + (durationHours===1?'hour':'hours');
  const blockClass = durationHours>=2 ? 'block' : '';

  const html = `
    <button popovertarget="more-info">
      <article class="${blockClass} ${durationClass} ${liveClass}" style="--duration:${durationHours};">
        <img src="${showThumbnail}" alt="${showName}" class="show-header normal-hidden">
        <section>
          <h3 class="fly-in-text || title">${showName}</h3>
          <p class="time">${from} - ${show.until}</p>
        </section>
      </article>
    </button>
  `;

  container.insertAdjacentHTML('beforeend', html);
}

// --------------------------------------------------
// INITIAL LOAD
// --------------------------------------------------
laadAlleStations();



function updateLiveTime() {
    const now = new Date();
    
    // 1. Get exact Dutch Time
    const nlTime = now.toLocaleString("nl-NL", {
        timeZone: "Europe/Amsterdam", 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false
    });
    
    const [hours, minutes] = nlTime.split(':').map(Number);
    const timeDecimal = hours + (minutes / 60);

    // 2. Log to console for debugging
    console.log(`System Time: ${now.getHours()}:${now.getMinutes()}`);
    console.log(`Calculated NL Time: ${nlTime}`);
    console.log(`CSS --time value: ${timeDecimal}`);

    const mainContainer = document.querySelector('main.home');
    const timeLine = document.querySelector('.test-line');

    if (mainContainer && timeLine) {
        // Set the CSS variable
        mainContainer.style.setProperty('--time', timeDecimal);

        // 3. Auto-Scroll logic
        // We calculate the pixel position: (Time * 160px) + 80px offset
        const hourWidth = 160; 
        const offset = 80;
        const scrollPosition = (timeDecimal * hourWidth) + offset;

        // Only auto-scroll on the first load
        if (!mainContainer.dataset.hasScrolled) {
            // Subtract half the window width to center the red line on screen
            mainContainer.scrollLeft = scrollPosition - (window.innerWidth / 2);
            mainContainer.dataset.hasScrolled = "true";
            console.log(`Auto-scrolled to: ${scrollPosition}px`);
        }
    }
}

// Initialize
updateLiveTime();
// Update every minute to keep the line moving
setInterval(updateLiveTime, 600);




// Audio player veronica 
const playButton = document.querySelector('.play-button');
const audioPlayer = new Audio('assets/liedje.mp3');
if (playButton) {
  playButton.addEventListener('click', () => {
    if (audioPlayer.paused) {
      audioPlayer.play();
      playButton.classList.add('is-playing');
    } else {
      audioPlayer.pause();
      playButton.classList.remove('is-playing');
    }
  });
}