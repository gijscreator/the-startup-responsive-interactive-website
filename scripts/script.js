const HOUR_HEIGHT = 120;

// Data Structure
const schedule = {
    'r1': [
        { start: 0, end: 7, name: "Night Beats", color: "#1e3a8a" },
        { start: 7, end: 11, name: "Breakfast Show", color: "#2563eb" },
        { start: 11, end: 15, name: "The Mix", color: "#3b82f6" },
        { start: 15, end: 19, name: "Drive Time", color: "#60a5fa" },
        { start: 19, end: 24, name: "Late Night Indie", color: "#1d4ed8" }
    ],
    'r2': [
        { start: 0, end: 8, name: "Classical Sleep", color: "#701a75" },
        { start: 8, end: 13, name: "Morning Hall", color: "#a21caf" },
        { start: 13, end: 18, name: "Afternoon Symphony", color: "#d946ef" },
        { start: 18, end: 24, name: "Choral Works", color: "#4a044e" }
    ],
    'r3': [
        { start: 0, end: 6, name: "Ambient Flow", color: "#064e3b" },
        { start: 6, end: 12, name: "Morning Show", color: "#059669" },
        { start: 12, end: 18, name: "Variety Mix", color: "#10b981" },
        { start: 18, end: 24, name: "Underground", color: "#047857" }
    ]
};

function init() {
    setupTimeColumn();
    renderPrograms();
    updateRealTime();
    
    // Auto-scroll to current time on load
    setTimeout(() => {
        const now = new Date();
        const scrollTarget = (now.getHours() * HOUR_HEIGHT) - 100;
        document.getElementById('viewport').scrollTop = scrollTarget;
    }, 500);

    // Update time every second
    setInterval(updateRealTime, 1000);
    
    // Set default date picker
    document.getElementById('datePicker').valueAsDate = new Date();
}

function setupTimeColumn() {
    const col = document.getElementById('timeColumn');
    for (let i = 0; i < 24; i++) {
        const div = document.createElement('div');
        div.className = 'time-marker';
        div.innerText = `${i}:00`;
        col.appendChild(div);
    }
}

function renderPrograms() {
    Object.keys(schedule).forEach(stationId => {
        const track = document.getElementById(`track-${stationId}`);
        schedule[stationId].forEach(prog => {
            const el = document.createElement('article');
            el.className = 'program';
            
            // Positioning Logic
            const top = prog.start * HOUR_HEIGHT;
            const height = (prog.end - prog.start) * HOUR_HEIGHT;
            
            el.style.top = `${top + 4}px`;
            el.style.height = `${height - 8}px`;
            el.style.backgroundColor = prog.color;
            
            el.innerHTML = `
                <strong>${prog.name}</strong>
                <span class="time-meta">${prog.start}:00 - ${prog.end}:00</span>
            `;
            
            track.appendChild(el);
        });
    });
}

function updateRealTime() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();

    // Update Header Clock
    document.getElementById('liveClock').innerText = now.toLocaleTimeString();

    // Update Line Position
    const decimalHours = h + (m / 60) + (s / 3600);
    const linePosition = decimalHours * HOUR_HEIGHT;
    document.getElementById('nowLine').style.top = `${linePosition}px`;
}

// Kick off the app
document.addEventListener('DOMContentLoaded', init);