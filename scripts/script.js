/**
 * RADIOGIDS - READABLE & OPTIMIZED SCRIPT
 */



// 1. CONFIGURATION
const appConfiguration = {
    stations: [
        { id: 1, slug: "veronica", dataFile: 'data/veronica.json', containerSelector: '#veronica-shows' },
        { id: 2, slug: "slam", dataFile: 'data/slam.json', containerSelector: '#slam-shows' },
        { id: 3, slug: "honderdnl", dataFile: 'data/100nl.json', containerSelector: '#honderdnl-shows' }
    ],
    daysOfWeek: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    durationWords: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
};

const currentTime = new Date();
const currentDayName = appConfiguration.daysOfWeek[currentTime.getDay()];
const currentMinutesFromMidnight = (currentTime.getHours() * 60) + currentTime.getMinutes();

// 2. HELPERS
const TimeCalculations = {
    convertTimeToMinutes: (timeString) => {
        if (!timeString) return 0;
        const [hours, minutes] = timeString.split(':').map(Number);
        return (hours * 60) + minutes;
    },

    calculateHourDuration: (startTime, endTime) => {
        const startTotalMinutes = TimeCalculations.convertTimeToMinutes(startTime);
        let endTotalMinutes = TimeCalculations.convertTimeToMinutes(endTime === '23:59' ? '24:00' : endTime);
        
        // Handle shows crossing midnight
        if (endTotalMinutes <= startTotalMinutes) endTotalMinutes += 1440; 
        
        return Math.round((endTotalMinutes - startTotalMinutes) / 60);
    },

    checkIfProgramIsLive: (program) => {
        if (program.day.toLowerCase() !== currentDayName.toLowerCase()) return false;
        
        const startMinutes = TimeCalculations.convertTimeToMinutes(program.from);
        const durationInMinutes = TimeCalculations.calculateHourDuration(program.from, program.until) * 60;
        
        return currentMinutesFromMidnight >= startMinutes && 
               currentMinutesFromMidnight < (startMinutes + durationInMinutes);
    }
};

const CalendarGenerator = {
    createIcsDownloadLink: (program) => {
        const startTimeParts = program.from.split(':').map(Number);
        const endTimeParts = program.until.split(':').map(Number);
        
        let eventDate = new Date(currentTime);
        const programDayIndex = appConfiguration.daysOfWeek.indexOf(program.day.toLowerCase());
        let daysUntilNextOccurrence = (programDayIndex + 7 - currentTime.getDay()) % 7;
        
        if (daysUntilNextOccurrence === 0 && currentTime.getHours() >= startTimeParts[0]) {
            daysUntilNextOccurrence = 7;
        }
        
        eventDate.setDate(currentTime.getDate() + daysUntilNextOccurrence);
        eventDate.setHours(startTimeParts[0], startTimeParts[1], 0, 0);
        
        let endDate = new Date(eventDate);
        endDate.setHours(endTimeParts[0], endTimeParts[1], 0, 0);
        if (endDate <= eventDate) endDate.setDate(endDate.getDate() + 1);

        const formatIcsDate = (dateObj) => dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        const icsContent = [
            "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Radiogids//NL",
            "BEGIN:VEVENT", `SUMMARY:${program.show_name}`,
            `DESCRIPTION:DJ: ${program.dj_names || 'Onbekend'}`,
            `DTSTART:${formatIcsDate(eventDate)}`, `DTEND:${formatIcsDate(endDate)}`,
            `RRULE:FREQ=WEEKLY;BYDAY=${program.day.substring(0, 2).toUpperCase()}`,
            "END:VEVENT", "END:VCALENDAR"
        ].join("\r\n");

        return URL.createObjectURL(new Blob([icsContent], { type: 'text/calendar' }));
    }
};

// 3. UI LOGIC
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
        
        // 1. Only add 'block' if duration > 1 hour
        // 2. Removed the durationWords class logic entirely
        const articleClasses = [
            hourDuration > 1 ? 'block' : 'onehour', 
            isLiveNow ? 'live' : ''
        ].filter(Boolean).join(' ');

        const detailPageUrl = `pages/details.html?id=${program.id}-${stationSlug}`;
        
        return `
            <a href="${detailPageUrl}" class="show-card-link">
                <article class="${articleClasses}" style="--duration:${hourDuration};">
                    <img src="${program.show_thumbnail}" alt="${program.show_name}" loading="lazy" class="show-header normal-hidden">
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
        const currentPath = window.location.pathname;

        const stationLogos = {
            veronica: 'assets/logo-veronica.webp',
            honderdnl: 'assets/logo-100nl.webp',
            slam: 'assets/logo-slam.webp'
        };

    if (activeStationSlug) {
        const slug = activeStationSlug.toLowerCase();

        document.body.className = '';
        document.body.classList.add(slug, 'zenders');

        document.querySelectorAll('header, aside, main, button')
            .forEach(element => element.classList.add(slug));

        // 👇 DYNAMISCHE IMAGE
        const dynamicImg = document.getElementById('dynamic-img');
        if (dynamicImg && stationLogos[slug]) {
            dynamicImg.src = stationLogos[slug];
            dynamicImg.alt = `Logo ${slug}`;
        }
    }


        if (currentPath.includes('details.html')) {
            await UserInterface.loadProgramDetails(urlParameters.get('id'));
        } else {
            await UserInterface.loadStationGrids(activeStationSlug);
        }

        if (activeStationSlug) {
            const slug = activeStationSlug.toLowerCase();
            
            // Your existing code
            document.body.className = '';
            document.body.classList.add(slug, 'zenders');

            // Update the main img src to match the slug
            const img = document.getElementById('dynamic-img');
            if (img) {
                img.src = `assets/logo-${slug}.webp`;
            }
        }

        UserInterface.setupInteractiveFeatures();
    },

    loadStationGrids: async (filteredStationSlug) => {
        const stationLoadTasks = appConfiguration.stations.map(async (station) => {
            const gridContainer = document.querySelector(station.containerSelector);
            if (!gridContainer) return;
            
            if (filteredStationSlug && station.slug !== filteredStationSlug) return;
            if (filteredStationSlug) gridContainer.classList.add('is-active');

            const programList = await UserInterface.fetchStationData(station.dataFile);
            const gridHtml = programList
                .filter(prog => prog.day.toLowerCase() === currentDayName)
                .sort((a, b) => a.from.localeCompare(b.from))
                .map(prog => UserInterface.generateProgramCardHtml(prog, station.slug))
                .join('');

            // Clean existing and inject new
            gridContainer.querySelectorAll('.show-card-link').forEach(card => card.remove());
            gridContainer.insertAdjacentHTML('beforeend', gridHtml);
        });

        await Promise.all(stationLoadTasks);
    },

   loadProgramDetails: async (uniqueId) => {
    if (!uniqueId) return;
    
    // 1. Haal de zender-slug uit de ID (bijv. "show63-slam" -> "slam")
    const idSegments = uniqueId.split('-');
    const stationSlug = idSegments.pop().toLowerCase(); // "slam"
    const programId = idSegments.join('-');
    
    // 2. VOEG DE CLASS TOE AAN DE ELEMENTEN
    // We selecteren de header, main en footer en voegen de slug toe als class
    const elementsToTheme = document.querySelectorAll('header, main, footer, .listener');
    elementsToTheme.forEach(el => {
        el.classList.add(stationSlug);
    });

    // Optioneel: voeg het ook toe aan de body voor globale styling
    document.body.classList.add(`detail-page-${stationSlug}`);

    // 3. De rest van je bestaande logica om data op te halen
    const stationMatch = appConfiguration.stations.find(s => s.slug === stationSlug);
    if (!stationMatch) return;

    const programData = await UserInterface.fetchStationData(stationMatch.dataFile);
    const selectedProgram = programData.find(p => String(p.id) === String(programId));
    
    if (!selectedProgram) return;

    // --- Update de UI elementen ---
    const titleEl = document.getElementById('detail-name');
    if (titleEl) titleEl.textContent = selectedProgram.show_name || "";

    const djEl = document.getElementById('detail-djs');
    if (djEl) djEl.textContent = selectedProgram.dj_names || "Onbekend";

    const thumbnailImg = document.getElementById('detail-img'); // Zorg dat dit ID in je HTML staat bij de IMG
    if (thumbnailImg) {
        thumbnailImg.src = selectedProgram.show_thumbnail || 'assets/default.webp';
    }

    const descriptionContainer = document.getElementById('detail-description');
    if (descriptionContainer) {
        descriptionContainer.innerHTML = selectedProgram.body || selectedProgram.description || "Geen beschrijving.";
    }

    // Update ook de WhatsApp link of andere station-specifieke knoppen
    const whatsappLink = document.querySelector('header.details nav a');
    if (whatsappLink) {
        whatsappLink.className = stationSlug; // Overschrijft 'slam' met de actuele slug
    }

    document.title = `${selectedProgram.show_name || 'Radio'} - Radiogids`;
},

    setupInteractiveFeatures: () => {
        const timeMarker = document.querySelector('.time-indicator, .time-indicator-vertical');
        const mainContentArea = document.querySelector('main');

        if (timeMarker && mainContentArea) {
            const updateTimeAndScroll = () => {
                const now = new Date();
                const timeInDecimalHours = now.getHours() + (now.getMinutes() / 60);
                mainContentArea.style.setProperty('--time', timeInDecimalHours);

                if (!mainContentArea.dataset.scrolled) {
                    requestAnimationFrame(() => {
                        const scrollToCurrentTime = () => {
                            const markerPosition = timeMarker.getBoundingClientRect();
                            
                            if (timeMarker.classList.contains('time-indicator-vertical')) {
                                const targetY = (window.pageYOffset + markerPosition.top) - (window.innerHeight / 2);
                                window.scrollTo({ top: targetY, behavior: 'auto' }); 
                            } else {
                                const targetX = (mainContentArea.scrollLeft + markerPosition.left) - (window.innerWidth / 2);
                                mainContentArea.scrollTo({ left: targetX, behavior: 'auto' });
                            }
                            mainContentArea.dataset.scrolled = "true";
                        };

                        // Use a small delay to ensure layout is ready
                        setTimeout(scrollToCurrentTime, 50);
                    });
                }
            };

            updateTimeAndScroll();
            setInterval(updateTimeAndScroll, 60000);
        }

        const audioPlayButton = document.querySelector('.play-button');
        if (audioPlayButton) {
            const radioAudio = new Audio('assets/song.mp3');
            audioPlayButton.addEventListener('click', () => {
                radioAudio.paused ? radioAudio.play() : radioAudio.pause();
                audioPlayButton.classList.toggle('is-playing', !radioAudio.paused);
            });
        }
    }
};

UserInterface.initializeApplication();