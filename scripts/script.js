// 1. HELPERS

const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

// 2. CONFIGURATION
const appConfiguration = {
    stations: [
        { id: 1, slug: "veronica", dataFile: 'data/veronica.json', containerSelector: '#veronica-shows' },
        { id: 2, slug: "slam", dataFile: 'data/slam.json', containerSelector: '#slam-shows' },
        { id: 3, slug: "honderdnl", dataFile: 'data/100nl.json', containerSelector: '#honderdnl-shows' }
    ],
    daysOfWeek: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    shortDateFormatter: new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' })
};

const currentTime = new Date();
let activeSelectedDay = appConfiguration.daysOfWeek[currentTime.getDay()];

// 3. HELPERS / CALCULATIONS
const TimeCalculations = {
    convertTimeToMinutes: (timeString) => {
        if (!timeString) return 0;
        const [hours, minutes] = timeString.split(':').map(Number);
        return (hours * 60) + minutes;
    },

    calculateHourDuration: (startTime, endTime) => {
        const startTotalMinutes = TimeCalculations.convertTimeToMinutes(startTime);
        let endTotalMinutes = TimeCalculations.convertTimeToMinutes(endTime === '23:59' ? '24:00' : endTime);
        if (endTotalMinutes <= startTotalMinutes) endTotalMinutes += 1440; 
        return Math.round((endTotalMinutes - startTotalMinutes) / 60);
    },

    checkIfProgramIsLive: (program) => {
        const todayName = appConfiguration.daysOfWeek[currentTime.getDay()];
        if (activeSelectedDay !== todayName) return false;
        
        const currentMinutesFromMidnight = (currentTime.getHours() * 60) + currentTime.getMinutes();
        const startMinutes = TimeCalculations.convertTimeToMinutes(program.from);
        const durationInMinutes = TimeCalculations.calculateHourDuration(program.from, program.until) * 60;
        
        return currentMinutesFromMidnight >= startMinutes && 
               currentMinutesFromMidnight < (startMinutes + durationInMinutes);
    }
};

// 4. CALENDAR GENERATOR
const CalendarGenerator = {
    createIcsDownloadLink: (program) => {
        const formatIcsDate = (dateObj) => dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        const icsContent = [
            "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Radiogids//NL",
            "BEGIN:VEVENT", `SUMMARY:${program.show_name}`,
            `DESCRIPTION:DJ: ${program.dj_names || 'Onbekend'}`,
            `RRULE:FREQ=WEEKLY;BYDAY=${program.day.substring(0, 2).toUpperCase()}`,
            "END:VEVENT", "END:VCALENDAR"
        ].join("\r\n");

        return URL.createObjectURL(new Blob([icsContent], { type: 'text/calendar' }));
    }
};

// 5. UI LOGIC
const UserInterface = {
    fetchStationData: async (filePath) => {
        try {
            const response = await fetch(filePath);
            const jsonData = await response.json();
            return Array.isArray(jsonData) ? jsonData : (jsonData.data || []);
        } catch (error) { 
            console.error("Data fetch failed", error);
            return []; 
        }
    },

    generateProgramCardHtml: (program, stationSlug) => {
        const hourDuration = TimeCalculations.calculateHourDuration(program.from, program.until);
        const isLiveNow = TimeCalculations.checkIfProgramIsLive(program);
        
        const articleClasses = [
            hourDuration > 1 ? 'block' : 'onehour', 
            isLiveNow ? 'live' : ''
        ].filter(Boolean).join(' ');

        const detailPageUrl = `pages/details.html?id=${program.id}-${stationSlug}`;
        
        return `
            <a href="${detailPageUrl}" class="show-card-link">
                <article class="${articleClasses}" style="--duration:${hourDuration};">
                    <img src="${program.show_thumbnail}" alt="${program.show_name}" fetchpriority=high class="show-header normal-hidden">
                    <section>
                        <h3 class="fly-in-text title">${program.show_name}</h3>
                        <p class="time">${program.from} - ${program.until}</p>
                        <div class="wrapper">
                        ${isLiveNow ? '<p class="live">Live</p>' : ''}
                        <p class="link">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7.5 15L12.5 10L7.5 5" stroke="white" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </p>
                        </div>
                    </section>
                </article>
            </a>`;
    },

    initializeApplication: async () => {
        const urlParameters = new URLSearchParams(window.location.search);
        const activeStationSlug = urlParameters.get('station');
        const dayParam = urlParameters.get('day');
        const currentPath = window.location.pathname;

        if (dayParam && appConfiguration.daysOfWeek.includes(dayParam.toLowerCase())) {
            activeSelectedDay = dayParam.toLowerCase();
        }

        if (currentPath.includes('details.html')) {
            await UserInterface.loadProgramDetails(urlParameters.get('id'));
        } else {
            if (activeStationSlug) {
                const slug = activeStationSlug.toLowerCase();
                document.body.className = '';
                document.body.classList.add(slug, 'zenders');
                document.querySelectorAll('header, aside, main, button').forEach(el => el.classList.add(slug));
                
                const img = document.getElementById('dynamic-img');
                if (img) img.src = `assets/logo-${slug}.webp`;
            }

            await UserInterface.loadStationGrids(activeStationSlug);
            UserInterface.setupDaySelector(activeStationSlug);
        }

        UserInterface.setupInteractiveFeatures();
    },

    loadStationGrids: async (filteredStationSlug) => {
        const stationLoadTasks = appConfiguration.stations.map(async (station) => {
            const gridContainer = document.querySelector(station.containerSelector);
            if (!gridContainer) return;
            
            if (filteredStationSlug && station.slug !== filteredStationSlug) return;

            const programList = await UserInterface.fetchStationData(station.dataFile);
            const gridHtml = programList
                .filter(prog => prog.day.toLowerCase() === activeSelectedDay)
                .sort((a, b) => a.from.localeCompare(b.from))
                .map(prog => UserInterface.generateProgramCardHtml(prog, station.slug))
                .join('');

            gridContainer.querySelectorAll('.show-card-link').forEach(card => card.remove());
            gridContainer.insertAdjacentHTML('beforeend', gridHtml);
        });

        await Promise.all(stationLoadTasks);
    },

    setupDaySelector: (activeStationSlug) => {
        const dayButtons = $$('header.home section ul li button');
        
        dayButtons.forEach((btn, index) => {
            const targetDate = new Date();
            targetDate.setDate(currentTime.getDate() + index);
            const dayName = appConfiguration.daysOfWeek[targetDate.getDay()];

            if (index > 1) {
                btn.textContent = appConfiguration.shortDateFormatter.format(targetDate);
            }

            btn.classList.toggle('active', dayName === activeSelectedDay);

            btn.onclick = () => {
                activeSelectedDay = dayName;
                const url = new URL(window.location);
                url.searchParams.set('day', dayName);
                window.history.pushState({}, '', url);

                dayButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                UserInterface.loadStationGrids(activeStationSlug);
            };
        });
    },

    loadProgramDetails: async (uniqueId) => {
        if (!uniqueId) return;
        
        const idSegments = uniqueId.split('-');
        const stationSlug = idSegments.pop().toLowerCase();
        const programId = idSegments.join('-');
        
        const elementsToTheme = document.querySelectorAll('header, main, footer, .listener');
        elementsToTheme.forEach(el => el.classList.add(stationSlug));
        document.body.classList.add(`detail-page-${stationSlug}`);

        const stationMatch = appConfiguration.stations.find(s => s.slug === stationSlug);
        if (!stationMatch) return;

        const programData = await UserInterface.fetchStationData(stationMatch.dataFile);
        const selectedProgram = programData.find(p => String(p.id) === String(programId));
        if (!selectedProgram) return;

        // Populate details
        if ($('#detail-name')) $('#detail-name').textContent = selectedProgram.show_name;
        if ($('#detail-djs')) $('#detail-djs').textContent = selectedProgram.dj_names || "Onbekend";
        if ($('#detail-img')) $('#detail-img').src = selectedProgram.show_thumbnail || 'assets/default.webp';
        if ($('#detail-description')) $('#detail-description').innerHTML = selectedProgram.body || selectedProgram.description || "Geen beschrijving.";

        // Calendar Button logic
        const calendarBtn = document.getElementById('apple-calendar-btn');
        if (calendarBtn) {
            const icsUrl = CalendarGenerator.createIcsDownloadLink(selectedProgram);
            calendarBtn.href = icsUrl;
            calendarBtn.download = `${selectedProgram.show_name.replace(/\s+/g, '_')}.ics`;
        }

        document.title = `${selectedProgram.show_name} - Radiogids`;
    },

    setupInteractiveFeatures: () => {
        const timeMarker = document.querySelector('.time-indicator, .time-indicator-vertical');
        const mainContentArea = document.querySelector('main');

        if (timeMarker && mainContentArea) {
            const updateTime = () => {
                const now = new Date();
                const decimalHours = now.getHours() + (now.getMinutes() / 60);
                mainContentArea.style.setProperty('--time', decimalHours);
            };

            updateTime();
            setInterval(updateTime, 60000);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const isVertical = timeMarker.classList.contains('time-indicator-vertical');
                    timeMarker.scrollIntoView({
                        behavior: 'smooth',
                        block: isVertical ? 'center' : 'nearest',
                        inline: isVertical ? 'nearest' : 'center'
                    });
                });
            });
        }
    }
};



UserInterface.initializeApplication();

// horizontaal scrollen 


// bronnen:
// https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
// https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event

const scrollContainer = document.querySelector('.grab-scroll');

let targetX = 0; // waar je heen wilt 
let currentX = 0; //waar je bent
const lerpFactor = 0.05; // hoe smooth de animatie is

// 1. Capture the wheel event to set the TARGET
window.addEventListener('wheel', (event) => {
    if (scrollContainer.contains(event.target)) {
        event.preventDefault();
        // Update the target based on the wheel movement
        targetX += event.deltaY; 
        
        // Keep target within the bounds of the container
        const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
        targetX = Math.max(0, Math.min(targetX, maxScroll));
    }
}, { passive: false });

// 2. Create an animation loop to move toward the target
function update() {
    // This formula is the secret: 
    // Current moves a percentage of the distance to Target every frame
    currentX += (targetX - currentX) * lerpFactor;

    // Apply the position
    scrollContainer.scrollLeft = currentX;

    requestAnimationFrame(update);
}

// Start the loop
update();