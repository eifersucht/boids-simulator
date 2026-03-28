// js/main.js

import '../css/style.css';
import { initScene, onWindowResize, scene, camera, renderer } from './submodule/sceneSetup.js';
import { CONFIG } from './config.js';
import { initBirds, birdMeshes, updateLeader, updatePredators, leaderPosition, getActivePredatorPositions, updatePerformanceHUD } from './submodule/birdSystem.js';
import { driftUniformUpdater } from './submodule/renderUtils.js';
import { initComputeRenderer, createComputeSystem, gpu_allocation, position_variable, uniform_position, uniform_velocity, currentResolution } from './submodule/GPUComputeSystem.js';
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
const perfWindowSize = 180;
const perfSamples = [];
let extraFlock = null;

function ensureInterpolationState(readbackStride) {
    const boidCount = birdMeshes.length;
    const expectedLength = boidCount * 3;
    if (!render.interpPrev || render.interpPrev.length !== expectedLength) {
        render.interpPrev = new Float32Array(expectedLength);
        render.interpTarget = new Float32Array(expectedLength);
        render.interpCurrent = new Float32Array(expectedLength);
        for (let i = 0; i < boidCount; i++) {
            const i3 = i * 3;
            const p = birdMeshes[i].position;
            render.interpPrev[i3] = p.x;
            render.interpPrev[i3 + 1] = p.y;
            render.interpPrev[i3 + 2] = p.z;
            render.interpTarget[i3] = p.x;
            render.interpTarget[i3 + 1] = p.y;
            render.interpTarget[i3 + 2] = p.z;
            render.interpCurrent[i3] = p.x;
            render.interpCurrent[i3 + 1] = p.y;
            render.interpCurrent[i3 + 2] = p.z;
        }
        render.interpFrame = 0;
        render.interpTotal = Math.max(1, readbackStride);
    }
}

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
    window.addEventListener('extraFlockChange', onExtraFlockChange);
    return true;
}

function createExtraFlock(config) {
    const count = Math.max(16, Math.floor(config.count || 1024));
    const resolution = Math.ceil(Math.sqrt(count));
    const system = createComputeSystem(renderer, resolution, bounds);
    system.uniform_velocity.boidSpeed.value = Math.max(0.1, config.speed || 1.0);
    const geometry = new THREE.SphereGeometry(Math.max(0.5, config.size || 2.5), 8, 8);
    const material = new THREE.MeshLambertMaterial({ color: config.color || '#1e293b' });
    const meshes = [];
    for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(geometry, material);
        m.matrixAutoUpdate = true;
        scene.add(m);
        meshes.push(m);
    }
    extraFlock = {
        enabled: true,
        count,
        resolution,
        system,
        meshes,
        geometry,
        material,
        frameCount: 0,
        readPixelsBuffer: null
    };
}

function removeExtraFlock() {
    if (!extraFlock) return;
    for (let i = 0; i < extraFlock.meshes.length; i++) {
        scene.remove(extraFlock.meshes[i]);
    }
    extraFlock.geometry.dispose();
    extraFlock.material.dispose();
    extraFlock = null;
}

function updateExtraFlockConfig(config) {
    if (!extraFlock) return;
    extraFlock.system.uniform_velocity.boidSpeed.value = Math.max(0.1, config.speed || 1.0);
    extraFlock.material.color.set(config.color || '#1e293b');
    const nextSize = Math.max(0.5, config.size || 2.5);
    if (Math.abs(nextSize - extraFlock.geometry.parameters.radius) > 1e-6) {
        const nextGeometry = new THREE.SphereGeometry(nextSize, 8, 8);
        for (let i = 0; i < extraFlock.meshes.length; i++) {
            extraFlock.meshes[i].geometry = nextGeometry;
        }
        extraFlock.geometry.dispose();
        extraFlock.geometry = nextGeometry;
    }
}

function onExtraFlockChange(event) {
    const cfg = event.detail || {};
    if (!cfg.enabled) {
        removeExtraFlock();
        return;
    }
    const targetCount = Math.max(16, Math.floor(cfg.count || 1024));
    if (!extraFlock) {
        createExtraFlock(cfg);
        return;
    }
    if (extraFlock.count !== targetCount) {
        removeExtraFlock();
        createExtraFlock(cfg);
        return;
    }
    updateExtraFlockConfig(cfg);
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
    let readbackMs = 0;
    let meshSyncMs = 0;
    let didReadback = false;

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
        didReadback = true;
        const width = currentResolution;
        const height = currentResolution;
        if (!render.readPixelsBuffer || render.readPixelsBuffer.length !== width * height * 4) {
            render.readPixelsBuffer = new Float32Array(width * height * 4);
        }
        const readPixels = render.readPixelsBuffer;
        const readbackStart = performance.now();
        renderer.readRenderTargetPixels(
            gpu_allocation.getCurrentRenderTarget(position_variable),
            0, 0, width, height,
            readPixels
        );
        readbackMs = performance.now() - readbackStart;
        const meshSyncStart = performance.now();
        ensureInterpolationState(readbackStride);
        render.interpTotal = Math.max(1, readbackStride);
        render.interpFrame = 0;

        for (let i = 0; i < birdMeshes.length; i++) {
            const i4 = i * 4;
            const i3 = i * 3;
            const x = readPixels[i4];
            const y = readPixels[i4 + 1];
            const z = readPixels[i4 + 2];
            render.interpPrev[i3] = render.interpCurrent[i3];
            render.interpPrev[i3 + 1] = render.interpCurrent[i3 + 1];
            render.interpPrev[i3 + 2] = render.interpCurrent[i3 + 2];
            render.interpTarget[i3] = x;
            render.interpTarget[i3 + 1] = y;
            render.interpTarget[i3 + 2] = z;
        }

        // In quality mode (stride 1), keep exact original behavior.
        if (render.interpTotal === 1) {
            for (let i = 0; i < birdMeshes.length; i++) {
                const i3 = i * 3;
                const x = render.interpTarget[i3];
                const y = render.interpTarget[i3 + 1];
                const z = render.interpTarget[i3 + 2];
                render.interpCurrent[i3] = x;
                render.interpCurrent[i3 + 1] = y;
                render.interpCurrent[i3 + 2] = z;
                birdMeshes[i].position.set(x, y, z);
            }
        }
        meshSyncMs = performance.now() - meshSyncStart;
    }

    // Smooth mesh motion between GPU readbacks when stride > 1.
    if (!didReadback && readbackStride > 1 && render.interpPrev && render.interpTarget) {
        const meshSyncStart = performance.now();
        render.interpFrame = Math.min(render.interpFrame + 1, render.interpTotal);
        const t = render.interpFrame / render.interpTotal;
        for (let i = 0; i < birdMeshes.length; i++) {
            const i3 = i * 3;
            const x = render.interpPrev[i3] + (render.interpTarget[i3] - render.interpPrev[i3]) * t;
            const y = render.interpPrev[i3 + 1] + (render.interpTarget[i3 + 1] - render.interpPrev[i3 + 1]) * t;
            const z = render.interpPrev[i3 + 2] + (render.interpTarget[i3 + 2] - render.interpPrev[i3 + 2]) * t;
            render.interpCurrent[i3] = x;
            render.interpCurrent[i3 + 1] = y;
            render.interpCurrent[i3 + 2] = z;
            birdMeshes[i].position.set(x, y, z);
        }
        meshSyncMs = performance.now() - meshSyncStart;
    }

    perfSamples.push({
        fps,
        frameMs,
        readbackMs,
        meshSyncMs,
        didReadback
    });
    if (perfSamples.length > perfWindowSize) perfSamples.shift();
    const totalSamples = perfSamples.length;
    const readbackSamples = perfSamples.filter((sample) => sample.didReadback);
    const avg = (arr, key) => (arr.length ? arr.reduce((acc, v) => acc + v[key], 0) / arr.length : 0);
    const avgFps = avg(perfSamples, 'fps');
    const avgFrameMs = avg(perfSamples, 'frameMs');
    const avgReadbackMs = avg(readbackSamples, 'readbackMs');
    const avgMeshSyncMs = avg(readbackSamples, 'meshSyncMs');
    const readbackRatio = totalSamples ? readbackSamples.length / totalSamples : 0;
    updatePerformanceHUD(fps, frameMs, {
        avgFps,
        avgFrameMs,
        avgReadbackMs,
        avgMeshSyncMs,
        readbackRatio
    });

    // Render scene with the main camera.
    if (extraFlock) {
        extraFlock.frameCount += 1;
        const system = extraFlock.system;
        system.uniform_position.clock.value = now;
        system.uniform_position.del_change.value = delta;
        system.uniform_velocity.clock.value = now;
        system.uniform_velocity.del_change.value = delta;
        driftUniformUpdater(system.uniform_velocity, now);
        syncBoidUniforms({
            uniformVelocity: system.uniform_velocity,
            activePredators: getActivePredatorPositions(),
            leaderPosition
        });
        system.gpu_allocation.compute();
        if (!extraFlock.readPixelsBuffer || extraFlock.readPixelsBuffer.length !== extraFlock.resolution * extraFlock.resolution * 4) {
            extraFlock.readPixelsBuffer = new Float32Array(extraFlock.resolution * extraFlock.resolution * 4);
        }
        renderer.readRenderTargetPixels(
            system.gpu_allocation.getCurrentRenderTarget(system.position_variable),
            0, 0, extraFlock.resolution, extraFlock.resolution,
            extraFlock.readPixelsBuffer
        );
        for (let i = 0; i < extraFlock.meshes.length; i++) {
            const x = extraFlock.readPixelsBuffer[i * 4];
            const y = extraFlock.readPixelsBuffer[i * 4 + 1];
            const z = extraFlock.readPixelsBuffer[i * 4 + 2];
            extraFlock.meshes[i].position.set(x, y, z);
        }
    }
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
