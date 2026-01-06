const scrollContainer = document.querySelector('main section:nth-of-type(2)');

let lastAxis = null; // "x" or "y"
let scrollTimeout;

scrollContainer.addEventListener('wheel', (e) => {
    // Determine dominant scroll axis
    if (!lastAxis) {
        lastAxis = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? 'x' : 'y';
    }

    if (lastAxis === 'x') {
        // Lock vertical scroll
        scrollContainer.scrollTop += 0;
        scrollContainer.scrollLeft += e.deltaX;
    } else {
        // Lock horizontal scroll
        scrollContainer.scrollLeft += 0;
        scrollContainer.scrollTop += e.deltaY;
    }

    // Reset axis after 150ms of no scroll
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        lastAxis = null;
    }, 150);

    e.preventDefault(); // prevent diagonal native scrolling
}, { passive: false });
