// js/submodule/birdSystem.js

// Import GPU compute system and required shaders
import { CONFIG } from '../config.js';
import { uniform_velocity } from './GPUComputeSystem.js';

// Global arrays/objects for boids, leader, and predators
let birdMeshes = [];
let leaderMesh;

// Leader and predator position/velocity vectors
let leaderPosition;
let leaderVelocity;
let leaderAcceleration;
let leaderTargetDirection;
let predatorMeshes = [];
let predatorPositions = [];
let predatorVelocities = [];
let predatorConfigs = [];

// Internal timers for direction changes
let leaderChangeTimer = 0;
let predatorChangeTimers = [];

// Simulation state parameters
let leaderSpeedMultiplier = 1.0;    // Leader speed multiplier
let leaderVisible = false;         // Leader visibility (initially hidden)
let boidSpeedMultiplier = CONFIG.boids.speedDefault;   // Global boid speed multiplier

// Movement limit (simulation box)
const bounds = CONFIG.simulation?.bounds ?? CONFIG.bounds ?? 600;

// Shared geometry and material for boids
let boidGeometry;
let boidMaterial;
let currentBoidSize = CONFIG.boids.sizeDefault;  // Current boid size (radius)

// Scene/renderer refs for dynamic boid changes
let rendererRef;
let hudElements = null;

/**
  * Initialize simulation entities (boids, leader, predators) and event handlers.
  * @param {THREE.Scene} scene - Three.js scene where objects are added.
  * @param {THREE.WebGLRenderer} renderer - Renderer needed for dynamic GPU operations.
 */
function initBirds(scene, renderer) {
    // Store scene/renderer references for later use
    rendererRef = renderer;

    // Resolve initial boid color.
    const initialColor = new THREE.Color(0x111111);

    // Create boid geometry/material reused by all boids
    boidGeometry = new THREE.SphereGeometry(currentBoidSize, 8, 8);
    boidMaterial = new THREE.MeshLambertMaterial({ color: initialColor });

    // Get initial boid count from 'birds' label (set in main.js)
    const initialBoids = parseInt(document.getElementById('birds')?.innerText) || (64 * 64);
    // Create initial boid meshes and add them to scene
    for (let i = 0; i < initialBoids; i++) {
        const boidMesh = new THREE.Mesh(boidGeometry, boidMaterial);
        boidMesh.matrixAutoUpdate = true;
        scene.add(boidMesh);
        birdMeshes.push(boidMesh);
    }

    // Create leader (red box) and add to scene
    const leaderGeometry = new THREE.BoxGeometry(10, 5, 3);
    const leaderMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    leaderMesh = new THREE.Mesh(leaderGeometry, leaderMaterial);
    leaderMesh.matrixAutoUpdate = true;
    scene.add(leaderMesh);
    leaderMesh.visible = false;
    leaderVisible = false;  // Keep leader state aligned with mesh visibility

    // Create predators (orange spheres) and add them to scene
    const predatorGeometry = new THREE.SphereGeometry(8.0, 16, 16);
    const predatorMaterial = new THREE.MeshStandardMaterial({
        color: 0xff8800,
        roughness: 0.5,
        metalness: 0.1,
        transparent: true,
        opacity: 1.0
    });
    const basePredatorConfig = {
        name: 'Predator',
        enabled: true,
        visible: false,
        aggression: 2.0,
        startPosition: { x: 200, y: 0, z: 0 },
        randomVelocityScale: 50,
        noiseScale: { x: 0.2, y: 0.1, z: 0.2 },
        baseSpeed: 100,
        distanceSpeedFactor: 0.5,
        distanceSpeedClamp: 300,
        changeIntervalMin: 2.0,
        changeIntervalJitter: 2.0
    };
    const predatorList = CONFIG.predators && CONFIG.predators.length > 0
        ? CONFIG.predators
        : [basePredatorConfig];
    predatorConfigs = predatorList.map((entry, index) => {
        const cfg = {
            ...basePredatorConfig,
            ...entry,
            name: entry.name || `Predator ${index + 1}`,
            startPosition: { ...basePredatorConfig.startPosition, ...(entry.startPosition || {}) },
            noiseScale: { ...basePredatorConfig.noiseScale, ...(entry.noiseScale || {}) }
        };
        const mesh = new THREE.Mesh(predatorGeometry, predatorMaterial);
        mesh.matrixAutoUpdate = true;
        scene.add(mesh);
        mesh.visible = cfg.visible && cfg.enabled;

        predatorMeshes.push(mesh);
        predatorPositions.push(
            new THREE.Vector3(cfg.startPosition.x, cfg.startPosition.y, cfg.startPosition.z)
        );
        predatorVelocities.push(
            new THREE.Vector3(
                (Math.random() - 0.5) * cfg.randomVelocityScale,
                (Math.random() - 0.5) * cfg.randomVelocityScale,
                (Math.random() - 0.5) * cfg.randomVelocityScale
            )
        );
        predatorChangeTimers.push(0);
        return cfg;
    });

    // Initialize leader and predator state vectors
    leaderPosition = new THREE.Vector3();
    leaderVelocity = new THREE.Vector3(1, 0, 0).normalize().multiplyScalar(CONFIG.leader.speed);
    leaderAcceleration = new THREE.Vector3();
    leaderTargetDirection = new THREE.Vector3(
        (Math.random() - 0.5),
        (Math.random() - 0.5),
        (Math.random() - 0.5)
    ).normalize();

    const hud = document.createElement('div');
    hud.id = 'hud';

    hud.innerHTML = `
    <div>Controls:</div>
    <div>+ / - : Increase / Decrease leader speed</div>
    <div>R : Reset leader speed</div>
    <div>L : Show/Hide leader</div>
    <div>P : Toggle predators</div>
    <hr>
    <div id="speedInfo"></div>
    <div id="boidSpeedInfo"></div>
    <div id="leaderInfo"></div>
    <div id="predatorInfo"></div>
    <div id="performanceInfo"></div>
    <hr>
    <div>
        <label>Boid count:</label><br>
        <input type="number" id="boidCount" value="${birdMeshes.length}" min="1" max="10000">
        <button id="applyBoidCount">Apply changes</button><br><br>

        <label>Background color:</label><br>
        <input type="color" id="bgColor" value="#FFFFFF"><br><br>

        <label>Boid size:</label><br>
        <input type="number" id="boidSize" value="${CONFIG.boids.sizeDefault}" min="1" max="20" step="0.5"><br><br>

        <label>Global boid speed:</label><br>
        <input type="number" id="boidSpeed" value="${CONFIG.boids.speedDefault}" min="0.1" max="10" step="0.1"><br><br>

        <label>Performance mode:</label><br>
        <select id="performancePreset">
            <option value="quality">Quality</option>
            <option value="balanced">Balanced</option>
            <option value="performance">Performance</option>
        </select><br><br>

        <div>Predatores:</div>
        <div id="predatorsPanel"></div>
    </div>
    `;

    document.body.appendChild(hud);
    hudElements = {
        speedInfo: document.getElementById('speedInfo'),
        boidSpeedInfo: document.getElementById('boidSpeedInfo'),
        leaderInfo: document.getElementById('leaderInfo'),
        predatorInfo: document.getElementById('predatorInfo'),
        performanceInfo: document.getElementById('performanceInfo')
    };
    const predatorsPanel = document.getElementById('predatorsPanel');
    if (predatorsPanel) {
        predatorsPanel.innerHTML = '';
        predatorConfigs.forEach((cfg, index) => {
            const row = document.createElement('div');
            row.className = 'predator-row';

            const toggle = document.createElement('input');
            toggle.type = 'checkbox';
            toggle.checked = !!cfg.enabled;
            toggle.id = `predatorToggle_${index}`;

            const label = document.createElement('label');
            label.htmlFor = toggle.id;
            label.innerText = ` ${cfg.name}`;

            const speed = document.createElement('input');
            speed.type = 'number';
            speed.min = '0';
            speed.max = '10';
            speed.step = '0.1';
            speed.value = cfg.aggression.toFixed(1);
            speed.className = 'predator-speed-input';

            toggle.addEventListener('change', (e) => {
                cfg.enabled = e.target.checked;
                cfg.visible = e.target.checked;
                const mesh = predatorMeshes[index];
                if (mesh) mesh.visible = cfg.visible && cfg.enabled;
                updateHUD();
            });

            speed.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (!Number.isFinite(value) || value < 0) return;
                cfg.aggression = value;
                e.target.value = cfg.aggression.toFixed(1);
                updateHUD();
            });

            row.appendChild(toggle);
            row.appendChild(label);
            row.appendChild(speed);
            predatorsPanel.appendChild(row);
        });
    }
    updateHUD();

    // Event handlers for UI inputs
    const bgColorInput = document.getElementById('bgColor');
    if (bgColorInput) {
        bgColorInput.addEventListener('input', (e) => {
            const color = e.target.value;
            document.body.style.backgroundColor = color;
            document.documentElement.style.backgroundColor = color;
            if (rendererRef) {
                rendererRef.setClearColor(color, 1);
                if (rendererRef.domElement) {
                    rendererRef.domElement.style.backgroundColor = color;
                }
            }
        });
    }

    document.getElementById('boidSize').addEventListener('input', (e) => {
        const nuevoTamano = parseFloat(e.target.value);
        cambiarTamanoBoids(nuevoTamano);
    });


    document.getElementById('applyBoidCount').addEventListener('click', () => {
        const nuevoNumero = parseInt(document.getElementById('boidCount').value, 10);
        if (!Number.isFinite(nuevoNumero) || nuevoNumero < 1) {
            alert('Invalid boid count.');
            return;
        }
        const grid = Math.ceil(Math.sqrt(nuevoNumero));
        const appliedBoids = grid * grid;
        const confirmReload = confirm(
            `The browser will reload. Requested: ${nuevoNumero}. Applied (grid ${grid}x${grid}): ${appliedBoids}. Continue?`
        );

        if (confirmReload) {
            ajustarCantidadBoids(appliedBoids);
        }
    });

    document.getElementById('boidSpeed').addEventListener('input', (e) => {
        const nuevaVelocidad = parseFloat(e.target.value);
        if (!isNaN(nuevaVelocidad) && nuevaVelocidad > 0) {
            cambiarVelocidadBoids(nuevaVelocidad);
        }
    });

    const performancePreset = document.getElementById('performancePreset');
    if (performancePreset) {
        const enabled = !!CONFIG.performance?.readbackOptimizationEnabled;
        const stride = Math.max(1, Math.floor(CONFIG.performance?.readbackStride || 1));
        if (!enabled || stride <= 1) {
            performancePreset.value = 'quality';
        } else if (stride === 2) {
            performancePreset.value = 'balanced';
        } else {
            performancePreset.value = 'performance';
        }

        performancePreset.addEventListener('change', (e) => {
            const value = e.target.value;
            if (!CONFIG.performance) {
                CONFIG.performance = { readbackOptimizationEnabled: false, readbackStride: 1 };
            }
            if (value === 'quality') {
                CONFIG.performance.readbackOptimizationEnabled = false;
                CONFIG.performance.readbackStride = 1;
            } else if (value === 'balanced') {
                CONFIG.performance.readbackOptimizationEnabled = true;
                CONFIG.performance.readbackStride = 2;
            } else {
                CONFIG.performance.readbackOptimizationEnabled = true;
                CONFIG.performance.readbackStride = 3;
            }
        });
    }

    // Initialize boid speed input
    document.getElementById('boidSpeed').value = boidSpeedMultiplier.toFixed(1);

    // Initialize background color
    if (bgColorInput) {
        const initialBg = bgColorInput.value;
        document.body.style.backgroundColor = initialBg;
        document.documentElement.style.backgroundColor = initialBg;
        if (rendererRef) {
            rendererRef.setClearColor(initialBg, 1);
            if (rendererRef.domElement) {
                rendererRef.domElement.style.backgroundColor = initialBg;
            }
        }
    }

    // Create HUD show/hide toggle button
    const toggleButton = document.createElement('div');
    toggleButton.id = 'hudToggle';
    toggleButton.innerHTML = '&#9776;'; // icono de "hamburguesa"
    toggleButton.title = 'Show/Hide controls';
    document.body.appendChild(toggleButton);

    // HUD visibility state
    let hudVisible = true;
        toggleButton.addEventListener('click', () => {
            const hudElem = document.getElementById('hud');
            if (hudElem) {
                hudVisible = !hudVisible;
                hudElem.classList.toggle('hidden', !hudVisible);
            }
        });
}

// Update leader movement
function updateLeader(delta) {
    // Decrease leader direction-change timer
    leaderChangeTimer -= delta;
    if (leaderChangeTimer <= 0) {
        // Pick a new random target direction for leader
        leaderTargetDirection = new THREE.Vector3(
            (Math.random() - 0.5) * CONFIG.leader.targetScale.x,
            (Math.random() - 0.5) * CONFIG.leader.targetScale.y,
            (Math.random() - 0.5) * CONFIG.leader.targetScale.z
        ).normalize();
        leaderChangeTimer = CONFIG.leader.changeIntervalMin + Math.random() * CONFIG.leader.changeIntervalJitter;
    }

    // Smoothly steer leader velocity toward target direction
    leaderVelocity.lerp(
        leaderTargetDirection.clone().multiplyScalar(CONFIG.leader.speed),
        delta * CONFIG.leader.turnLerp
    );

    // Compute leader acceleration from velocity delta
    leaderAcceleration.copy(leaderVelocity).sub(leaderMesh.userData.lastVelocity || new THREE.Vector3());
    leaderMesh.userData.lastVelocity = leaderVelocity.clone();

    // Move leader based on velocity and speed multiplier
    leaderPosition.addScaledVector(leaderVelocity, delta * leaderSpeedMultiplier);

    // Bounce at bounds by flipping velocity components
    if (leaderPosition.x > bounds || leaderPosition.x < -bounds) leaderVelocity.x *= -1;
    if (leaderPosition.y > bounds || leaderPosition.y < -bounds) leaderVelocity.y *= -1;
    if (leaderPosition.z > bounds || leaderPosition.z < -bounds) leaderVelocity.z *= -1;

    // Update leader mesh position
    leaderMesh.position.copy(leaderPosition);
}

// Update predator movement
function updatePredators(delta) {
    if (predatorPositions.length === 0) return;
    for (let i = 0; i < predatorConfigs.length; i++) {
        const cfg = predatorConfigs[i];
        if (!cfg.enabled) continue;

        // Decrease predator direction-change timer
        predatorChangeTimers[i] -= delta;
        if (predatorChangeTimers[i] <= 0) {
            // Compute flock center (average boid position)
            if (birdMeshes.length === 0) {
                continue;
            }
            let center = new THREE.Vector3();
            for (let j = 0; j < birdMeshes.length; j++) {
                center.add(birdMeshes[j].position);
            }
            center.divideScalar(birdMeshes.length);

            // Desired direction toward flock center plus random noise
            const desiredDirection = center.clone().sub(predatorPositions[i]).normalize();
            const noise = new THREE.Vector3(
                (Math.random() - 0.5) * cfg.noiseScale.x,
                (Math.random() - 0.5) * cfg.noiseScale.y,
                (Math.random() - 0.5) * cfg.noiseScale.z
            );
            const finalDirection = desiredDirection.clone().add(noise).normalize();

            // Base speed based on distance to flock center
            const distanceToCenter = predatorPositions[i].distanceTo(center);
            const baseSpeed =
                cfg.baseSpeed +
                Math.min(distanceToCenter, cfg.distanceSpeedClamp) * cfg.distanceSpeedFactor;
            // Apply predator speed with aggression multiplier
            predatorVelocities[i].copy(finalDirection).multiplyScalar(baseSpeed * cfg.aggression);

            // Reset direction-change timer
            predatorChangeTimers[i] = cfg.changeIntervalMin + Math.random() * cfg.changeIntervalJitter;
        }

        // Update predator position
        predatorPositions[i].addScaledVector(predatorVelocities[i], delta);

        // Bounce predator at bounds
        if (predatorPositions[i].x > bounds || predatorPositions[i].x < -bounds) {
            predatorVelocities[i].x *= -1;
        }
        if (predatorPositions[i].y > bounds || predatorPositions[i].y < -bounds) {
            predatorVelocities[i].y *= -1;
        }
        if (predatorPositions[i].z > bounds || predatorPositions[i].z < -bounds) {
            predatorVelocities[i].z *= -1;
        }

        // Update predator mesh position
        predatorMeshes[i].position.copy(predatorPositions[i]);
        predatorMeshes[i].visible = cfg.visible && cfg.enabled;
    }
}

// Update HUD info (leader speed and visibility state)
function updateHUD() {
    if (!hudElements) return;
    if (hudElements.speedInfo) {
        hudElements.speedInfo.innerText = `Leader speed: ${leaderSpeedMultiplier.toFixed(2)}x`;
    }
    if (hudElements.boidSpeedInfo) {
        hudElements.boidSpeedInfo.innerText = `Boid speed: ${boidSpeedMultiplier.toFixed(2)}x`;
    }
    if (hudElements.leaderInfo) {
        hudElements.leaderInfo.innerText = `Leader: ${leaderVisible ? 'Visible' : 'Hidden'}`;
    }
    if (hudElements.predatorInfo) {
        const enabledCount = predatorConfigs.filter((cfg) => cfg.enabled).length;
        hudElements.predatorInfo.innerText = `Predatores activos: ${enabledCount}`;
    }
}

function updatePerformanceHUD(fps, frameMs) {
    if (!hudElements || !hudElements.performanceInfo) return;
    hudElements.performanceInfo.innerText = `FPS: ${fps.toFixed(1)} | Frame: ${frameMs.toFixed(2)} ms`;
}

// Apply requested boid count by reloading with updated hash
function ajustarCantidadBoids(nuevoNumero) {
    if (!Number.isFinite(nuevoNumero) || nuevoNumero < 1) return;
    // Update boid count label in UI
    const birdsLabel = document.getElementById('birds');
    if (birdsLabel) birdsLabel.innerText = nuevoNumero;

    // Reload page with new count encoded as hash
    const newHash = Math.ceil(Math.sqrt(nuevoNumero));
    window.location.hash = newHash; // establece el nuevo hash en la URL
    window.location.reload(); // Reload page.
}

// Change boid mesh scale based on provided size
function cambiarTamanoBoids(nuevoTamano) {
    if (nuevoTamano <= 0) return;
    currentBoidSize = nuevoTamano;
    const escala = nuevoTamano / CONFIG.boids.sizeDefault;
    // Update scale for each existing boid
    for (let i = 0; i < birdMeshes.length; i++) {
        birdMeshes[i].scale.set(escala, escala, escala);
    }
}

// Change boid speed multiplier
function cambiarVelocidadBoids(nuevaVelocidad) {
    boidSpeedMultiplier = nuevaVelocidad;
    if (uniform_velocity && uniform_velocity.boidSpeed) {
        uniform_velocity.boidSpeed.value = boidSpeedMultiplier;
    }
    const input = document.getElementById('boidSpeed');
    if (input) input.value = boidSpeedMultiplier.toFixed(1);
    updateHUD(); // <- Reflect value in HUD
}

function getActivePredatorPositions() {
    const active = [];
    for (let i = 0; i < predatorConfigs.length; i++) {
        if (predatorConfigs[i].enabled) {
            active.push(predatorPositions[i]);
        }
    }
    return active;
}

// Global keyboard events for leader speed and visibility
window.addEventListener('keydown', (event) => {
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
    if (!leaderMesh) return;
    if (event.key === '+' || (event.key === '=' && event.shiftKey)) {
        // Increase leader speed
        leaderSpeedMultiplier += 0.1;
        if (leaderSpeedMultiplier > 10.0) leaderSpeedMultiplier = 10.0;
        updateHUD();
    } else if (event.key === '-') {
        // Decrease leader speed
        leaderSpeedMultiplier -= 0.1;
        if (leaderSpeedMultiplier < 0.1) leaderSpeedMultiplier = 0.1;
        updateHUD();
    } else if (event.key === 'r' || event.key === 'R') {
        // Reset leader speed to 1x
        leaderSpeedMultiplier = 1.0;
        updateHUD();
    } else if (event.key === 'l' || event.key === 'L') {
        // Show/Hide leader
        leaderVisible = !leaderVisible;
        leaderMesh.visible = leaderVisible;
        updateHUD();
    } else if (event.key === 'p' || event.key === 'P') {
        // Show/Hide all predators
        const anyEnabled = predatorConfigs.some((cfg) => cfg.enabled);
        const nextEnabled = !anyEnabled;
        predatorConfigs.forEach((cfg, index) => {
            cfg.enabled = nextEnabled;
            cfg.visible = nextEnabled;
            const mesh = predatorMeshes[index];
            if (mesh) mesh.visible = cfg.visible && cfg.enabled;
            const toggle = document.getElementById(`predatorToggle_${index}`);
            if (toggle) toggle.checked = nextEnabled;
        });
        updateHUD();
    }
});

// Export items used by main.js
export {
    initBirds,
    birdMeshes,
    leaderPosition,
    leaderVelocity,
    leaderAcceleration,
    getActivePredatorPositions,
    updatePerformanceHUD,
    updateLeader,
    updatePredators
};





