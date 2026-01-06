const pixelsPerHour = 120;

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
        console.error(error);
    }
}

function buildApp(veronicaShows, slamShows, honderdShows) {
    createTimeLabels();
    drawProgramsOnGrid('track-r1', veronicaShows, '--veronica-blue');
    drawProgramsOnGrid('track-r2', honderdShows, '--honderdnl-orange');
    drawProgramsOnGrid('track-r3', slamShows, '--slam-pink');
    
    // Set the red line position FIRST
    moveRedLineAndClock();
    
    // Then scroll to it immediately after the next paint
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
    
    for (let hour = 0; hour < 24; hour++) {
        const timeLabel = document.createElement('div');
        timeLabel.innerText = `${hour}:00`;
        timeLabel.style.height = `${pixelsPerHour}px`;
        timeColumn.appendChild(timeLabel);
    }
}

function drawProgramsOnGrid(trackId, shows, colorVar) {
    const track = document.getElementById(trackId);
    if (!track) return;
    
    track.innerHTML = '';
    
    shows.forEach(item => {
        const showBox = document.createElement('article');
        
        const start = convertTimeToNumber(item.from);
        let end = convertTimeToNumber(item.until);
        
        if (item.until === "23:59:00" || item.until === "00:00:00") end = 24;
        
        showBox.style.top = (start * pixelsPerHour) + 'px';
        showBox.style.height = ((end - start) * pixelsPerHour) + 'px';
        showBox.style.backgroundColor = `var(${colorVar})`;
        
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
        redLine.style.top = (timeAsDecimal * pixelsPerHour) + 'px';
    }
}

function autoScrollToNow() {
    const scrollingWindow = document.getElementById('viewport');
    const redLine = document.getElementById('nowLine');
    
    if (scrollingWindow && redLine) {
        const linePosition = parseFloat(redLine.style.top);
        
        // Check if linePosition is valid (not NaN)
        if (!isNaN(linePosition) && linePosition > 0) {
            // Center the line in the viewport
            const targetScroll = linePosition - (scrollingWindow.offsetHeight / 2);
            scrollingWindow.scrollTop = Math.max(0, targetScroll);
        }
    }
}

function convertTimeToNumber(timeString) {
    const parts = timeString.split(':');
    return parseInt(parts[0]) + (parseInt(parts[1]) / 60);
}

const viewport = document.getElementById('viewport');

let touchStartLeft, touchStartTop;

viewport.addEventListener('touchstart', (e) => {
    touchStartLeft = viewport.scrollLeft;
    touchStartTop = viewport.scrollTop;
}, { passive: true });

viewport.addEventListener('scroll', () => {
    const dx = Math.abs(viewport.scrollLeft - touchStartLeft);
    const dy = Math.abs(viewport.scrollTop - touchStartTop);

    // If we have moved more than 5px
    if (dx > 5 || dy > 5) {
        if (dx > dy) {
            // User is scrolling horizontally, lock vertical
            viewport.scrollTop = touchStartTop;
        } else {
            // User is scrolling vertically, lock horizontal
            viewport.scrollLeft = touchStartLeft;
        }
    }
});

startApp();

