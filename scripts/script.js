// Zoek alle elementen met de klas 'sync-scroll'
let containers = document.querySelectorAll('.sync-scroll');
let leider = null;

function scrollAlleVakken(gebeurtenis) {
    let hetGekozenVak = gebeurtenis.target;

    if (leider !== null && leider !== hetGekozenVak) {
        return;
    }
    
    // Dit vak is nu de main
    leider = hetGekozenVak;
    let afstandLinks = leider.scrollLeft;

    // Loop door alle vakken heen
    containers.forEach(function(vak) {
        // Als het vak niet de scroller is, zet hem op dezelfde afstand
        if (vak !== leider) {
            vak.scrollLeft = afstandLinks;
        }
    });
}

// reset als je stopt met scroller
function stopMetScrollen() {
    leider = null;
}

containers.forEach(function(vak) {

    vak.addEventListener('pointerdown', function() {
        leider = vak;
    });

    vak.addEventListener('scroll', scrollAlleVakken);
});

window.addEventListener('pointerup', stopMetScrollen);