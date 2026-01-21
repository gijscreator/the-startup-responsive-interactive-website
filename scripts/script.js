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

// 3. SMOOTH SCROLL STATE
let targetX = 0; 
let currentX = 0; 
const lerpFactor = 0.05; 
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// 4. HELPERS / CALCULATIONS
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

// 5. CALENDAR GENERATOR
const CalendarGenerator = {
    createIcsDownloadLink: (program) => {
        const now = new Date();
        const [startH, startM] = program.from.split(':').map(Number);
        const [endH, endM] = program.until.split(':').map(Number);

        // 1. Bereken de eerstvolgende datum voor dit programma
        const programDayIndex = appConfiguration.daysOfWeek.indexOf(program.day.toLowerCase());
        const currentDayIndex = now.getDay();
        let daysUntilNext = (programDayIndex + 7 - currentDayIndex) % 7;

        // Als het vandaag is maar de tijd is al voorbij, verschuif naar volgende week
        if (daysUntilNext === 0 && (now.getHours() > startH || (now.getHours() === startH && now.getMinutes() >= startM))) {
            daysUntilNext = 7;
        }

        const startDate = new Date(now);
        startDate.setDate(now.getDate() + daysUntilNext);
        startDate.setHours(startH, startM, 0, 0);

        const endDate = new Date(startDate);
        endDate.setHours(endH, endM, 0, 0);
        // Als het programma na middernacht eindigt
        if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);

        // 2. Helper functie voor ICS datum formaat (YYYYMMDDTHHMMSSZ)
        const formatICS = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        // 3. Bouw de ICS inhoud
        const icsContent = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Radiogids//NL",
            "BEGIN:VEVENT",
            `UID:${Date.now()}@radiogids.nl`,
            `DTSTAMP:${formatICS(new Date())}`,
            `DTSTART:${formatICS(startDate)}`,
            `DTEND:${formatICS(endDate)}`,
            `SUMMARY:${program.show_name}`,
            `DESCRIPTION:DJ: ${program.dj_names || 'Onbekend'}`,
            `RRULE:FREQ=WEEKLY;BYDAY=${program.day.substring(0, 2).toUpperCase()}`,
            "END:VEVENT",
            "END:VCALENDAR"
        ].join("\r\n");

        return URL.createObjectURL(new Blob([icsContent], { type: 'text/calendar' }));
    }
};

// 6. UI LOGIC
const UserInterface = {
    fetchStationData: async (filePath) => {
        try {
            const response = await fetch(filePath);
            const jsonData = await response.json();
            return Array.isArray(jsonData) ? jsonData : (jsonData.data || []);
        } catch (error) { return []; }
    },

    generateProgramCardHtml: (program, stationSlug) => {
        const hourDuration = TimeCalculations.calculateHourDuration(program.from, program.until);
        const isLiveNow = TimeCalculations.checkIfProgramIsLive(program);
        
        const articleClasses = [
            hourDuration > 1 ? 'block' : 'onehour', 
            isLiveNow ? 'live' : ''
        ].filter(Boolean).join(' ');

        return `
            <a href="pages/details.html?id=${program.id}-${stationSlug}" class="show-card-link">
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
            if (!gridContainer || (filteredStationSlug && station.slug !== filteredStationSlug)) return;

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
            if (index > 1) btn.textContent = appConfiguration.shortDateFormatter.format(targetDate);

            btn.classList.toggle('active', dayName === activeSelectedDay);
            btn.onclick = () => {
                activeSelectedDay = dayName;
                UserInterface.loadStationGrids(activeStationSlug);
                dayButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
        });
    },

    loadProgramDetails: async (uniqueId) => {
        if (!uniqueId) return;
        
        const idSegments = uniqueId.split('-');
        const stationSlug = idSegments.pop().toLowerCase(); // e.g. "veronica"
        const programId = idSegments.join('-');
        
        // --- FIX: Apply station classes for the detail page theme ---
        const elementsToTheme = document.querySelectorAll('header, main, footer, .listener, .detail-container');
        elementsToTheme.forEach(el => el.classList.add(stationSlug));
        document.body.classList.add(`detail-page-${stationSlug}`);

        const stationMatch = appConfiguration.stations.find(s => s.slug === stationSlug);
        if (!stationMatch) return;

        const programData = await UserInterface.fetchStationData(stationMatch.dataFile);
        const selectedProgram = programData.find(p => String(p.id) === String(programId));
        if (!selectedProgram) return;

        // Populate detail elements
        if ($('#detail-name')) $('#detail-name').textContent = selectedProgram.show_name;
        if ($('#detail-djs')) $('#detail-djs').textContent = selectedProgram.dj_names || "Onbekend";
        if ($('#detail-img')) $('#detail-img').src = selectedProgram.show_thumbnail || 'assets/default.webp';
        if ($('#detail-description')) $('#detail-description').innerHTML = selectedProgram.body || selectedProgram.description || "Geen beschrijving.";

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
                        behavior: 'auto', 
                        block: isVertical ? 'center' : 'nearest',
                        inline: isVertical ? 'nearest' : 'center'
                    });
                    
                    // Sync LERP math with auto-scroll position
                    targetX = mainContentArea.scrollLeft;
                    currentX = mainContentArea.scrollLeft;
                });
            });
        }
    }
};

function initSmoothScroll() {
    const scrollContainer = document.querySelector('.grab-scroll');
    if (!scrollContainer) return;

    // Detect if the user is actively scrolling with a trackpad or mouse
    scrollContainer.addEventListener('wheel', (event) => {
        // 1. If it's a touch device, let the browser handle it natively
        if (isTouchDevice) return;

        // 2. Calculate the movement
        // We use deltaY for vertical mice and deltaX for trackpad horizontal swipes
        const isTrackpad = Math.abs(event.deltaX) > 0;
        const moveDelta = isTrackpad ? event.deltaX : event.deltaY;

        // 3. Prevent default vertical page scroll
        event.preventDefault();

        // 4. Update the target position
        targetX += moveDelta * 0.8; 

        // 5. Constrain targetX within bounds
        const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
        targetX = Math.max(0, Math.min(targetX, maxScroll));
    }, { passive: false });

    // Handle manual scroll (grabbing or native touch) to sync targetX
    // This prevents the "snap back" bug when switching between wheel and touch
    scrollContainer.addEventListener('scroll', () => {
        if (Math.abs(scrollContainer.scrollLeft - currentX) > 10) {
            targetX = scrollContainer.scrollLeft;
            currentX = scrollContainer.scrollLeft;
        }
    }, { passive: true });

    function animationLoop() {
        if (!isTouchDevice) {
            // LERP calculation
            currentX += (targetX - currentX) * lerpFactor;
            
            // Apply scroll - use a small threshold to stop the loop when close enough
            if (Math.abs(targetX - currentX) > 0.05) {
                scrollContainer.scrollLeft = currentX;
            }
        }
        requestAnimationFrame(animationLoop);
    }
    
    animationLoop();
}

// 8. START
UserInterface.initializeApplication();
initSmoothScroll();