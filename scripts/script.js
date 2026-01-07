const containers = document.querySelectorAll('.sync-scroll');
let leader = null;

// Function to sync the scroll
const sync = (e) => {
    if (leader && leader !== e.target) return; // Ignore if this isn't the leader
    
    leader = e.target;
    const scrollLeft = leader.scrollLeft;

    containers.forEach((container) => {
        if (container !== leader) {
            container.scrollLeft = scrollLeft;
        }
    });
};

// Clean up leader when scrolling stops or finger lifts
const stopSync = () => {
    leader = null;
};

containers.forEach((container) => {
    // 1. Detect the "Leader" via touch or mouse click
    container.addEventListener('pointerdown', () => {
        leader = container;
    });

    // 2. Listen for scroll events
    container.addEventListener('scroll', sync, { passive: true });

    // 3. Reset when interaction ends
    window.addEventListener('pointerup', stopSync);
});