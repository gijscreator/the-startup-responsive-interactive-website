/**
 * RADIOGIDS MASTER SCRIPT
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

// Hulpmiddelen voor tijd en datums
const TijdHulpmiddelen = {
    // Zet een tijd (bijv "12:30") om naar minuten vanaf 00:00
    zetTijdOmNaarMinuten: function(tijdTekst) {
        if (!tijdTekst) return 0;
        const delen = tijdTekst.split(':');
        const uren = parseInt(delen[0]);
        const minuten = parseInt(delen[1]) || 0;
        return (uren * 60) + minuten;
    },

    // Berekent hoe lang een programma duurt in uren
    berekenProgrammaDuurInUren: function(startTijd, eindTijd) {
        const startMinuten = TijdHulpmiddelen.zetTijdOmNaarMinuten(startTijd);
        let eindMinuten = TijdHulpmiddelen.zetTijdOmNaarMinuten(eindTijd === '23:59' ? '24:00' : eindTijd);
        
        if (eindMinuten <= startMinuten) {
            eindMinuten = eindMinuten + 1440; // Voeg een dag toe als het na middernacht eindigt
        }
        return Math.round((eindMinuten - startMinuten) / 60);
    },

    // Maakt de datum tekst die Apple begrijpt (YYYYMMDDTHHMMSSZ)
    formatteerDatumVoorApple: function(dagNaam, tijdTekst) {
        const nu = new Date();
        const doelDagIndex = RADIOGIDS_CONFIGURATIE.dagenVanDeWeek.indexOf(dagNaam.toLowerCase());
        const tijdDelen = tijdTekst.split(':');
        const uur = parseInt(tijdDelen[0]);
        const min = parseInt(tijdDelen[1]);

        let resultaatDatum = new Date(nu);
        let dagenVerschil = (doelDagIndex + 7 - nu.getDay()) % 7;
        
        // Als de dag vandaag is maar de tijd is al voorbij, ga naar volgende week
        if (dagenVerschil === 0 && nu.getHours() >= uur) {
            dagenVerschil = 7;
        }

        resultaatDatum.setDate(nu.getDate() + dagenVerschil);
        resultaatDatum.setHours(uur, min, 0, 0);

        // Zet om naar ISO formaat en haal streepjes en dubbele punten weg
        return resultaatDatum.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }
};

// Logica voor het maken van het kalenderbestand
const CalendarBouwer = {
    // Maakt de speciale "Data Link" voor de knop
    maakIcsLink: function(programma) {
        const start = TijdHulpmiddelen.formatteerDatumVoorApple(programma.day, programma.from);
        const eind = TijdHulpmiddelen.formatteerDatumVoorApple(programma.day, programma.until);

        // De regels tekst die in een kalenderbestand horen
        const icsRegels = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Radiogids//Apple Calendar//NL",
            "BEGIN:VEVENT",
            "SUMMARY:" + programma.show_name,
            "DESCRIPTION:DJ: " + (programma.dj_names || 'Onbekend'),
            "DTSTART:" + start,
            "DTEND:" + eind,
            "RRULE:FREQ=WEEKLY", // Zorgt dat het elke week herhaalt
            "END:VEVENT",
            "END:VCALENDAR"
        ].join("\r\n"); // Apple wil altijd \r\n aan het einde van een regel

        // Zet de tekst om naar Base64 zodat Safari het als een echt bestand ziet
        const base64Inhoud = btoa(unescape(encodeURIComponent(icsRegels)));
        return "data:text/calendar;base64," + base64Inhoud;
    },

    // Maakt een veilige bestandsnaam zonder rare tekens
    maakVeiligeNaam: function(naam) {
        return naam.replace(/[^a-z0-9]/gi, '_').toLowerCase() + ".ics";
    }
};

// Haalt de JSON bestanden op
const DataOphaler = {
    haalProgrammaDataOp: async function(bestandsPad) {
        try {
            const response = await fetch(bestandsPad);
            const data = await response.json();
            return Array.isArray(data) ? data : (data.data || []);
        } catch (fout) {
            console.error("Fout bij ophalen data:", fout);
            return [];
        }
    }
};

// Maakt de HTML voor de overzichtspagina's
const HTMLBouwer = {
    maakProgrammaKaartje: function(programma, huidigeMinuten, zenderNaam) {
        const duurInUren = TijdHulpmiddelen.berekenProgrammaDuurInUren(programma.from, programma.until);
        const startTijdMin = TijdHulpmiddelen.zetTijdOmNaarMinuten(programma.from);
        const isNuBezig = huidigeMinuten >= startTijdMin && huidigeMinuten < (startTijdMin + (duurInUren * 60));
        
        const duurKlasse = (RADIOGIDS_CONFIGURATIE.getallenInWoorden[duurInUren] || 'long') + "hours";
        const uniekeLink = "pages/details.html?id=" + programma.id + "-" + zenderNaam;

        return '<a href="' + uniekeLink + '" class="show-card-link">' +
                '<article class="block ' + duurKlasse + ' ' + (isNuBezig ? 'live' : '') + '" style="--duration:' + duurInUren + ';">' +
                    '<img src="' + programma.show_thumbnail + '" alt="' + programma.show_name + '" class="show-header normal-hidden">' +
                    '<section>' +
                        '<h3 class="fly-in-text title">' + programma.show_name + '</h3>' +
                        '<p class="time">' + programma.from + ' - ' + programma.until + '</p>' +
                        (isNuBezig ? '<p class="live-status">NU LIVE</p>' : '') +
                    '</section>' +
                '</article>' +
            '</a>';
    }
};

// Beheert wat er op welke pagina gebeurt
const PaginaBeheer = {
    initialiseerApp: async function() {
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

    laadHomePagina: async function(vandaag, nuMinuten) {
        for (let i = 0; i < RADIOGIDS_CONFIGURATIE.radioStations.length; i++) {
            const station = RADIOGIDS_CONFIGURATIE.radioStations[i];
            const container = document.querySelector(station.htmlContainer);
            if (!container) continue;

            const data = await DataOphaler.haalProgrammaDataOp(station.dataBestand);
            data.filter(function(p) { return p.day === vandaag; })
                .sort(function(a, b) { return a.from.localeCompare(b.from); })
                .forEach(function(p) { 
                    container.insertAdjacentHTML('beforeend', HTMLBouwer.maakProgrammaKaartje(p, nuMinuten, station.machineNaam)); 
                });
        }
    },

    laadZenderPagina: async function(vandaag, nuMinuten) {
        const params = new URLSearchParams(window.location.search);
        const stationNaam = params.get('station') || "veronica";
        const station = RADIOGIDS_CONFIGURATIE.radioStations.find(function(s) { return s.machineNaam === stationNaam; });
        const container = document.querySelector(station?.htmlContainer);
        
        if (container && station) {
            container.classList.add('is-active');
            const data = await DataOphaler.haalProgrammaDataOp(station.dataBestand);
            container.innerHTML = ''; 
            data.filter(function(p) { return p.day === vandaag; })
                .sort(function(a, b) { return a.from.localeCompare(b.from); })
                .forEach(function(p) { 
                    container.insertAdjacentHTML('beforeend', HTMLBouwer.maakProgrammaKaartje(p, nuMinuten, station.machineNaam)); 
                });
        }
    },

    laadDetailPagina: async function() {
        const params = new URLSearchParams(window.location.search);
        const idParam = params.get('id');
        if (!idParam) return;

        const delen = idParam.split('-');
        const stationNaam = delen.pop();
        const progId = delen.join('-');

        const station = RADIOGIDS_CONFIGURATIE.radioStations.find(function(s) { return s.machineNaam === stationNaam; });
        if (!station) return;

        const data = await DataOphaler.haalProgrammaDataOp(station.dataBestand);
        const prog = data.find(function(p) { return String(p.id) === String(progId); });

        if (prog) {
            document.getElementById('detail-name').textContent = prog.show_name;
            document.getElementById('detail-img').src = prog.show_thumbnail;
            document.getElementById('detail-djs').textContent = "Presentatie: " + (prog.dj_names || "Onbekend");
            document.getElementById('detail-description').innerHTML = prog.body || "Geen beschrijving.";
            document.title = prog.show_name + " - Radiogids";

            // KALENDER KNOP LOGICA
            const calBtn = document.getElementById('apple-calendar-btn');
            if (calBtn) {
                calBtn.href = CalendarBouwer.maakIcsLink(prog);
                calBtn.setAttribute('download', CalendarBouwer.maakVeiligeNaam(prog.show_name));
            }
        }
    },

    activeerAlgemeneFuncties: function() {
        // Logica voor de tijdlijn in de UI
        const line = document.querySelector('.test-line');
        const main = document.querySelector('main.home');

        if (line && main) {
            const update = function() {
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

        // Simpele Audio Player
        const btn = document.querySelector('.play-button');
        const audio = new Audio('assets/liedje.mp3'); 

        if (btn) {
            btn.addEventListener('click', function() {
                if (audio.paused) {
                    audio.play();
                } else {
                    audio.pause();
                }
                btn.classList.toggle('is-playing', !audio.paused);
            });
        }
    }
};

// Past styling aan op basis van de zender (branding)
function applyStationParamAsClass() {
    const params = new URLSearchParams(window.location.search);
    const stationName = params.get('station');

    if (stationName) {
        const elements = document.querySelectorAll('header, aside, main, button, footer');
        elements.forEach(function(el) {
            el.classList.add(stationName.toLowerCase());
        });
    }
}

// Start het script
applyStationParamAsClass();
document.addEventListener('DOMContentLoaded', PaginaBeheer.initialiseerApp);