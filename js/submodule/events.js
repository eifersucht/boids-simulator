// js/submodule/events.js
import {
    onDocumentMouseMove,
    onDocumentTouchStart,
    onDocumentTouchMove,
    updateWindowSize
} from './inputHandlers.js';

function registerEventListeners() {
    document.addEventListener('mousemove', onDocumentMouseMove, false);
    document.addEventListener('touchstart', onDocumentTouchStart, false);
    document.addEventListener('touchmove', onDocumentTouchMove, false);
    window.addEventListener('resize', updateWindowSize, false);
}

export {
    registerEventListeners
};
