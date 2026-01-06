const overlay = document.querySelector('.overlay')
const details = document.querySelector('.onscreen')
const closeBtn = document.querySelector('.closebtn')

closeBtn.addEventListener('click', closeModalHandler)

function closeModalHandler () {
    details.classList.toggle('onscreen')
    overlay.classList.toggle('overlay')
}

console.log(overlay);