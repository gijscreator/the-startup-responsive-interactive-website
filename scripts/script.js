/**
 * RADIOGIDS - FULL OPTIMIZED SCRIPT
 */

// 1. CONFIGURATION
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

// 2. HELPERS
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
            "BEGIN:VEVENT", `SUMMARY:${prog.show_name}`,
            `DESCRIPTION:DJ: ${prog.dj_names || 'Onbekend'}`,
            `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
            `RRULE:FREQ=WEEKLY;BYDAY=${prog.day.substring(0, 2).toUpperCase()}`,
            "END:VEVENT", "END:VCALENDAR"
        ].join("\r\n");
        return URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    }
};

// 3. UI LOGIC
const UI = {
    fetchData: async (path) => {
        try {
            const r = await fetch(path);
            const d = await r.json();
            return Array.isArray(d) ? d : (d.data || []);
        } catch (e) { return []; }
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
                        ${live ? '<p class="live-status">Live</p>' : ''}
                    </section>
                </article>
            </a>`;
    },

    init: async () => {
        const params = new URLSearchParams(window.location.search);
        const stParam = params.get('station');
        const path = window.location.pathname;

        if (stParam) {
            document.querySelectorAll('header, aside, main, button')
                .forEach(el => el.classList.add(stParam.toLowerCase()));
        }

        if (path.includes('details.html')) {
            await UI.loadDetails(params.get('id'));
        } else {
            // Wait for all grids to be injected before proceeding to scroll
            await UI.loadGrids(stParam);
        }

        UI.initGlobalFeatures();
    },

    loadGrids: async (activeStation) => {
        // Map all station loads to an array of promises for parallel fetching
        const loadPromises = config.stations.map(async (st) => {
            const container = document.querySelector(st.container);
            if (!container) return;
            if (activeStation && st.slug !== activeStation) return;
            if (activeStation) container.classList.add('is-active');

            const data = await UI.fetchData(st.file);
            const cardsHtml = data
                .filter(p => p.day.toLowerCase() === current_day_name)
                .sort((a, b) => a.from.localeCompare(b.from))
                .map(p => UI.renderCard(p, st.slug))
                .join('');

            container.querySelectorAll('.show-card-link').forEach(c => c.remove());
            container.insertAdjacentHTML('beforeend', cardsHtml);
        });

        await Promise.all(loadPromises);
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
        if (!prog) return;

        const el = (id) => document.getElementById(id);
        if (el('detail-name')) el('detail-name').textContent = prog.show_name;
        if (el('detail-img')) el('detail-img').src = prog.show_thumbnail;
        if (el('detail-djs')) el('detail-djs').textContent = prog.dj_names || "Onbekend";
        if (el('detail-description')) el('detail-description').innerHTML = prog.body || "Geen beschrijving.";
        
        document.title = `${prog.show_name} - Radiogids`;

        const liveInd = el('am-i-live');
        if (liveInd) {
            TijdHulp.isLive(prog) ? liveInd.classList.add('is-live') : (liveInd.style.display = "none");
        }

        const calBtn = el('apple-calendar-btn');
        if (calBtn) {
            calBtn.href = CalendarHulp.generateIcs(prog);
            calBtn.download = `${prog.show_name.replace(/\W/g, '_')}.ics`;
        }
    },

    initGlobalFeatures: () => {
        const line = document.querySelector('.test-line, .test-line-vertical');
        const main = document.querySelector('main');

        if (line && main) {
            const scroll = () => {
                const now = new Date();
                const timeValue = now.getHours() + (now.getMinutes() / 60);
                main.style.setProperty('--time', timeValue);

                if (!main.dataset.scrolled) {
                    const lineRect = line.getBoundingClientRect();

                    if (line.classList.contains('test-line-vertical')) {
                        // VERTICAL: Find vertical offset relative to document
                        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
                        const targetTop = (lineRect.top + scrollY) - (window.innerHeight / 2);
                        window.scrollTo({ top: targetTop, behavior: 'smooth' });
                    } else {
                        // HORIZONTAL: Centering within the main container
                        const targetLeft = (lineRect.left + main.scrollLeft) - (window.innerWidth / 2);
                        main.scrollTo({ left: targetLeft, behavior: 'smooth' });
                    }
                    main.dataset.scrolled = "true";
                }
            };

            // Execute immediately (since loadGrids is awaited)
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