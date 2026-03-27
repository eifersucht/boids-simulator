// js/main.js

import { initScene, onWindowResize, scene, camera, renderer } from './submodule/sceneSetup.js';
import { CONFIG } from './config.js';
import { initBirds, birdMeshes, updateLeader, updatePredators, leaderPosition, getActivePredatorPositions } from './submodule/birdSystem.js';
import { driftUniformUpdater } from './submodule/renderUtils.js';
import { initComputeRenderer, gpu_allocation, position_variable, uniform_position, uniform_velocity, currentResolution } from './submodule/GPUComputeSystem.js';
import { initRecording, createRecordingButton, onRecordingKeyDown, isRecordingActive } from './submodule/recording.js';
import { syncBoidUniforms } from './submodule/uniformSync.js';

if (!Detector.webgl) Detector.addGetWebGLMessage();

// Determinar la cantidad inicial de boids desde el hash de URL o el valor por defecto.
const hash = document.location.hash.substr(1);
const hashValue = hash ? parseInt(hash, 10) : CONFIG.simulation.defaultGridSize;
const normalizedHash = Number.isFinite(hashValue) && hashValue > 0 ? hashValue : CONFIG.simulation.defaultGridSize;
const initialBoidsCount = normalizedHash * normalizedHash;
// Mostrar la cantidad inicial en el elemento indicador de boids
const birdsLabel = document.getElementById('birds');
if (birdsLabel) birdsLabel.innerText = initialBoidsCount;

// Calcular la resolución inicial para el GPUComputeRenderer (textura cuadrada que contenga a todos los boids)
const initialResolution = Math.ceil(Math.sqrt(initialBoidsCount));

let last = performance.now();
const bounds = CONFIG.simulation.bounds;
let frameCount = 0;

init();
animate();

function init() {
    // Inicializar la escena 3D básica
    initScene();
    // Inicializar el sistema de computación GPU para la simulación de boids
    initComputeRenderer(renderer, initialResolution, bounds);
    initRecording(renderer, CONFIG.recording.fps);

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
    frameCount += 1;
    const now = performance.now();
    // Calcular intervalo de tiempo (delta) desde el último frame en segundos
    let delta = (now - last) / 1000;
    if (delta > CONFIG.simulation.maxDeltaSeconds) delta = CONFIG.simulation.maxDeltaSeconds;  // Limitar delta para evitar saltos bruscos
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
    updatePredators(delta);

    // Actualizar uniformes de posición del depredador y estado del líder para los shaders de boids
    syncBoidUniforms({
        uniformVelocity: uniform_velocity,
        activePredators: getActivePredatorPositions(),
        bounds,
        leaderPosition
    });

    // Ejecutar la computación GPU para obtener nuevas posiciones y velocidades de boids
    gpu_allocation.compute();

    // Leer las posiciones calculadas de los boids desde la textura de posición GPU
    const optimizationEnabled = !!CONFIG.performance?.readbackOptimizationEnabled;
    const configuredStride = Math.max(1, Math.floor(CONFIG.performance?.readbackStride || 1));
    const stride = optimizationEnabled ? configuredStride : 1;
    const readbackStride = isRecordingActive() ? 1 : stride;
    const shouldReadback = frameCount === 1 || frameCount % readbackStride === 0;

    if (shouldReadback) {
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
    }

    // Renderizar la escena con la cámara principal
    renderer.render(scene, camera);
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
    onRecordingKeyDown(event);
}
