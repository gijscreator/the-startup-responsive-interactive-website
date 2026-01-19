/**
 * RADIOGIDS - REFACTORED (MAINTAINING ORIGINAL CLASSES & IDS)
 */

// 1. HELPERS (Using the expert's suggestion for querySelectors)
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
    // Using Intl for the short dates in the header
    shortDateFormatter: new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' })
};

// Global State
const currentTime = new Date();
let activeSelectedDay = appConfiguration.daysOfWeek[currentTime.getDay()];

// 3. DATA UTILS
const DataService = {
    async fetchStationData(filePath) {
        try {
            const response = await fetch(filePath);
            const jsonData = await response.json();
            return Array.isArray(jsonData) ? jsonData : (jsonData.data ?? []);
        } catch (error) { 
            console.error("Data fetch failed", error);
            return []; 
        }
    }
};

// 4. TIME CALCULATIONS
const TimeCalculations = {
    convertTimeToMinutes(timeString) {
        if (!timeString) return 0;
        const [hours, minutes] = timeString.split(':').map(Number);
        return (hours * 60) + minutes;
    },

    calculateHourDuration(startTime, endTime) {
        const startTotalMinutes = this.convertTimeToMinutes(startTime);
        let endTotalMinutes = this.convertTimeToMinutes(endTime === '23:59' ? '24:00' : endTime);
        if (endTotalMinutes <= startTotalMinutes) endTotalMinutes += 1440; 
        return Math.round((endTotalMinutes - startTotalMinutes) / 60);
    },

    checkIfProgramIsLive(program) {
        const todayName = appConfiguration.daysOfWeek[currentTime.getDay()];
        // Live status only applies if the selected day is actually today
        if (activeSelectedDay !== todayName) return false;
        
        const currentMinutesFromMidnight = (currentTime.getHours() * 60) + currentTime.getMinutes();
        const startMinutes = this.convertTimeToMinutes(program.from);
        const durationInMinutes = this.calculateHourDuration(program.from, program.until) * 60;
        
        return currentMinutesFromMidnight >= startMinutes && 
               currentMinutesFromMidnight < (startMinutes + durationInMinutes);
    }
};

// 5. UI RENDERING
const UserInterface = {
    generateProgramCardHtml(program, stationSlug) {
        const hourDuration = TimeCalculations.calculateHourDuration(program.from, program.until);
        const isLiveNow = TimeCalculations.checkIfProgramIsLive(program);
        
        // Exact original classes
        const articleClasses = [
            hourDuration > 1 ? 'block' : 'onehour', 
            isLiveNow ? 'live' : ''
        ].filter(Boolean).join(' ');

        const detailPageUrl = `pages/details.html?id=${program.id}-${stationSlug}`;
        
        return `
            <a href="${detailPageUrl}" class="show-card-link">
                <article class="${articleClasses}" style="--duration:${hourDuration};">
                    <img src="${program.show_thumbnail}" alt="${program.show_name}" fetchpriority="high" class="show-header normal-hidden">
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

    updateStationTheme(slug) {
        if (!slug) return;
        // Prefix-aware removal as suggested by expert
        document.body.classList.remove('veronica', 'slam', 'honderdnl');
        document.body.classList.add(slug, 'zenders');

        $$('header, aside, main, button').forEach(el => el.classList.add(slug));

        const dynamicImg = $('#dynamic-img');
        if (dynamicImg) {
            dynamicImg.src = `assets/logo-${slug}.webp`;
            dynamicImg.alt = `Logo ${slug}`;
        }
    }
};

// 6. CORE APPLICATION LOGIC
const RadiogidsApp = {
    async init() {
        const urlParameters = new URLSearchParams(window.location.search);
        const activeStationSlug = urlParameters.get('station');
        const dayParam = urlParameters.get('day');

        // Set state from URL or default to today
        if (dayParam && appConfiguration.daysOfWeek.includes(dayParam.toLowerCase())) {
            activeSelectedDay = dayParam.toLowerCase();
        }

        UserInterface.updateStationTheme(activeStationSlug);

        if (window.location.pathname.includes('details.html')) {
            // Placeholder for details logic if needed
        } else {
            await this.loadStationGrids(activeStationSlug);
            this.setupDaySelector(activeStationSlug);
        }

        this.setupInteractiveFeatures();
    },

    async loadStationGrids(filteredStationSlug) {
        const tasks = appConfiguration.stations.map(async (station) => {
            const gridContainer = $(station.containerSelector);
            if (!gridContainer) return;
            
            if (filteredStationSlug && station.slug !== filteredStationSlug) return;

            const programList = await DataService.fetchStationData(station.dataFile);
            const gridHtml = programList
                .filter(prog => prog.day.toLowerCase() === activeSelectedDay)
                .sort((a, b) => a.from.localeCompare(b.from))
                .map(prog => UserInterface.generateProgramCardHtml(prog, station.slug))
                .join('');

            // Clean existing and inject new
            $$('.show-card-link', gridContainer).forEach(card => card.remove());
            gridContainer.insertAdjacentHTML('beforeend', gridHtml);
        });

        await Promise.all(tasks);
    },

    setupDaySelector(activeStationSlug) {
        // Select all buttons inside the header's list
        const dayButtons = $$('header.home section ul li button');

        dayButtons.forEach((btn, index) => {
            // Index 0 = Today, Index 1 = Tomorrow, Index 2 = +2 days, etc.
            const targetDate = new Date();
            targetDate.setDate(currentTime.getDate() + index);
            
            const dayName = appConfiguration.daysOfWeek[targetDate.getDay()];
            
            if (index === 0) {
                btn.textContent = "Vandaag";
            } else if (index === 1) {
                btn.textContent = "Morgen";
            } else {
                // Use Intl to format any button after 'Tomorrow' (e.g., "20 jan")
                btn.textContent = appConfiguration.shortDateFormatter.format(targetDate);
            }

            // Set active class on load based on URL or Current Day
            btn.classList.toggle('active', dayName === activeSelectedDay);

            btn.onclick = () => {
                activeSelectedDay = dayName;

                // Update URL state
                const url = new URL(window.location);
                url.searchParams.set('day', dayName);
                window.history.pushState({}, '', url);

                // UI Reset: Remove active from all, add to this one
                dayButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Reload the data for the new day
                this.loadStationGrids(activeStationSlug);
            };
        });
    },

    setupInteractiveFeatures() {
        const timeMarker = $('.time-indicator');
        const mainContentArea = $('main');

        if (timeMarker && mainContentArea) {
            const updateTime = () => {
                const now = new Date();
                const decimalHours = now.getHours() + (now.getMinutes() / 60);
                mainContentArea.style.setProperty('--time', decimalHours);
            };

            updateTime();
            setInterval(updateTime, 60000);

            // Expert tip: use scrollIntoView with double RAF
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    timeMarker.scrollIntoView({ behavior: 'auto', inline: 'center' });
                });
            });
        }
    }
};

// Start application
RadiogidsApp.init();