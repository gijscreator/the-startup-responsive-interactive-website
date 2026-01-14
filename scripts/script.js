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

const TijdHulpmiddelen = {
    zetTijdOmNaarMinuten: function(tijdTekst) {
        if (!tijdTekst) return 0;
        const delen = tijdTekst.split(':');
        return (parseInt(delen[0]) * 60) + parseInt(delen[1]);
    },

    berekenProgrammaDuurInUren: function(startTijd, eindTijd) {
        // Gebruik TijdHulpmiddelen in plaats van 'this' voor maximale veiligheid
        const start = TijdHulpmiddelen.zetTijdOmNaarMinuten(startTijd);
        let eind = TijdHulpmiddelen.zetTijdOmNaarMinuten(eindTijd === '23:59' ? '24:00' : eindTijd);
        if (eind <= start) eind += 1440;
        return Math.round((eind - start) / 60);
    },

    // BELANGRIJK: Berekent de juiste start- en einddatum voor de kalender
    berekenShowTijden: function(dagNaam, startTijd, eindTijd) {
        const nu = new Date();
        const doelDagIndex = RADIOGIDS_CONFIGURATIE.dagenVanDeWeek.indexOf(dagNaam.toLowerCase());
        
        const startUren = parseInt(startTijd.split(':')[0]);
        const startMinuten = parseInt(startTijd.split(':')[1]);
        const eindUren = parseInt(eindTijd.split(':')[0]);
        const eindMinuten = parseInt(eindTijd.split(':')[1]);

        let startDatum = new Date(nu);
        let dagenVerschil = (doelDagIndex + 7 - nu.getDay()) % 7;
        
        // Als de show vandaag is maar de tijd is al geweest, verplaats naar volgende week
        if (dagenVerschil === 0 && nu.getHours() >= startUren) {
            dagenVerschil = 7;
        }

        startDatum.setDate(nu.getDate() + dagenVerschil);
        startDatum.setHours(startUren, startMinuten, 0, 0);

        // Einddatum altijd baseren op de startdatum om fouten te voorkomen
        let eindDatum = new Date(startDatum);
        eindDatum.setHours(eindUren, eindMinuten, 0, 0);

        // Als de show na middernacht eindigt
        if (eindDatum <= startDatum) {
            eindDatum.setDate(eindDatum.getDate() + 1);
        }

        // Hulpfunctie voor Apple formaat
        function naarIcsFormaat(datum) {
            return datum.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        }

        return {
            start: naarIcsFormaat(startDatum),
            eind: naarIcsFormaat(eindDatum)
        };
    }
};

const CalendarBouwer = {
    // Maakt de download link voor Apple/Mobiel
    maakIcsLink: function(programma) {
        const tijden = TijdHulpmiddelen.berekenShowTijden(programma.day, programma.from, programma.until);

        const icsRegels = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Radiogids//Apple Calendar//NL",
            "BEGIN:VEVENT",
            "SUMMARY:" + programma.show_name,
            "DESCRIPTION:DJ: " + (programma.dj_names || 'Onbekend'),
            "DTSTART:" + tijden.start,
            "DTEND:" + tijden.eind,
            "RRULE:FREQ=WEEKLY",
            "END:VEVENT",
            "END:VCALENDAR"
        ].join("\r\n");

        // Base64 codering voor stabiliteit op Safari/iOS
        const base64Inhoud = btoa(unescape(encodeURIComponent(icsRegels)));
        return "data:text/calendar;base64," + base64Inhoud;
    },

    // Maakt een veilige bestandsnaam voor de download
    maakVeiligeNaam: function(naam) {
        return naam.replace(/[^a-z0-9]/gi, '_').toLowerCase() + ".ics";
    }
};

const DataOphaler = {
    haalProgrammaDataOp: async function(bestandsPad) {
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

            // KALENDER KNOP ACTIVEREN
            const calBtn = document.getElementById('apple-calendar-btn');
            if (calBtn) {
                calBtn.href = CalendarBouwer.maakIcsLink(prog);
                calBtn.setAttribute('download', CalendarBouwer.maakVeiligeNaam(prog.show_name));
            }
        }
    },

    activeerAlgemeneFuncties: function() {
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

function applyStationParamAsClass() {
    const params = new URLSearchParams(window.location.search);
    const stationName = params.get('station');

    if (stationName) {
        const targetElements = document.querySelectorAll('header, aside, main, button, footer');
        targetElements.forEach(function(element) {
            element.classList.add(stationName.toLowerCase());
        });
    }
}

applyStationParamAsClass();
document.addEventListener('DOMContentLoaded', PaginaBeheer.initialiseerApp);