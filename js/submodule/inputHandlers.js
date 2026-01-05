// js/submodule/inputHandlers.js
let mouseX = 0;
let mouseY = 0;

let halfWindowX = window.innerWidth / 2;
let halfWindowY = window.innerHeight / 2;

function updateWindowSize() {
    halfWindowX = window.innerWidth / 2;
    halfWindowY = window.innerHeight / 2;
}

function onDocumentMouseMove(event) {
    mouseX = event.clientX - halfWindowX;
    mouseY = event.clientY - halfWindowY;
}

function onDocumentTouchStart(event) {
    if (event.touches.length === 1) {
        event.preventDefault();
        mouseX = event.touches[0].pageX - halfWindowX;
        mouseY = event.touches[0].pageY - halfWindowY;
    }
}

function onDocumentTouchMove(event) {
    if (event.touches.length === 1) {
        event.preventDefault();
        mouseX = event.touches[0].pageX - halfWindowX;
        mouseY = event.touches[0].pageY - halfWindowY;
    }
}

export {
    mouseX,
    mouseY,
    updateWindowSize,
    onDocumentMouseMove,
    onDocumentTouchStart,
    onDocumentTouchMove
};
