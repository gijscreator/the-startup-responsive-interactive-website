const overlay = document.querySelector('.overlay')
const details = document.querySelector('.onscreen')
const closeBtn = document.querySelector('.closebtn')
const stationCard = document.querySelector('.veronica')

closeBtn.addEventListener('click', ModalHandler)
stationCard.addEventListener('click', ModalHandler)

function ModalHandler () {
    details.classList.toggle('onscreen')
    overlay.classList.toggle('overlay')
    details.classList.toggle('hidden')
}

console.log(overlay);