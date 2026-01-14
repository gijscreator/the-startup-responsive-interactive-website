// config voor alle json files en dagen + uren
const config = {
    stations: [
        { id: 1, slug: "veronica", file: 'data/veronica.json', container: '#veronica-shows' },
        { id: 2, slug: "slam", file: 'data/slam.json', container: '#slam-shows' },
        { id: 3, slug: "hondernl", file: 'data/100nl.json', container: '#hondernl-shows' }
    ],
    days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    numWords: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
};

const now = new Date();
const current_day_name = config.days[now.getDay()];
const current_mins = (now.getHours() * 60) + now.getMinutes();

// --- 2. LOGIC & DATA HELPERS ---
const TijdHulp = {
    toMins: (timeStr) => {
        if (!timeStr) return 0;
        const [hrs, mins] = timeStr.split(':').map(Number);
        return (hrs * 60) + mins;
    },

    getDuration: (start, end) => {
        const s = TijdHulp.toMins(start);
        let e = TijdHulp.toMins(end === '23:59' ? '24:00' : end);
        if (e <= s) e += 1440;
        return Math.round((e - s) / 60);
    },

    isLive: (prog) => {
        if (prog.day.toLowerCase() !== current_day_name.toLowerCase()) return false;
        const start = TijdHulp.toMins(prog.from);
        const durationMins = TijdHulp.getDuration(prog.from, prog.until) * 60;
        return current_mins >= start && current_mins < (start + durationMins);
    }
};

const CalendarHulp = {
    generateIcs: (prog) => {
        const startParts = prog.from.split(':').map(Number);
        const endParts = prog.until.split(':').map(Number);
        
        let start = new Date(now);
        const dayIdx = config.days.indexOf(prog.day.toLowerCase());
        let diff = (dayIdx + 7 - now.getDay()) % 7;
        
        if (diff === 0 && now.getHours() >= startParts[0]) diff = 7;
        
        start.setDate(now.getDate() + diff);
        start.setHours(startParts[0], startParts[1], 0, 0);

        let end = new Date(start);
        end.setHours(endParts[0], endParts[1], 0, 0);
        if (end <= start) end.setDate(end.getDate() + 1);

        const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        const ics = [
            "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Radiogids//NL",
            "BEGIN:VEVENT",
            `SUMMARY:${prog.show_name}`,
            `DESCRIPTION:DJ: ${prog.dj_names || 'Onbekend'}`,
            `DTSTART:${fmt(start)}`,
            `DTEND:${fmt(end)}`,
            `RRULE:FREQ=WEEKLY;BYDAY=${prog.day.substring(0, 2).toUpperCase()}`,
            "END:VEVENT", "END:VCALENDAR"
        ].join("\r\n");

        return URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    }
};

// --- 3. UI & RENDERING ---
const UI = {
    fetchData: async (path) => {
        try {
            const r = await fetch(path);
            if (!r.ok) return [];
            const d = await r.json();
            return Array.isArray(d) ? d : (d.data || []);
        } catch (e) {
            return [];
        }
    },

    renderCard: (prog, stationSlug) => {
        const duration = TijdHulp.getDuration(prog.from, prog.until);
        const live = TijdHulp.isLive(prog);
        const durClass = (config.numWords[duration] || 'long') + "hours";
        const link = `pages/details.html?id=${prog.id}-${stationSlug}`;

        return `
            <a href="${link}" class="show-card-link">
                <article class="block ${durClass} ${live ? 'live' : ''}" style="--duration:${duration};">
                    <img src="${prog.show_thumbnail}" alt="${prog.show_name}" class="show-header normal-hidden">
                    <section>
                        <h3 class="fly-in-text title">${prog.show_name}</h3>
                        <p class="time">${prog.from} - ${prog.until}</p>
                        ${live ? '<p class="live-status">NU LIVE</p>' : ''}
                    </section>
                </article>
            </a>`;
    },

    init: async () => {
        const path = window.location.pathname;
        const params = new URLSearchParams(window.location.search);
        
        const stParam = params.get('station');
        if (stParam) {
            document.querySelectorAll('header, aside, main, button, footer')
                .forEach(el => el.classList.add(stParam.toLowerCase()));
        }

        if (path.includes('details.html')) {
            await UI.loadDetails(params.get('id'));
        } else {
            await UI.loadGrids(stParam);
        }

        UI.initGlobalFeatures();
    },

    loadGrids: async (activeStation) => {
        for (const st of config.stations) {
            const container = document.querySelector(st.container);
            if (!container) continue;

            // 1. Branding logic
            if (activeStation && st.slug !== activeStation) continue;
            if (activeStation) container.classList.add('is-active');

            // 2. Fetch data
            const data = await UI.fetchData(st.file);
            
            // 3. Generate HTML for the cards
            const cardsHtml = data
                .filter(p => p.day.toLowerCase() === current_day_name)
                .sort((a, b) => a.from.localeCompare(b.from))
                .map(p => UI.renderCard(p, st.slug))
                .join('');

            // 4. CLEANUP: Only remove previous show links, keep the <figure>!
            const oldCards = container.querySelectorAll('.show-card-link');
            oldCards.forEach(card => card.remove());

            // 5. INSERT: Add the new cards at the end of the container
            container.insertAdjacentHTML('beforeend', cardsHtml);
        }
    },

    loadDetails: async (idParam) => {
        if (!idParam) return;
        const parts = idParam.split('-');
        const stationSlug = parts.pop();
        const progId = parts.join('-');

        const station = config.stations.find(s => s.slug === stationSlug);
        if (!station) return;

        const data = await UI.fetchData(station.file);
        const prog = data.find(p => String(p.id) === String(progId));

        if (prog) {
            // Update Text (with safety checks)
            const nameEl = document.getElementById('detail-name');
            const imgEl = document.getElementById('detail-img');
            const djEl = document.getElementById('detail-djs');
            const descEl = document.getElementById('detail-description');
            const liveInd = document.getElementById('am-i-live');
            const calBtn = document.getElementById('apple-calendar-btn');

            if (nameEl) nameEl.textContent = prog.show_name;
            if (imgEl) imgEl.src = prog.show_thumbnail;
            if (djEl) djEl.textContent = prog.dj_names || "Onbekend";
            if (descEl) descEl.innerHTML = prog.body || "Geen beschrijving.";
            
            document.title = `${prog.show_name} - Radiogids`;

            // Live Check
            if (liveInd) {
                if (TijdHulp.isLive(prog)) {
                    liveInd.classList.add('is-live');
                } else {
                    liveInd.classList.remove('is-live');
                    liveInd.style.display = "none";
                }
            }

            // Calendar
            if (calBtn) {
                calBtn.href = CalendarHulp.generateIcs(prog);
                calBtn.download = `${prog.show_name.replace(/\W/g, '_')}.ics`;
            }
        }
    },

    initGlobalFeatures: () => {
        const line = document.querySelector('.test-line');
        const main = document.querySelector('main.home');
        if (line && main) {
            const scroll = () => {
                main.style.setProperty('--time', (new Date().getHours() + new Date().getMinutes()/60));
                if (!main.dataset.scrolled) {
                    main.scrollLeft = (line.getBoundingClientRect().left + main.scrollLeft) - (window.innerWidth / 2);
                    main.dataset.scrolled = "true";
                }
            };
            scroll();
            setInterval(scroll, 60000);
        }

        const btn = document.querySelector('.play-button');
        if (btn) {
            const audio = new Audio('assets/liedje.mp3');
            btn.addEventListener('click', () => {
                audio.paused ? audio.play() : audio.pause();
                btn.classList.toggle('is-playing', !audio.paused);
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', UI.init);