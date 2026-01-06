const pixelsPerHour = 120;
const headerOffset = 60; // Height of the sticky station-header

async function startApp() {
    try {
        // Fetch all three station data files
        const [veronicaRes, slamRes, honderdRes] = await Promise.all([
            fetch('./data/veronica.json'),
            fetch('./data/slam.json'),
            fetch('./data/100nl.json')
        ]);
        
        const [veronicaDays, slamDays, honderdDays] = await Promise.all([
            veronicaRes.json(),
            slamRes.json(),
            honderdRes.json()
        ]);
        
        const nameOfToday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()).toLowerCase();
        
        const veronicaToday = veronicaDays.find(item => item.day === nameOfToday) || veronicaDays[0];
        const slamToday = slamDays.find(item => item.day === nameOfToday) || slamDays[0];
        const honderdToday = honderdDays.find(item => item.day === nameOfToday) || honderdDays[0];
        
        buildApp(veronicaToday.shows, slamToday.shows, honderdToday.shows); 
    } catch (error) {
        console.error("Error loading radio data:", error);
    }
}

function buildApp(veronicaShows, slamShows, honderdShows) {
    createTimeLabels();
    drawProgramsOnGrid('track-r1', veronicaShows, '--veronica-blue');
    drawProgramsOnGrid('track-r2', honderdShows, '--honderdnl-orange');
    drawProgramsOnGrid('track-r3', slamShows, '--slam-pink');
    
    // Set the red line position FIRST
    moveRedLineAndClock();
    
    // Then scroll to it immediately
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            autoScrollToNow();
        });
    });
    
    // Start the interval for continuous updates
    setInterval(moveRedLineAndClock, 1000);
}

function createTimeLabels() {
    const timeColumn = document.getElementById('timeColumn');
    if (!timeColumn) return;
    
    timeColumn.innerHTML = ''; // Clear existing

    // 1. Create a spacer for the top logo area so 00:00 starts at the right height
    const spacer = document.createElement('div');
    spacer.style.height = `${headerOffset}px`;
    timeColumn.appendChild(spacer);
    
    // 2. Create the hour labels
    for (let hour = 0; hour < 24; hour++) {
        const timeLabel = document.createElement('div');
        timeLabel.innerText = `${hour.toString().padStart(2, '0')}:00`;
        timeLabel.style.height = `${pixelsPerHour}px`;
        timeColumn.appendChild(timeLabel);
    }
}

function drawProgramsOnGrid(trackId, shows, colorVar) {
    const track = document.getElementById(trackId);
    if (!track) return;
    
    // We clear everything EXCEPT the sticky header (the first child)
    const header = track.querySelector('.station-header');
    track.innerHTML = '';
    if (header) track.appendChild(header);
    
    shows.forEach(item => {
        const showBox = document.createElement('article');
        
        const start = convertTimeToNumber(item.from);
        let end = convertTimeToNumber(item.until);
        
        // Handle midnight wrap-around
        if (item.until === "23:59:00" || item.until === "00:00:00" || end < start) end = 24;
        
        // Add headerOffset to the top position
        showBox.style.top = (start * pixelsPerHour + headerOffset) + 'px';
        showBox.style.height = ((end - start) * pixelsPerHour) + 'px';
        showBox.style.backgroundColor = `var(${colorVar})`;
        showBox.style.position = 'absolute'; // Ensure they are layered correctly
        
        showBox.innerHTML = `
            <strong>${item.show.name}</strong>
            <span>${item.from.substring(0,5)} - ${item.until.substring(0,5)}</span>
        `;
        
        track.appendChild(showBox);
    });
}

function moveRedLineAndClock() {
    const now = new Date();
    const clockEl = document.getElementById('liveClock');
    if (clockEl) clockEl.innerText = now.toLocaleTimeString('nl-NL');
    
    const timeAsDecimal = now.getHours() + (now.getMinutes() / 60) + (now.getSeconds() / 3600);
    const redLine = document.getElementById('nowLine');
    if (redLine) {
        // Add headerOffset to the red line top position
        redLine.style.top = (timeAsDecimal * pixelsPerHour + headerOffset) + 'px';
    }
}

function autoScrollToNow() {
    const scrollingWindow = document.getElementById('viewport');
    const redLine = document.getElementById('nowLine');
    
    if (scrollingWindow && redLine) {
        const linePosition = parseFloat(redLine.style.top);
        
        if (!isNaN(linePosition) && linePosition > 0) {
            // Scroll so the red line is centered, but respect the sticky header
            const targetScroll = linePosition - (scrollingWindow.offsetHeight / 2);
            scrollingWindow.scrollTop = Math.max(0, targetScroll);
        }
    }
}

function convertTimeToNumber(timeString) {
    if (!timeString) return 0;
    const parts = timeString.split(':');
    return parseInt(parts[0]) + (parseInt(parts[1]) / 60);
}

// Kick off the app
startApp();