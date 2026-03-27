// js/submodule/birdSystem.js

// Importar sistema de computación GPU y shaders necesarios
import { CONFIG } from '../config.js';
import { uniform_velocity } from './GPUComputeSystem.js';

// Arrays y objetos globales para boids, líder y depredador
let birdMeshes = [];
let leaderMesh;

// Vectores de posición/velocidad del líder y depredador
let leaderPosition;
let leaderVelocity;
let leaderAcceleration;
let leaderTargetDirection;
let predatorMeshes = [];
let predatorPositions = [];
let predatorVelocities = [];
let predatorConfigs = [];

// Temporizadores internos para cambios de dirección
let leaderChangeTimer = 0;
let predatorChangeTimers = [];

// Parámetros de estado de la simulación
let leaderSpeedMultiplier = 1.0;    // Multiplicador de velocidad del líder
let leaderVisible = false;         // Visibilidad del líder (inicialmente oculto)
let boidSpeedMultiplier = CONFIG.boids.speedDefault;   // Velocidad general de los boids (multiplicador)

// Límite de movimiento (caja de simulación)
const bounds = CONFIG.simulation.bounds;

// Geometría y material compartidos para las aves (boids)
let boidGeometry;
let boidMaterial;
let currentBoidSize = CONFIG.boids.sizeDefault;  // Tamaño actual (radio) de los boids

// Referencias al renderer y a la escena, para añadir/eliminar boids dinámicamente
let rendererRef;
let hudElements = null;

/**
 * Inicializa las entidades de la simulación (boids, líder, depredador) y configura eventos.
 * @param {THREE.Scene} scene - La escena Three.js donde añadir los objetos.
 * @param {THREE.WebGLRenderer} renderer - El renderer, necesario para operaciones de GPU dinámicas.
 */
function initBirds(scene, renderer) {
    // Almacenar referencias de escena y renderer para uso posterior
    rendererRef = renderer;

    // Determinar color inicial para los boids.
    const initialColor = new THREE.Color(0x111111);

    // Crear geometría y material para boids (reutilizados por todas las aves)
    boidGeometry = new THREE.SphereGeometry(currentBoidSize, 8, 8);
    boidMaterial = new THREE.MeshLambertMaterial({ color: initialColor });

    // Obtener número inicial de boids desde la etiqueta 'birds' (definida en main.js)
    const initialBoids = parseInt(document.getElementById('birds')?.innerText) || (64 * 64);
    // Crear las mallas de boids iniciales y agregarlas a la escena
    for (let i = 0; i < initialBoids; i++) {
        const boidMesh = new THREE.Mesh(boidGeometry, boidMaterial);
        boidMesh.matrixAutoUpdate = true;
        scene.add(boidMesh);
        birdMeshes.push(boidMesh);
    }

    // Crear líder (cubo rojo) y añadirlo a la escena
    const leaderGeometry = new THREE.BoxGeometry(10, 5, 3);
    const leaderMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    leaderMesh = new THREE.Mesh(leaderGeometry, leaderMaterial);
    leaderMesh.matrixAutoUpdate = true;
    scene.add(leaderMesh);
    leaderMesh.visible = false;
    leaderVisible = false;  // sincronizar estado del líder con su visibilidad

    // Crear depredadores (esferas naranjas) y añadirlos a la escena
    const predatorGeometry = new THREE.SphereGeometry(8.0, 16, 16);
    const predatorMaterial = new THREE.MeshStandardMaterial({
        color: 0xff8800,
        roughness: 0.5,
        metalness: 0.1,
        transparent: true,
        opacity: 1.0
    });
    const basePredatorConfig = {
        name: 'Depredador',
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
            name: entry.name || `Depredador ${index + 1}`,
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

    // Inicializar vectores de estado del líder y depredador
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
    <div>Controles:</div>
    <div>+ / - : Aumentar / Disminuir velocidad líder</div>
    <div>R : Resetear velocidad líder</div>
    <div>L : Mostrar/Ocultar líder</div>
    <div>P : Mostrar/Ocultar depredador</div>
    <hr>
    <div id="speedInfo"></div>
    <div id="boidSpeedInfo"></div>
    <div id="leaderInfo"></div>
    <div id="predatorInfo"></div>
    <hr>
    <div>
        <label>Cantidad de boids:</label><br>
        <input type="number" id="boidCount" value="${birdMeshes.length}" min="1" max="10000">
        <button id="applyBoidCount">Aplicar cambios</button><br><br>

        <label>Color del fondo:</label><br>
        <input type="color" id="bgColor" value="#FFFFFF"><br><br>

        <label>Tamaño de los boids:</label><br>
        <input type="number" id="boidSize" value="${CONFIG.boids.sizeDefault}" min="1" max="20" step="0.5"><br><br>

        <label>Velocidad general de boids:</label><br>
        <input type="number" id="boidSpeed" value="${CONFIG.boids.speedDefault}" min="0.1" max="10" step="0.1"><br><br>

        <div>Depredadores:</div>
        <div id="predatorsPanel"></div>
    </div>
    `;

    document.body.appendChild(hud);
    hudElements = {
        speedInfo: document.getElementById('speedInfo'),
        boidSpeedInfo: document.getElementById('boidSpeedInfo'),
        leaderInfo: document.getElementById('leaderInfo'),
        predatorInfo: document.getElementById('predatorInfo')
    };
    const predatorsPanel = document.getElementById('predatorsPanel');
    if (predatorsPanel) {
        predatorsPanel.innerHTML = '';
        predatorConfigs.forEach((cfg, index) => {
            const row = document.createElement('div');
            row.style.marginBottom = '6px';

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
            speed.style.width = '70px';
            speed.style.marginLeft = '8px';

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

    // Eventos para los inputs nuevos
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
            alert('Cantidad de boids invalida.');
            return;
        }
        const confirmReload = confirm(`El navegador se va a reiniciar para aplicar el nuevo numero de boids (${nuevoNumero}). Desea continuar?`);

        if (confirmReload) {
            ajustarCantidadBoids(nuevoNumero);
        }
    });

    document.getElementById('boidSpeed').addEventListener('input', (e) => {
        const nuevaVelocidad = parseFloat(e.target.value);
        if (!isNaN(nuevaVelocidad) && nuevaVelocidad > 0) {
            cambiarVelocidadBoids(nuevaVelocidad);
        }
    });

    // Inicializar el valor de velocidad de los boids en el input
    document.getElementById('boidSpeed').value = boidSpeedMultiplier.toFixed(1);

    // Inicializar el color de fondo
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

    // Crear botón de toggle para mostrar/ocultar el HUD
    const toggleButton = document.createElement('div');
    toggleButton.id = 'hudToggle';
    toggleButton.innerHTML = '&#9776;'; // icono de "hamburguesa"
    toggleButton.title = 'Mostrar/Ocultar controles';
    document.body.appendChild(toggleButton);

    // Estado de visibilidad del HUD
    let hudVisible = true;
        toggleButton.addEventListener('click', () => {
            const hudElem = document.getElementById('hud');
            if (hudElem) {
                hudVisible = !hudVisible;
                hudElem.classList.toggle('hidden', !hudVisible);
            }
        });
}

// Actualiza el movimiento del líder (boid que guía la bandada)
function updateLeader(delta) {
    // Disminuir el temporizador de cambio de dirección del líder
    leaderChangeTimer -= delta;
    if (leaderChangeTimer <= 0) {
        // Calcular una nueva dirección objetivo aleatoria para el líder
        leaderTargetDirection = new THREE.Vector3(
            (Math.random() - 0.5) * CONFIG.leader.targetScale.x,
            (Math.random() - 0.5) * CONFIG.leader.targetScale.y,
            (Math.random() - 0.5) * CONFIG.leader.targetScale.z
        ).normalize();
        leaderChangeTimer = CONFIG.leader.changeIntervalMin + Math.random() * CONFIG.leader.changeIntervalJitter;
    }

    // Ajustar gradualmente la velocidad del líder hacia la dirección objetivo
    leaderVelocity.lerp(
        leaderTargetDirection.clone().multiplyScalar(CONFIG.leader.speed),
        delta * CONFIG.leader.turnLerp
    );

    // Calcular la aceleración del líder como el cambio de velocidad desde el último frame
    leaderAcceleration.copy(leaderVelocity).sub(leaderMesh.userData.lastVelocity || new THREE.Vector3());
    leaderMesh.userData.lastVelocity = leaderVelocity.clone();

    // Mover la posición del líder según su velocidad y multiplicador de velocidad
    leaderPosition.addScaledVector(leaderVelocity, delta * leaderSpeedMultiplier);

    // Rebotar en los límites de la escena invirtiendo la velocidad si el líder sale del área
    if (leaderPosition.x > bounds || leaderPosition.x < -bounds) leaderVelocity.x *= -1;
    if (leaderPosition.y > bounds || leaderPosition.y < -bounds) leaderVelocity.y *= -1;
    if (leaderPosition.z > bounds || leaderPosition.z < -bounds) leaderVelocity.z *= -1;

    // Actualizar la posición de la malla del líder
    leaderMesh.position.copy(leaderPosition);
}

// Actualiza el movimiento del depredador (que persigue a la bandada)
function updatePredators(delta) {
    if (predatorPositions.length === 0) return;
    for (let i = 0; i < predatorConfigs.length; i++) {
        const cfg = predatorConfigs[i];
        if (!cfg.enabled) continue;

        // Disminuir el temporizador de cambio de dirección del depredador
        predatorChangeTimers[i] -= delta;
        if (predatorChangeTimers[i] <= 0) {
            // Calcular el centro de la bandada (promedio de posiciones de todos los boids)
            if (birdMeshes.length === 0) {
                continue;
            }
            let center = new THREE.Vector3();
            for (let j = 0; j < birdMeshes.length; j++) {
                center.add(birdMeshes[j].position);
            }
            center.divideScalar(birdMeshes.length);

            // Direccion deseada hacia el centro de la bandada, con ruido aleatorio
            const desiredDirection = center.clone().sub(predatorPositions[i]).normalize();
            const noise = new THREE.Vector3(
                (Math.random() - 0.5) * cfg.noiseScale.x,
                (Math.random() - 0.5) * cfg.noiseScale.y,
                (Math.random() - 0.5) * cfg.noiseScale.z
            );
            const finalDirection = desiredDirection.clone().add(noise).normalize();

            // Calcular velocidad base en función de la distancia al centro de la bandada
            const distanceToCenter = predatorPositions[i].distanceTo(center);
            const baseSpeed =
                cfg.baseSpeed +
                Math.min(distanceToCenter, cfg.distanceSpeedClamp) * cfg.distanceSpeedFactor;
            // Asignar velocidad al depredador aplicando el multiplicador de agresividad
            predatorVelocities[i].copy(finalDirection).multiplyScalar(baseSpeed * cfg.aggression);

            // Reiniciar temporizador de cambio de dirección
            predatorChangeTimers[i] = cfg.changeIntervalMin + Math.random() * cfg.changeIntervalJitter;
        }

        // Actualizar posición del depredador según su velocidad
        predatorPositions[i].addScaledVector(predatorVelocities[i], delta);

        // Rebotar en los límites invirtiendo la velocidad del depredador si sale del área
        if (predatorPositions[i].x > bounds || predatorPositions[i].x < -bounds) {
            predatorVelocities[i].x *= -1;
        }
        if (predatorPositions[i].y > bounds || predatorPositions[i].y < -bounds) {
            predatorVelocities[i].y *= -1;
        }
        if (predatorPositions[i].z > bounds || predatorPositions[i].z < -bounds) {
            predatorVelocities[i].z *= -1;
        }

        // Actualizar la posición de la malla del depredador
        predatorMeshes[i].position.copy(predatorPositions[i]);
        predatorMeshes[i].visible = cfg.visible && cfg.enabled;
    }
}

// Actualiza la información mostrada en el HUD (velocidad del líder y visibilidad de líder/depredador)
function updateHUD() {
    if (!hudElements) return;
    if (hudElements.speedInfo) {
        hudElements.speedInfo.innerText = `Velocidad lider: ${leaderSpeedMultiplier.toFixed(2)}x`;
    }
    if (hudElements.boidSpeedInfo) {
        hudElements.boidSpeedInfo.innerText = `Velocidad boids: ${boidSpeedMultiplier.toFixed(2)}x`;
    }
    if (hudElements.leaderInfo) {
        hudElements.leaderInfo.innerText = `Lider: ${leaderVisible ? 'Visible' : 'Oculto'}`;
    }
    if (hudElements.predatorInfo) {
        const enabledCount = predatorConfigs.filter((cfg) => cfg.enabled).length;
        hudElements.predatorInfo.innerText = `Depredadores activos: ${enabledCount}`;
    }
}

// Agrega o elimina boids dinámicamente en la escena y en la simulación según la nueva cantidad solicitada
function ajustarCantidadBoids(nuevoNumero) {
    if (!Number.isFinite(nuevoNumero) || nuevoNumero < 1) return;
    // Actualiza el indicador de cantidad de boids en la interfaz
    const birdsLabel = document.getElementById('birds');
    if (birdsLabel) birdsLabel.innerText = nuevoNumero;

    // Recargar la página automáticamente con el nuevo número como hash
    const newHash = Math.ceil(Math.sqrt(nuevoNumero));
    window.location.hash = newHash; // establece el nuevo hash en la URL
    window.location.reload(); // recarga la página
}

// Cambia el tamaño (escala) de los boids en la escena según el valor proporcionado
function cambiarTamanoBoids(nuevoTamano) {
    if (nuevoTamano <= 0) return;
    currentBoidSize = nuevoTamano;
    const escala = nuevoTamano / CONFIG.boids.sizeDefault;
    // Ajustar la escala de cada boid existente
    for (let i = 0; i < birdMeshes.length; i++) {
        birdMeshes[i].scale.set(escala, escala, escala);
    }
}

// Cambia la velocidad de los boids en la simulación (multiplicador de velocidad)
function cambiarVelocidadBoids(nuevaVelocidad) {
    boidSpeedMultiplier = nuevaVelocidad;
    if (uniform_velocity && uniform_velocity.boidSpeed) {
        uniform_velocity.boidSpeed.value = boidSpeedMultiplier;
    }
    const input = document.getElementById('boidSpeed');
    if (input) input.value = boidSpeedMultiplier.toFixed(1);
    updateHUD(); // <- Para que se refleje en el HUD al cambiar
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

// Eventos de teclado globales para controlar velocidad del líder y visibilidad de líder/depredador
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
    if (event.key === '+' || (event.key === '=' && event.shiftKey)) {
        // Aumentar velocidad del líder
        leaderSpeedMultiplier += 0.1;
        if (leaderSpeedMultiplier > 10.0) leaderSpeedMultiplier = 10.0;
        updateHUD();
    } else if (event.key === '-') {
        // Disminuir velocidad del líder
        leaderSpeedMultiplier -= 0.1;
        if (leaderSpeedMultiplier < 0.1) leaderSpeedMultiplier = 0.1;
        updateHUD();
    } else if (event.key === 'r' || event.key === 'R') {
        // Resetear velocidad del líder a 1x
        leaderSpeedMultiplier = 1.0;
        updateHUD();
    } else if (event.key === 'l' || event.key === 'L') {
        // Mostrar/Ocultar líder
        leaderVisible = !leaderVisible;
        leaderMesh.visible = leaderVisible;
        updateHUD();
    } else if (event.key === 'p' || event.key === 'P') {
        // Mostrar/Ocultar todos los depredadores
        const anyEnabled = predatorConfigs.some((cfg) => cfg.enabled);
        const nextEnabled = !anyEnabled;
        predatorConfigs.forEach((cfg, index) => {
            cfg.enabled = nextEnabled;
            cfg.visible = nextEnabled;
            const mesh = predatorMeshes[index];
            if (mesh) mesh.visible = cfg.visible && cfg.enabled;
        });
        updateHUD();
    }
});

// Exportar elementos necesarios para main.js
export {
    initBirds,
    birdMeshes,
    leaderPosition,
    leaderVelocity,
    leaderAcceleration,
    getActivePredatorPositions,
    updateLeader,
    updatePredators
};
