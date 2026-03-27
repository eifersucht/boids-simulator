let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = 0;
let recordingTimerInterval = null;
let rendererRef = null;
let recordingFps = 60;

function initRecording(renderer, fps) {
    rendererRef = renderer;
    recordingFps = fps;
}

function startRecording() {
    if (!rendererRef) return;
    if (mediaRecorder && mediaRecorder.state === 'recording') return;
    recordedChunks = [];
    if (!window.MediaRecorder) {
        alert('MediaRecorder no esta disponible en este navegador.');
        return;
    }
    const stream = rendererRef.domElement.captureStream(recordingFps);
    const options = {};
    if (MediaRecorder.isTypeSupported) {
        if (MediaRecorder.isTypeSupported('video/webm; codecs=vp8')) {
            options.mimeType = 'video/webm; codecs=vp8';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
            options.mimeType = 'video/webm';
        }
    }
    try {
        mediaRecorder = new MediaRecorder(stream, options);
    } catch (error) {
        console.error('No se pudo iniciar MediaRecorder:', error);
        alert('No se pudo iniciar la grabacion en este navegador.');
        return;
    }
    mediaRecorder.ondataavailable = function(event) {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };
    mediaRecorder.onstop = function() {
        clearInterval(recordingTimerInterval);
        updateRecordingUI(false);
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'bandada-alpha.webm';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    };
    mediaRecorder.start();
    recordingStartTime = Date.now();
    recordingTimerInterval = setInterval(updateRecordingTime, 1000);
    updateRecordingUI(true);
    console.log('Grabacion iniciada');
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        console.log('Grabacion detenida');
    }
}

function createRecordingButton() {
    const container = document.createElement('div');
    container.id = 'recordingContainer';

    const button = document.createElement('button');
    button.id = 'startStopRecording';
    button.innerText = 'Grabar';

    button.onclick = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const recordingInfo = document.createElement('div');
    recordingInfo.id = 'recordingInfo';

    container.appendChild(button);
    container.appendChild(recordingInfo);
    document.body.appendChild(container);
}

function updateRecordingUI(isRecording) {
    const button = document.getElementById('startStopRecording');
    const info = document.getElementById('recordingInfo');
    if (!button || !info) return;
    if (isRecording) {
        button.innerHTML = 'Grabando...';
        info.innerText = 'Duracion: 00:00';
    } else {
        button.innerHTML = 'Grabar';
        info.innerText = '';
    }
}

function updateRecordingTime() {
    const info = document.getElementById('recordingInfo');
    if (!info) return;
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    info.innerText = `Duracion: ${minutes}:${seconds}`;
}

function onRecordingKeyDown(event) {
    if (event.key === 'v' || event.key === 'V') {
        startRecording();
    } else if (event.key === 's' || event.key === 'S') {
        stopRecording();
    }
}

function isRecordingActive() {
    return !!(mediaRecorder && mediaRecorder.state === 'recording');
}

export {
    initRecording,
    startRecording,
    stopRecording,
    createRecordingButton,
    onRecordingKeyDown,
    isRecordingActive
};
