// js/main.js

import { initScene, scene, camera, renderer } from './submodule/sceneSetup.js';
import { initBirds, birdMeshes, leaderMesh, predatorMesh, updateLeader, updatePredator, leaderPosition, leaderVelocity, leaderAcceleration, predatorPosition, predatorVelocity } from './submodule/birdSystem.js';
import { driftUniformUpdater } from './submodule/renderUtils.js';
import { initComputeRenderer, gpu_allocation, velocity_variable, position_variable, uniform_position, uniform_velocity, currentResolution } from './submodule/GPUComputeSystem.js';

if (!Detector.webgl) Detector.addGetWebGLMessage();

// Determinar la cantidad inicial de boids (desde hash de URL o input de interfaz si existe)
let initialBoidsCount;
const countInputElement = document.getElementById('boidCount');
if (countInputElement) {
    // Si hay un input para la cantidad de boids, usar su valor inicial
    initialBoidsCount = parseInt(countInputElement.value) || (64 * 64);
} else {
    // Si no, usar el valor en la URL (hash) o el predeterminado 64*64
    const hash = document.location.hash.substr(1);
    const hashValue = hash ? parseInt(hash, 0) : 64;
    initialBoidsCount = hashValue * hashValue;
}
// Mostrar la cantidad inicial en el elemento indicador de boids
document.getElementById('birds').innerText = initialBoidsCount;

// Calcular la resolución inicial para el GPUComputeRenderer (textura cuadrada que contenga a todos los boids)
const initialResolution = Math.ceil(Math.sqrt(initialBoidsCount));

let last = performance.now();
const bounds = 600;

init();
animate();

function init() {
    // Inicializar la escena 3D básica
    initScene();
    // Inicializar el sistema de computación GPU para la simulación de boids
    initComputeRenderer(renderer, initialResolution, bounds);

    uniform_velocity.boidSpeed.value = 1.0;
    // Inicializar boids, líder y depredador en la escena, pasándole el renderer para gestión dinámica
    initBirds(scene, renderer);
    // Crear botón para iniciar/detener grabación de vídeo
    createRecordingButton();
    // Registrar eventos de teclado para grabación (tecla 'v' para iniciar, 's' para detener)
    document.addEventListener('keydown', onKeyDown, false);
}

function animate() {
    requestAnimationFrame(animate);
    render();
}

function render() {
    const now = performance.now();
    // Calcular intervalo de tiempo (delta) desde el último frame en segundos
    let delta = (now - last) / 1000;
    if (delta > 1) delta = 1;  // Limitar delta para evitar saltos bruscos
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
    const brakingForce = Math.max(0.0, -leaderAcceleration.length());
    const turningForce = Math.max(0.0, Math.abs(leaderAcceleration.length()));
    uniform_velocity.leaderBrakingForce.value = brakingForce;
    uniform_velocity.leaderTurningForce.value = turningForce;

    // Ejecutar la computación GPU para obtener nuevas posiciones y velocidades de boids
    gpu_allocation.compute();

    // Leer las posiciones calculadas de los boids desde la textura de posición GPU
    const width = currentResolution;
    const height = currentResolution;
    const readPixels = new Float32Array(width * height * 4);
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
    // Capturar la salida del canvas como stream de vídeo a 60 FPS
    const stream = renderer.domElement.captureStream(60);
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8' });
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
    console.log('🎥 Grabación iniciada');
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        console.log('🛑 Grabación detenida');
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
    button.innerText = '🎥 Grabar';
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
    recordingInfo.style.color = 'white';
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
        button.innerHTML = '🔴 Grabando...';
        info.innerText = 'Duración: 00:00';
    } else {
        button.innerHTML = '🎥 Grabar';
        info.innerText = '';
    }
}

function updateRecordingTime() {
    const info = document.getElementById('recordingInfo');
    if (!info) return;
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    info.innerText = `Duración: ${minutes}:${seconds}`;
}

function onKeyDown(event) {
    // Tecla 'v' para iniciar grabación, 's' para detener
    if (event.key === 'v' || event.key === 'V') {
        startRecording();
    } else if (event.key === 's' || event.key === 'S') {
        stopRecording();
    }
}
