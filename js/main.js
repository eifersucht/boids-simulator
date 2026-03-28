// js/main.js

import '../css/style.css';
import { initScene, onWindowResize, scene, camera, renderer } from './submodule/sceneSetup.js';
import { CONFIG } from './config.js';
import { initBirds, birdMeshes, updateLeader, updatePredators, leaderPosition, getActivePredatorPositions, updatePerformanceHUD } from './submodule/birdSystem.js';
import { driftUniformUpdater } from './submodule/renderUtils.js';
import { initComputeRenderer, gpu_allocation, position_variable, uniform_position, uniform_velocity, currentResolution } from './submodule/GPUComputeSystem.js';
import { initRecording, createRecordingButton, onRecordingKeyDown, isRecordingActive } from './submodule/recording.js';
import { syncBoidUniforms } from './submodule/uniformSync.js';

// Resolve initial boid count from URL hash or default value.
const hash = document.location.hash.substr(1);
const defaultGridSize = CONFIG.simulation?.defaultGridSize ?? CONFIG.defaultGridSize ?? 64;
const hashValue = hash ? parseInt(hash, 10) : defaultGridSize;
const normalizedHash = Number.isFinite(hashValue) && hashValue > 0 ? hashValue : defaultGridSize;
const initialBoidsCount = normalizedHash * normalizedHash;
// Show initial count in the boids label element.
const birdsLabel = document.getElementById('birds');
if (birdsLabel) birdsLabel.innerText = initialBoidsCount;

// Compute initial GPU texture resolution (square texture containing all boids).
const initialResolution = Math.ceil(Math.sqrt(initialBoidsCount));

let last = performance.now();
const bounds = CONFIG.simulation?.bounds ?? CONFIG.bounds ?? 600;
let frameCount = 0;
let smoothedDelta = 1 / 60;

if (!Detector.webgl) {
    Detector.addGetWebGLMessage();
} else {
    const started = init();
    if (started) animate();
}

function init() {
    // Initialize base 3D scene.
    initScene();
    // Initialize GPU computation system for boid simulation.
    try {
        initComputeRenderer(renderer, initialResolution, bounds);
    } catch (error) {
        console.error('Could not initialize GPU simulation:', error);
        const birdsInfo = document.getElementById('birds');
        if (birdsInfo) {
            birdsInfo.innerText = 'GPU simulation unavailable on this device/browser.';
        }
        return false;
    }
    initRecording(renderer, CONFIG.recording.fps);

    uniform_velocity.boidSpeed.value = CONFIG.boids.speedDefault;
    // Initialize boids, leader, and predators in the scene.
    initBirds(scene, renderer);
    // Create recording start/stop button.
    createRecordingButton();
    // Register keyboard events for recording ('v' start, 's' stop).
    document.addEventListener('keydown', onKeyDown, false);
    window.addEventListener('resize', onWindowResize, false);
    return true;
}

function animate() {
    requestAnimationFrame(animate);
    render();
}

function render() {
    frameCount += 1;
    const now = performance.now();
    // Compute delta time from previous frame in seconds.
    let delta = (now - last) / 1000;
    const maxDeltaSeconds = CONFIG.simulation?.maxDeltaSeconds ?? CONFIG.maxDeltaSeconds ?? 1;
    if (delta > maxDeltaSeconds) delta = maxDeltaSeconds;  // Clamp delta to avoid large jumps.
    last = now;
    smoothedDelta = smoothedDelta * 0.9 + delta * 0.1;
    const fps = 1 / Math.max(smoothedDelta, 1e-6);
    const frameMs = delta * 1000;
    updatePerformanceHUD(fps, frameMs);

    // Update time uniforms in position/velocity shaders.
    uniform_position.clock.value = now;
    uniform_position.del_change.value = delta;
    uniform_velocity.clock.value = now;
    uniform_velocity.del_change.value = delta;

    // Update global drift (wind) applied to boid velocities.
    driftUniformUpdater(uniform_velocity, now);

    // Update leader and predator state.
    updateLeader(delta);
    updatePredators(delta);

    // Sync predator/leader uniforms for boid shaders.
    syncBoidUniforms({
        uniformVelocity: uniform_velocity,
        activePredators: getActivePredatorPositions(),
        leaderPosition
    });

    // Run GPU computation to get new boid positions and velocities.
    gpu_allocation.compute();

    // Read computed boid positions from GPU position texture.
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
        // Update each boid mesh position in scene using readback data.
        for (let i = 0; i < birdMeshes.length; i++) {
            const x = readPixels[i * 4];
            const y = readPixels[i * 4 + 1];
            const z = readPixels[i * 4 + 2];
            birdMeshes[i].position.set(x, y, z);
        }
    }

    // Render scene with the main camera.
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
