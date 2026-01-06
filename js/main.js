// js/main.js

import { initScene, onWindowResize, scene, camera, renderer } from './submodule/sceneSetup.js';
import { CONFIG } from './config.js';
import { initBirds, birdMeshes, leaderMesh, predatorMesh, updateLeader, updatePredator, leaderPosition, leaderVelocity, leaderAcceleration, predatorPosition, predatorVelocity } from './submodule/birdSystem.js';
import { driftUniformUpdater } from './submodule/renderUtils.js';
import { initComputeRenderer, gpu_allocation, velocity_variable, position_variable, uniform_position, uniform_velocity, currentResolution } from './submodule/GPUComputeSystem.js';

if (!Detector.webgl) Detector.addGetWebGLMessage();

// Determinar la cantidad inicial de boids (desde hash de URL o input de interfaz si existe)
let initialBoidsCount;
const countInputElement = document.getElementById('boidCount');
if (countInputElement) {
    // Si hay un input para la cantidad de boids, usar su valor inicial
    const parsedCount = parseInt(countInputElement.value, 10);
    const fallbackCount = CONFIG.defaultGridSize * CONFIG.defaultGridSize;
    initialBoidsCount = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : fallbackCount;
} else {
    // Si no, usar el valor en la URL (hash) o el predeterminado 64*64
    const hash = document.location.hash.substr(1);
    const hashValue = hash ? parseInt(hash, 10) : CONFIG.defaultGridSize;
    const normalizedHash = Number.isFinite(hashValue) && hashValue > 0 ? hashValue : CONFIG.defaultGridSize;
    initialBoidsCount = normalizedHash * normalizedHash;
}
// Mostrar la cantidad inicial en el elemento indicador de boids
const birdsLabel = document.getElementById('birds');
if (birdsLabel) birdsLabel.innerText = initialBoidsCount;

// Calcular la resolución inicial para el GPUComputeRenderer (textura cuadrada que contenga a todos los boids)
const initialResolution = Math.ceil(Math.sqrt(initialBoidsCount));

let last = performance.now();
const bounds = CONFIG.bounds;

init();
animate();

function init() {
    // Inicializar la escena 3D básica
    initScene();
    // Inicializar el sistema de computación GPU para la simulación de boids
    initComputeRenderer(renderer, initialResolution, bounds);

    uniform_velocity.boidSpeed.value = CONFIG.boids.speedDefault;
    // Inicializar boids, líder y depredador en la escena, pasándole el renderer para gestión dinámica
    initBirds(scene, renderer);
    // Crear botón para iniciar/detener grabación de vídeo
    createRecordingButton();
    // Registrar eventos de teclado para grabación (tecla 'v' para iniciar, 's' para detener)
    document.addEventListener('keydown', onKeyDown, false);
    window.addEventListener('resize', onWindowResize, false);
}

function animate() {
    requestAnimationFrame(animate);
    render();
}

function render() {
    const now = performance.now();
    // Calcular intervalo de tiempo (delta) desde el último frame en segundos
    let delta = (now - last) / 1000;
    if (delta > CONFIG.maxDeltaSeconds) delta = CONFIG.maxDeltaSeconds;  // Limitar delta para evitar saltos bruscos
    last = now;

    // Actualizar uniformes de tiempo en shaders de posición y velocidad de boids
    uniform_position.clock.value = now;
    uniform_position.del_change.value = delta;
    uniform_velocity.clock.value = now;
    uniform_velocity.del_change.value = delta;

    // Actualizar desvío (viento) global en las velocidades de boids
    driftUniformUpdater(uniform_velocity, now);

    // Actualizar posición y estado del líder y depredador
    updateLeader(delta);
    updatePredator(delta);

    // Actualizar uniformes de posición del depredador y estado del líder para los shaders de boids
    uniform_velocity.predator.value.copy(predatorPosition).divideScalar(bounds);
    uniform_velocity.leader.value.copy(leaderPosition);
    uniform_velocity.leaderVelocity.value.copy(leaderVelocity);
    uniform_velocity.leaderAcceleration.value.copy(leaderAcceleration);

    // Calcular fuerzas de frenado y giro del líder para pasarlas a los shaders
    let brakingForce = 0.0;
    const leaderSpeed = leaderVelocity.length();
    if (leaderSpeed > 0) {
        const accelAlongVelocity = leaderAcceleration.dot(leaderVelocity) / leaderSpeed;
        brakingForce = Math.max(0.0, -accelAlongVelocity);
    }
    const turningForce = Math.max(0.0, leaderAcceleration.length());
    uniform_velocity.leaderBrakingForce.value = brakingForce;
    uniform_velocity.leaderTurningForce.value = turningForce;

    // Ejecutar la computación GPU para obtener nuevas posiciones y velocidades de boids
    gpu_allocation.compute();

    // Leer las posiciones calculadas de los boids desde la textura de posición GPU
    const width = currentResolution;
    const height = currentResolution;
    if (!render.readPixelsBuffer || render.readPixelsBuffer.length !== width * height * 4) {
        render.readPixelsBuffer = new Float32Array(width * height * 4);
    }
    const readPixels = render.readPixelsBuffer;
    renderer.readRenderTargetPixels(
        gpu_allocation.getCurrentRenderTarget(position_variable),
        0, 0, width, height,
        readPixels
    );
    // Actualizar la posición de cada boid en la escena utilizando los datos leídos
    for (let i = 0; i < birdMeshes.length; i++) {
        const x = readPixels[i * 4];
        const y = readPixels[i * 4 + 1];
        const z = readPixels[i * 4 + 2];
        birdMeshes[i].position.set(x, y, z);
    }

    // Renderizar la escena con la cámara principal
    renderer.render(scene, camera);
}

// -------------------- Grabación de Vídeo --------------------

let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = 0;
let recordingTimerInterval = null;

function startRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') return;
    recordedChunks = [];
    if (!window.MediaRecorder) {
        alert('MediaRecorder no esta disponible en este navegador.');
        return;
    }
    // Capturar la salida del canvas como stream de vídeo a 60 FPS
    const stream = renderer.domElement.captureStream(CONFIG.recording.fps);
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
        // Al detener, descargar el vídeo grabado
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
    container.style.position = 'fixed';
    container.style.top = '10px';
    container.style.right = '10px';
    container.style.zIndex = '10000';
    container.style.textAlign = 'right';

    const button = document.createElement('button');
    button.id = 'startStopRecording';
    button.innerText = 'Grabar';
    button.style.padding = '10px 20px';
    container.style.background = 'white';
    container.style.color = 'black';
    container.style.border = '1px solid black';
    button.style.fontSize = '16px';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';
    button.style.marginBottom = '5px';

    button.onclick = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const recordingInfo = document.createElement('div');
    recordingInfo.id = 'recordingInfo';
    recordingInfo.style.color = 'black';
    recordingInfo.style.fontSize = '14px';
    recordingInfo.style.marginTop = '4px';

    container.appendChild(button);
    container.appendChild(recordingInfo);
    document.body.appendChild(container);
}

function updateRecordingUI(isRecording) {
    const button = document.getElementById('startStopRecording');
    const info = document.getElementById('recordingInfo');
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

function onKeyDown(event) {
    const target = event.target;
    if (
        target &&
        (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable)
    ) {
        return;
    }
    // Tecla 'v' para iniciar grabación, 's' para detener
    if (event.key === 'v' || event.key === 'V') {
        startRecording();
    } else if (event.key === 's' || event.key === 'S') {
        stopRecording();
    }
}
