

// 1. Selecteer de nodige elementen

const getElement = (selector, context = document) => context.querySelector(selector);
const getAllElements = (selector, context = document) => Array.from(context.querySelectorAll(selector));

// 2. Configuratie voor de json files
const appConfiguration = {
    stations: [

        { id: 1, slug: "veronica", dataFile: 'data/veronica.json', containerSelector: '.veronica-shows' },
        { id: 2, slug: "slam", dataFile: 'data/slam.json', containerSelector: '.slam-shows' },
        { id: 3, slug: "honderdnl", dataFile: 'data/100nl.json', containerSelector: '.honderdnl-shows' }
    ],

    daysOfWeek: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    shortDateFormatter: new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' })
};

// bepaal de tijd van de gebruiker

const SystemCurrentTime = new Date();
let activeSelectedDay = appConfiguration.daysOfWeek[SystemCurrentTime.getDay()];

// 3. Scrollen op desktop, mobiel en trackpad zo aangenaam mogelijk maken voor de gebruiker

let smoothScrollTargetX = 0; 
let smoothScrollCurrentX = 0; 
const SmoothScrollingFactor = 0.08; 
const IsTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// 4. Bereken de tijd en check welk programma live is

const TimeUtilities = {
    convertTimeToMinutes: (timeString) => {
        if (!timeString) return 0;
        const [hours, minutes] = timeString.split(':').map(Number);
        return (hours * 60) + minutes;
    },

    calculateHourDuration: (startTime, endTime) => {
        const startTotalMinutes = TimeUtilities.convertTimeToMinutes(startTime);
        let endTotalMinutes = TimeUtilities.convertTimeToMinutes(endTime === '23:59' ? '24:00' : endTime);
        if (endTotalMinutes <= startTotalMinutes) endTotalMinutes += 1440; 
        return (endTotalMinutes - startTotalMinutes) / 60; 
    },

    checkIfProgramIsLive: (program) => {
        const todayName = appConfiguration.daysOfWeek[SystemCurrentTime.getDay()];
        if (activeSelectedDay !== todayName) return false;
        
        const currentMinutesFromMidnight = (SystemCurrentTime.getHours() * 60) + SystemCurrentTime.getMinutes();
        const startMinutes = TimeUtilities.convertTimeToMinutes(program.from);
        const durationInMinutes = TimeUtilities.calculateHourDuration(program.from, program.until) * 60;
        
        return currentMinutesFromMidnight >= startMinutes && 
               currentMinutesFromMidnight < (startMinutes + durationInMinutes);
    }
};

// 5. Apple ics kalender functie ( omdat het kan )

const CalendarExportManager = {

    createIcsDownloadLink: (program) => {
        const now = new Date();
        const [startH, startM] = program.from.split(':').map(Number);
        const [endH, endM] = program.until.split(':').map(Number);

        const programDayIndex = appConfiguration.daysOfWeek.indexOf(program.day.toLowerCase());
        const currentDayIndex = now.getDay();
        let daysUntilNext = (programDayIndex + 7 - currentDayIndex) % 7;

        if (daysUntilNext === 0 && (now.getHours() > startH || (now.getHours() === startH && now.getMinutes() >= startM))) {
            daysUntilNext = 7;
        }

        const startDate = new Date(now);
        startDate.setDate(now.getDate() + daysUntilNext);
        startDate.setHours(startH, startM, 0, 0);

        const endDate = new Date(startDate);
        endDate.setHours(endH, endM, 0, 0);
        if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);

        const formatToIcsString = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        // wat er perse in een ics moet staan: https://stackoverflow.com/questions/19137089/create-ics-file-with-javascript-or-jquery
        const icsContent = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Radiogids//NL",
            "BEGIN:VEVENT",
            `UID:${Date.now()}@radiogids.nl`,
            `DTSTAMP:${formatToIcsString(new Date())}`,
            `DTSTART:${formatToIcsString(startDate)}`,
            `DTEND:${formatToIcsString(endDate)}`,
            `SUMMARY:${program.show_name}`,
            `DESCRIPTION:DJ: ${program.dj_names || 'Onbekend'}`,
            `RRULE:FREQ=WEEKLY;BYDAY=${program.day.substring(0, 2).toUpperCase()}`,
            "END:VEVENT",
            "END:VCALENDAR"
        ].join("\r\n");

        return URL.createObjectURL(new Blob([icsContent], { type: 'text/calendar' }));
    }
};

// 6. Alles inladen op de site

const UserInterfaceController = {
    fetchStationData: async (filePath) => {
        try {
            const response = await fetch(filePath);
            const jsonData = await response.json();
            return Array.isArray(jsonData) ? jsonData : (jsonData.data || []);
        } catch (error) { return []; }
    },

    generateProgramCardHtml: (program, stationSlug) => {
        const hourDuration = TimeUtilities.calculateHourDuration(program.from, program.until);
        const isLiveNow = TimeUtilities.checkIfProgramIsLive(program);
        
        const articleClasses = [
            hourDuration > 1.1 ? 'block' : 'onehour', 
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
            await UserInterfaceController.loadProgramDetails(urlParameters.get('id'));
        } else {
            if (activeStationSlug) {
                const slug = activeStationSlug.toLowerCase();
                document.body.classList.add(slug, 'zenders');
                getAllElements('header, aside, main, button').forEach(el => el.classList.add(slug));
                
                const logoImage = getElement('#dynamic-img');
                if (logoImage) logoImage.src = `assets/logo-${slug}.webp`;
            }
            await UserInterfaceController.loadStationGrids(activeStationSlug);
            UserInterfaceController.setupDaySelector(activeStationSlug);
        }
        UserInterfaceController.setupInteractiveFeatures();
        UserInterfaceController.initStickyObserver();
    },

    loadStationGrids: async (filteredStationSlug) => {
        const stationLoadTasks = appConfiguration.stations.map(async (station) => {
            const gridContainer = document.querySelector(station.containerSelector);
            if (!gridContainer || (filteredStationSlug && station.slug !== filteredStationSlug)) return;

            const programList = await UserInterfaceController.fetchStationData(station.dataFile);
            const gridHtml = programList
                .filter(prog => prog.day.toLowerCase() === activeSelectedDay)
                .sort((a, b) => a.from.localeCompare(b.from))
                .map(prog => UserInterfaceController.generateProgramCardHtml(prog, station.slug))
                .join('');

            const oldCards = gridContainer.querySelectorAll('.show-card-link');
            oldCards.forEach(card => card.remove());
            gridContainer.insertAdjacentHTML('beforeend', gridHtml);
        });
        await Promise.all(stationLoadTasks);
    },

    setupDaySelector: (activeStationSlug) => {
        const dayButtons = getAllElements('header.home section ul li button');
        dayButtons.forEach((btn, index) => {
            const targetDate = new Date();
            targetDate.setDate(SystemCurrentTime.getDate() + index);
            const dayName = appConfiguration.daysOfWeek[targetDate.getDay()];
            
            if (index > 1 && btn) btn.textContent = appConfiguration.shortDateFormatter.format(targetDate);

            btn.classList.toggle('active', dayName === activeSelectedDay);
            btn.onclick = () => {
                activeSelectedDay = dayName;
                UserInterfaceController.loadStationGrids(activeStationSlug);
                dayButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
        });
    },

    loadProgramDetails: async (uniqueId) => {
        if (!uniqueId) return;
        
        const idSegments = uniqueId.split('-');
        const stationSlug = idSegments.pop().toLowerCase();
        const programId = idSegments.join('-');
        
        const elementsToTheme = getAllElements('header, main, footer, .listener, .detail-container');
        elementsToTheme.forEach(el => el.classList.add(stationSlug));
        document.body.classList.add(`detail-page-${stationSlug}`);

        const stationMatch = appConfiguration.stations.find(s => s.slug === stationSlug);
        if (!stationMatch) return;

        const programData = await UserInterfaceController.fetchStationData(stationMatch.dataFile);
        const selectedProgram = programData.find(p => String(p.id) === String(programId));
        if (!selectedProgram) return;

        if (getElement('#detail-name')) getElement('#detail-name').textContent = selectedProgram.show_name;
        if (getElement('#detail-djs')) getElement('#detail-djs').textContent = selectedProgram.dj_names || "Onbekend";
        if (getElement('#detail-img')) getElement('#detail-img').src = selectedProgram.show_thumbnail || 'assets/default.webp';
        if (getElement('#detail-description')) getElement('#detail-description').innerHTML = selectedProgram.body || selectedProgram.description || "Geen beschrijving.";

        const calendarBtn = document.getElementById('apple-calendar-btn');
        if (calendarBtn) {
            const icsUrl = CalendarExportManager.createIcsDownloadLink(selectedProgram);
            calendarBtn.href = icsUrl;
            calendarBtn.download = `${selectedProgram.show_name.replace(/\s+/g, '_')}.ics`;
        }
        document.title = `${selectedProgram.show_name} - Radiogids`;
    },

    setupInteractiveFeatures: () => {
        const timeMarker = getElement('.time-indicator, .time-indicator-vertical');
        const mainContentArea = getElement('main');
        const scrollContainer = getElement('.grab-scroll');

        if (timeMarker && mainContentArea) {
            const updateTime = () => {
                const now = new Date();
                const decimalHours = now.getHours() + (now.getMinutes() / 60);
                mainContentArea.style.setProperty('--time', decimalHours);
            };
            updateTime();
            setInterval(updateTime, 60000);

            // Logic preserved exactly: Center marker on click
            timeMarker.addEventListener('click', () => {
                if (scrollContainer) {
                    const markerOffset = timeMarker.offsetLeft;
                    const containerWidth = scrollContainer.clientWidth;
                    const newTargetX = markerOffset - (containerWidth / 2);
                    
                    smoothScrollTargetX = Math.max(0, Math.min(newTargetX, scrollContainer.scrollWidth - containerWidth));
                    
                    if (IsTouchDevice) {
                        scrollContainer.scrollTo({
                            left: smoothScrollTargetX,
                            behavior: 'smooth'
                        });
                    }
                }
            });

            setTimeout(() => {
                const isVertical = timeMarker.classList.contains('time-indicator-vertical');
                timeMarker.scrollIntoView({
                    behavior: 'smooth', 
                    block: isVertical ? 'center' : 'nearest',
                    inline: isVertical ? 'nearest' : 'center'
                });
                
                setTimeout(() => {
                    smoothScrollTargetX = scrollContainer.scrollLeft;
                    smoothScrollCurrentX = scrollContainer.scrollLeft;
                }, 500);
            }, 300);
        }
    },

    initStickyObserver: () => {
        const indicator = getElement('.time-indicator');
        const scrollContainer = getElement('.grab-scroll');
        if (!indicator || !scrollContainer) return;

        const handleStickyClasses = () => {
            const containerRect = scrollContainer.getBoundingClientRect();
            const indicatorRect = indicator.getBoundingClientRect();

            const isAtLeft = indicatorRect.left <= containerRect.left + 2;
            const isAtRight = indicatorRect.right >= containerRect.right - 2;

            const isSticky = isAtLeft || isAtRight;

            indicator.classList.toggle('is-sticky', isSticky);
            indicator.classList.toggle('is-sticky-left', isAtLeft);
            indicator.classList.toggle('is-sticky-right', isAtRight);
        };

        scrollContainer.addEventListener('scroll', handleStickyClasses, { passive: true });
        window.addEventListener('resize', handleStickyClasses);
        handleStickyClasses();
    }
};

// 7. Smooth scroll functie
function initSmoothScroll() {
    const scrollContainer = document.querySelector('.grab-scroll');
    if (!scrollContainer) return;

    scrollContainer.addEventListener('wheel', (event) => {
        if (IsTouchDevice) return;
        const isTrackpad = Math.abs(event.deltaX) > 0;
        const moveDelta = isTrackpad ? event.deltaX : event.deltaY;
        event.preventDefault();
        smoothScrollTargetX += moveDelta * 0.8; 
        const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
        smoothScrollTargetX = Math.max(0, Math.min(smoothScrollTargetX, maxScroll));
    }, { passive: false });

    scrollContainer.addEventListener('scroll', () => {
        if (Math.abs(scrollContainer.scrollLeft - smoothScrollCurrentX) > 10) {
            smoothScrollTargetX = scrollContainer.scrollLeft;
            smoothScrollCurrentX = scrollContainer.scrollLeft;
        }
    }, { passive: true });

    function animationLoop() {
        if (!IsTouchDevice) {
            smoothScrollCurrentX += (smoothScrollTargetX - smoothScrollCurrentX) * SmoothScrollingFactor;
            if (Math.abs(smoothScrollTargetX - smoothScrollCurrentX) > 0.1) {
                scrollContainer.scrollLeft = smoothScrollCurrentX;
            }
        }
        requestAnimationFrame(animationLoop);
    }
    animationLoop();
}

// 8. init de app

UserInterfaceController.initializeApplication();
initSmoothScroll();
