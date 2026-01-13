//  -------------------------------------------------- Map alle radio stationnetjes van de json files --------------------------------------------------

const Radiootjes = [
  { id: 1, name: "veronica", file: 'data/veronica.json', containerSelector: '#veronica-shows' },
  { id: 2, name: "slam", file: 'data/slam.json', containerSelector: '#slam-shows' },
  { id: 3, name: "hondernl", file: 'data/100nl.json', containerSelector: '#hondernl-shows' }
];

const DagenVanDeWeek = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const UrenVoorClasses = ['zero','one','two','three','four','five','six','seven','eight','nine','ten'];

//  -------------------------------------------------- Radiootjes inladen als het matched met het gekozen radiootje door de gebruiker  --------------------------------------------------

function laadGekozenStation(zenderName) {
  Radiootjes.forEach(station => {
    const container = document.querySelector(station.containerSelector);
    if (!container) return;

    if (station.name === zenderName) {
      container.classList.add('is-active');

      fetchStationData(station)
        .then(shows => renderShowsPerStation(shows, container, station.name)); // Pass name here

    } else {
      container.classList.remove('is-active');
      container.innerHTML = '';
    }
  });
}
//  -------------------------------------------------- Alle programmaatjes uit 1 radiootje halen en deze valideren   --------------------------------------------------

function fetchStationData(station) {
  return fetch(station.file)
    .then(response => {
      if (!response.ok) throw new Error('Kon bestand niet laden: ' + station.file);
      return response.json();
    })
    .then(jsonData => {
      const shows = Array.isArray(jsonData) ? jsonData : jsonData.data;
      shows.forEach(show => show.radiostation = station.id);
      return shows;
    });
}

//  -------------------------------------------------- Alles programmaatjes ophalen van vandaag   --------------------------------------------------

function renderShowsPerStation(shows, container, stationName) {
  const vandaag = new Date();
  const vandaagNaam = DagenVanDeWeek[vandaag.getDay()];
  const huidigeMinuten = vandaag.getHours() * 60 + vandaag.getMinutes();

  const oudeButtons = container.querySelectorAll('button[popovertarget]');
  oudeButtons.forEach(btn => btn.remove());

  const reedsToegevoegd = {};

  shows.forEach(show => {
    if (show.day != vandaagNaam) return;
    const key = show.from + show.show_name;
    if (reedsToegevoegd[key]) return;

    // Pass stationName here
    renderShow(show, container, huidigeMinuten, stationName);
    reedsToegevoegd[key] = true;
  });
}

//  Alle correcte programaatjes laten zien van vandaag inclusief het 
// berekenen hoelang de show duurt en op basis hiervan classes toevoegen   
// er wordt ook gekeken of de show nu is en dan geeft ie een class live mee zodat ik hem makkelijk kan stylen 

function renderShow(show, container, huidigeMinuten, stationName) {
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
  const hourWord = UrenVoorClasses[durationHours] || 'long';
  const durationClass = hourWord + (durationHours===1?'hour':'hours');
  const blockClass = durationHours>=2 ? 'block' : '';

const html = `
    <button popovertarget="more-info">
      <article class="${stationName} ${blockClass} ${durationClass} ${liveClass}" style="--duration:${durationHours};">
        <img src="${showThumbnail}" alt="${showName}" class="show-header">
        <section>
          <h3 class="fly-in-text title">${showName}</h3>
          <p class="dj-names">${djNames}</p>
          <p class="time">${from} - ${show.until}</p>
        </section>
        <p class="more"> > </p>
      </article>
    </button>
  `;

  container.insertAdjacentHTML('beforeend', html);
}



// --------------------------------------------------
// Popover links click event
// --------------------------------------------------
document.querySelectorAll('#station-selector a').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const urlZender = link.href.split('?')[1];
    laadGekozenStation(urlZender);
  });
});

// --------------------------------------------------
// Initial load based on URL or default
// --------------------------------------------------
const query = window.location.search.substring(1).toLowerCase();
const initialZender = Radiootjes.find(s => s.name === query)?.name || "veronica";
laadGekozenStation(initialZender);

// --------------------------------------------------
// Populate popover links dynamically
// --------------------------------------------------
const popover = document.querySelector("#station-selector");
if(popover){
  popover.innerHTML = Radiootjes.map(s => `<a href="pages/zenders.html?${s.name}">${s.name.charAt(0).toUpperCase() + s.name.slice(1)}</a>`).join('');
}
