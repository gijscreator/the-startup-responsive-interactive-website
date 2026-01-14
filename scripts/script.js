/**
 * RADIOGIDS MASTER SCRIPT - OPTIMIZED
 */

const RADIOGIDS_CONFIGURATIE = {
    radioStations: [
        { id: 1, machineNaam: "veronica", dataBestand: 'data/veronica.json', htmlContainer: '#veronica-shows' },
        { id: 2, machineNaam: "slam", dataBestand: 'data/slam.json', htmlContainer: '#slam-shows' },
        { id: 3, machineNaam: "hondernl", dataBestand: 'data/100nl.json', htmlContainer: '#hondernl-shows' }
    ],
    dagenVanDeWeek: ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],
    getallenInWoorden: ['zero','one','two','three','four','five','six','seven','eight','nine','ten']
};

const TijdHulpmiddelen = {
    zetTijdOmNaarMinuten: (tijdTekst) => {
        if (!tijdTekst) return 0;
        const [uren, minuten] = tijdTekst.split(':').map(Number);
        return (uren * 60) + (minuten || 0);
    },

    berekenProgrammaDuurInUren: (startTijd, eindTijd) => {
        const startMinuten = TijdHulpmiddelen.zetTijdOmNaarMinuten(startTijd);
        let eindMinuten = TijdHulpmiddelen.zetTijdOmNaarMinuten(eindTijd === '23:59' ? '24:00' : eindTijd);
        if (eindMinuten <= startMinuten) eindMinuten += 1440;
        return Math.round((eindMinuten - startMinuten) / 60);
    }
};

const DataOphaler = {
    haalProgrammaDataOp: async (bestandsPad) => {
        try {
            const response = await fetch(bestandsPad);
            const data = await response.json();
            return Array.isArray(data) ? data : (data.data || []);
        } catch (fout) {
            console.error("Data fetch error:", fout);
            return [];
        }
    }
};

const HTMLBouwer = {
    maakProgrammaKaartje: (programma, huidigeMinuten, zenderNaam) => {
        const duurInUren = TijdHulpmiddelen.berekenProgrammaDuurInUren(programma.from, programma.until);
        const startTijdMin = TijdHulpmiddelen.zetTijdOmNaarMinuten(programma.from);
        const isNuBezig = huidigeMinuten >= startTijdMin && huidigeMinuten < (startTijdMin + (duurInUren * 60));
        
        const duurKlasse = `${RADIOGIDS_CONFIGURATIE.getallenInWoorden[duurInUren] || 'long'}hours`;

        const uniekeLink = `pages/details.html?id=${programma.id}-${zenderNaam}`;

        return `
            <a href="${uniekeLink}" class="show-card-link">
                <article class="block ${duurKlasse} ${isNuBezig ? 'live' : ''}" style="--duration:${duurInUren};">
                    <img src="${programma.show_thumbnail}" alt="${programma.show_name}" class="show-header normal-hidden">
                    <section>
                        <h3 class="fly-in-text title">${programma.show_name}</h3>
                        <p class="time">${programma.from} - ${programma.until}</p>
                        ${isNuBezig ? '<p class="live-status">NU LIVE</p>' : ''}
                    </section>
                </article>
            </a>`;
    }
};

const PaginaBeheer = {
    initialiseerApp: async () => {
        const path = window.location.pathname;
        const nu = new Date();
        const dag = RADIOGIDS_CONFIGURATIE.dagenVanDeWeek[nu.getDay()];
        const minuten = (nu.getHours() * 60) + nu.getMinutes();

        if (path.includes('details.html')) {
            await PaginaBeheer.laadDetailPagina();
        } else if (path.includes('zenders.html')) {
            await PaginaBeheer.laadZenderPagina(dag, minuten);
        } else {
            await PaginaBeheer.laadHomePagina(dag, minuten);
        }
        
        PaginaBeheer.activeerAlgemeneFuncties();
    },

    laadHomePagina: async (vandaag, nuMinuten) => {
        for (const station of RADIOGIDS_CONFIGURATIE.radioStations) {
            const container = document.querySelector(station.htmlContainer);
            if (!container) continue;

            const data = await DataOphaler.haalProgrammaDataOp(station.dataBestand);
            data.filter(p => p.day === vandaag)
                .sort((a, b) => a.from.localeCompare(b.from))
                .forEach(p => container.insertAdjacentHTML('beforeend', HTMLBouwer.maakProgrammaKaartje(p, nuMinuten, station.machineNaam)));
        }
    },

    laadZenderPagina: async (vandaag, nuMinuten) => {
        const stationNaam = new URLSearchParams(window.location.search).get('station') || "veronica";
        const station = RADIOGIDS_CONFIGURATIE.radioStations.find(s => s.machineNaam === stationNaam);
        const container = document.querySelector(station?.htmlContainer);
        
        if (container && station) {
            container.classList.add('is-active');
            const data = await DataOphaler.haalProgrammaDataOp(station.dataBestand);
            container.innerHTML = ''; 
            data.filter(p => p.day === vandaag)
                .sort((a, b) => a.from.localeCompare(b.from))
                .forEach(p => container.insertAdjacentHTML('beforeend', HTMLBouwer.maakProgrammaKaartje(p, nuMinuten, station.machineNaam)));
        }
    },

    laadDetailPagina: async () => {
        const idParam = new URLSearchParams(window.location.search).get('id');
        if (!idParam) return;

        const parts = idParam.split('-');
        const stationNaam = parts.pop();
        const progId = parts.join('-');

        const station = RADIOGIDS_CONFIGURATIE.radioStations.find(s => s.machineNaam === stationNaam);
        if (!station) return;

        const data = await DataOphaler.haalProgrammaDataOp(station.dataBestand);
        const prog = data.find(p => String(p.id) === String(progId));

        if (prog) {
            document.getElementById('detail-name').textContent = prog.show_name;
            document.getElementById('detail-img').src = prog.show_thumbnail;
            document.getElementById('detail-djs').textContent = `Presentatie: ${prog.dj_names || "Onbekend"}`;
            document.getElementById('detail-description').innerHTML = prog.body || "Geen beschrijving.";
            document.title = `${prog.show_name} - Radiogids`;
        }
    },

    activeerAlgemeneFuncties: () => {
        // Tijdlijn update
        const line = document.querySelector('.test-line');
        const main = document.querySelector('main.home');

        if (line && main) {
            const update = () => {
                const d = new Date();
                main.style.setProperty('--time', d.getHours() + (d.getMinutes() / 60));

                if (!main.dataset.scrolled) {
                    main.scrollLeft = (line.getBoundingClientRect().left + main.scrollLeft) - (window.innerWidth / 2);
                    main.dataset.scrolled = "true";
                }
            };
            update();
            setInterval(update, 60000);
        }

        // Audio Player
        const btn = document.querySelector('.play-button');
        const audio = new Audio('assets/liedje.mp3'); 

        if (btn) {
            btn.addEventListener('click', () => {
                audio.paused ? audio.play() : audio.pause();
                btn.classList.toggle('is-playing', !audio.paused);
            });
        }
    }
};

// function to check url, based on that apply class what radio station 
// it is and the correct var is triggered in the css to style it to 
// the radio branding

function applyStationParamAsClass() {
    const currentPath = window.location.pathname;
    const urlParameters = new URLSearchParams(window.location.search);
    const stationName = urlParameters.get('station');

    if (currentPath === '/pages/zenders.html' && stationName) {
        const targetElements = document.querySelectorAll('header, aside, main, button, footer');

        targetElements.forEach(element => {
            element.classList.remove('veronica')
            element.classList.add(stationName.toLowerCase());

        });
    }
}

applyStationParamAsClass();

document.addEventListener('DOMContentLoaded', PaginaBeheer.initialiseerApp);


