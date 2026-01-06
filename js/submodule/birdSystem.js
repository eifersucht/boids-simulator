// js/submodule/birdSystem.js

// Importar sistema de computación GPU y shaders necesarios
import * as Compute from './GPUComputeSystem.js';
import { BoidPositionFragmentShader } from '../shaders/BoidPositionFragmentShader.js';
import { BoidVelocityFragmentShader } from '../shaders/BoidVelocityFragmentShader.js';

// Arrays y objetos globales para boids, líder y depredador
let birdMeshes = [];
let leaderMesh;
let predatorMesh;

// Vectores de posición/velocidad del líder y depredador
let leaderPosition;
let leaderVelocity;
let leaderAcceleration;
let leaderTargetDirection;
let predatorPosition;
let predatorVelocity;

// Temporizadores internos para cambios de dirección
let leaderChangeTimer = 0;
let predatorChangeTimer = 0;

// Parámetros de estado de la simulación
let leaderSpeedMultiplier = 1.0;    // Multiplicador de velocidad del líder
let leaderVisible = false;         // Visibilidad del líder (inicialmente oculto)
let predatorVisible = false;       // Visibilidad del depredador (inicialmente oculto)
let predatorSpeedMultiplier = 1.0; // Agresividad (multiplicador de velocidad) del depredador
let boidSpeedMultiplier = 1.0;   // Velocidad general de los boids (multiplicador)

// Límite de movimiento (caja de simulación)
const bounds = 600;

// Geometría y material compartidos para las aves (boids)
let boidGeometry;
let boidMaterial;
let currentBoidSize = 3;  // Tamaño actual (radio) de los boids

// Referencias al renderer y a la escena, para añadir/eliminar boids dinámicamente
let rendererRef;
let sceneRef;
let hudElements = null;

/**
 * Inicializa las entidades de la simulación (boids, líder, depredador) y configura eventos.
 * @param {THREE.Scene} scene - La escena Three.js donde añadir los objetos.
 * @param {THREE.WebGLRenderer} renderer - El renderer, necesario para operaciones de GPU dinámicas.
 */
function initBirds(scene, renderer) {
    // Almacenar referencias de escena y renderer para uso posterior
    sceneRef = scene;
    rendererRef = renderer;

    // Determinar color inicial para los boids (leer de input de color si existe)
    let initialColor = 0x111111; // Color por defecto negro
    const colorInputElem = document.getElementById('boidColor');
    if (colorInputElem) {
        try {
            // Si existe input de color, usar su valor inicial (#RRGGBB)
            initialColor = new THREE.Color(colorInputElem.value);
        } catch (e) {
            initialColor = new THREE.Color(0x111111);
        }
    } else {
        initialColor = new THREE.Color(0x111111);
    }

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

    // Crear depredador (esfera naranja) y añadirlo a la escena
    const predatorGeometry = new THREE.SphereGeometry(8.0, 16, 16);
    const predatorMaterial = new THREE.MeshStandardMaterial({
        color: 0xff8800,
        roughness: 0.5,
        metalness: 0.1,
        transparent: true,
        opacity: 1.0
    });
    predatorMesh = new THREE.Mesh(predatorGeometry, predatorMaterial);
    predatorMesh.matrixAutoUpdate = true;
    scene.add(predatorMesh);
    predatorMesh.visible = false;
    predatorVisible = false;  // sincronizar estado del depredador con su visibilidad

    // Inicializar vectores de estado del líder y depredador
    leaderPosition = new THREE.Vector3();
    leaderVelocity = new THREE.Vector3(1, 0, 0).normalize().multiplyScalar(150);
    leaderAcceleration = new THREE.Vector3();
    leaderTargetDirection = new THREE.Vector3(
        (Math.random() - 0.5),
        (Math.random() - 0.5),
        (Math.random() - 0.5)
    ).normalize();

    predatorPosition = new THREE.Vector3(200, 0, 0);
    predatorVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 50
    );
    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.style.position = 'fixed';
    hud.style.top = '40px';
    hud.style.left = '10px';
    hud.style.padding = '10px';
    hud.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    hud.style.color = 'white';
    hud.style.fontFamily = 'Arial, sans-serif';
    hud.style.fontSize = '14px';
    hud.style.borderRadius = '8px';
    hud.style.zIndex = '1000';
    hud.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    hud.style.pointerEvents = 'auto';  // importante para permitir interacción

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
        <input type="number" id="boidSize" value="3" min="1" max="20" step="0.5"><br><br>

        <label>Velocidad general de boids:</label><br>
        <input type="number" id="boidSpeed" value="1.0" min="0.1" max="10" step="0.1"><br><br>

        <label>Agresividad del depredador:</label><br>
        <input type="number" id="agresividad" value="1.0" min="0" max="10" step="0.1">
    </div>
    `;

    document.body.appendChild(hud);
    hudElements = {
        speedInfo: document.getElementById('speedInfo'),
        boidSpeedInfo: document.getElementById('boidSpeedInfo'),
        leaderInfo: document.getElementById('leaderInfo'),
        predatorInfo: document.getElementById('predatorInfo')
    };
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

    document.getElementById('agresividad').addEventListener('input', (e) => {
        const nuevaAgresividad = parseFloat(e.target.value);
        cambiarAgresividad(nuevaAgresividad);
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

    // Configurar eventos para inputs de la interfaz:
    const colorInput = document.getElementById('boidColor');
    if (colorInput) {
        colorInput.addEventListener('input', () => {
            cambiarColorBoids(colorInput.value);
        });
    }
    // Crear botón de toggle para mostrar/ocultar el HUD
    const toggleButton = document.createElement('div');
    toggleButton.id = 'hudToggle';
    toggleButton.innerHTML = '&#9776;'; // icono de "hamburguesa"
    toggleButton.style.position = 'fixed';
    toggleButton.style.top = '10px';
    toggleButton.style.left = '10px';
    toggleButton.style.width = '30px';
    toggleButton.style.height = '30px';
    toggleButton.style.lineHeight = '30px';
    toggleButton.style.textAlign = 'center';
    toggleButton.style.backgroundColor = '#222';
    toggleButton.style.color = 'white';
    toggleButton.style.borderRadius = '5px';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.zIndex = '1001';
    toggleButton.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    toggleButton.style.fontSize = '20px';
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
            (Math.random() - 0.5) * 2.0,
            (Math.random() - 0.5) * 1.0,
            (Math.random() - 0.5) * 2.0
        ).normalize();
        leaderChangeTimer = 8.0 + Math.random() * 4.0;
    }

    // Ajustar gradualmente la velocidad del líder hacia la dirección objetivo
    leaderVelocity.lerp(leaderTargetDirection.clone().multiplyScalar(150), delta * 0.5);

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
function updatePredator(delta) {
    // Disminuir el temporizador de cambio de dirección del depredador
    predatorChangeTimer -= delta;
    if (predatorChangeTimer <= 0) {
        // Calcular el centro de la bandada (promedio de posiciones de todos los boids)
        if (birdMeshes.length === 0) {
            return;
        }
        let center = new THREE.Vector3();
        for (let i = 0; i < birdMeshes.length; i++) {
            center.add(birdMeshes[i].position);
        }
        center.divideScalar(birdMeshes.length);

        // Direccion deseada hacia el centro de la bandada, con ruido aleatorio
        const desiredDirection = center.clone().sub(predatorPosition).normalize();
        const noise = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.2
        );
        const finalDirection = desiredDirection.clone().add(noise).normalize();

        // Calcular velocidad base en función de la distancia al centro de la bandada
        const distanceToCenter = predatorPosition.distanceTo(center);
        const baseSpeed = 100 + Math.min(distanceToCenter, 300) * 0.5;
        // Asignar velocidad al depredador aplicando el multiplicador de agresividad
        predatorVelocity.copy(finalDirection).multiplyScalar(baseSpeed * predatorSpeedMultiplier);

        // Reiniciar temporizador de cambio de dirección entre 2 y 4 segundos
        predatorChangeTimer = 2.0 + Math.random() * 2.0;
    }

    // Actualizar posición del depredador según su velocidad
    predatorPosition.addScaledVector(predatorVelocity, delta);

    // Rebotar en los límites invirtiendo la velocidad del depredador si sale del área
    if (predatorPosition.x > bounds || predatorPosition.x < -bounds) predatorVelocity.x *= -1;
    if (predatorPosition.y > bounds || predatorPosition.y < -bounds) predatorVelocity.y *= -1;
    if (predatorPosition.z > bounds || predatorPosition.z < -bounds) predatorVelocity.z *= -1;

    // Actualizar la posición de la malla del depredador
    predatorMesh.position.copy(predatorPosition);
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
        hudElements.predatorInfo.innerText = `Depredador: ${predatorVisible ? 'Visible' : 'Oculto'}`;
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

// Cambia el color de todos los boids al seleccionado por el usuario
function cambiarColorBoids(colorHex) {
    boidMaterial.color.set(colorHex);
}

// Cambia el tamaño (escala) de los boids en la escena según el valor proporcionado
function cambiarTamanoBoids(nuevoTamano) {
    if (nuevoTamano <= 0) return;
    currentBoidSize = nuevoTamano;
    const escala = nuevoTamano / 3;
    // Ajustar la escala de cada boid existente
    for (let i = 0; i < birdMeshes.length; i++) {
        birdMeshes[i].scale.set(escala, escala, escala);
    }
}

// Ajusta la agresividad del depredador (afecta su velocidad)
function cambiarAgresividad(nuevaAgresividad) {
    if (nuevaAgresividad < 0) return;
    predatorSpeedMultiplier = nuevaAgresividad;
}

// Cambia la velocidad de los boids en la simulación (multiplicador de velocidad)
function cambiarVelocidadBoids(nuevaVelocidad) {
    boidSpeedMultiplier = nuevaVelocidad;
    if (Compute.uniform_velocity && Compute.uniform_velocity.boidSpeed) {
        Compute.uniform_velocity.boidSpeed.value = boidSpeedMultiplier;
    }
    const input = document.getElementById('boidSpeed');
    if (input) input.value = boidSpeedMultiplier.toFixed(1);
    updateHUD(); // <- Para que se refleje en el HUD al cambiar
}

// Re-inicializa el sistema de computación GPU (GPUComputeRenderer) para acomodar un nuevo número de boids
function reinitComputeSystem(nuevoNumero) {
    const oldRes = Compute.currentResolution;
    const oldCount = birdMeshes.length;
    // Leer las texturas actuales de posición y velocidad desde la GPU
    const posArray = new Float32Array(oldRes * oldRes * 4);
    const velArray = new Float32Array(oldRes * oldRes * 4);
    rendererRef.readRenderTargetPixels(
        Compute.gpu_allocation.getCurrentRenderTarget(Compute.position_variable),
        0, 0, oldRes, oldRes,
        posArray
    );
    rendererRef.readRenderTargetPixels(
        Compute.gpu_allocation.getCurrentRenderTarget(Compute.velocity_variable),
        0, 0, oldRes, oldRes,
        velArray
    );
    // Calcular nueva resolución cuadrada necesaria
    const newRes = Math.ceil(Math.sqrt(nuevoNumero));
    // Crear nuevo renderer de computación GPU con la nueva resolución
    const newCompute = new GPUComputationRenderer(newRes, newRes, rendererRef);
    // Crear texturas de estado inicial (posición y velocidad)
    const dtPosition = newCompute.createTexture();
    const dtVelocity = newCompute.createTexture();
    const posData = dtPosition.image.data;
    const velData = dtVelocity.image.data;
    // Rellenar texturas iniciales: conservar boids existentes y generar datos para boids nuevos o fantasmas
    for (let i = 0; i < posData.length; i += 4) {
        const index = i / 4;
        if (index < nuevoNumero) {
            if (index < oldCount) {
                // Conservar posición y velocidad de boid existente
                posData[i]     = posArray[i];
                posData[i + 1] = posArray[i + 1];
                posData[i + 2] = posArray[i + 2];
                posData[i + 3] = 1;
                velData[i]     = velArray[i];
                velData[i + 1] = velArray[i + 1];
                velData[i + 2] = velArray[i + 2];
                velData[i + 3] = 1;
            } else {
                // Inicializar boid nuevo con posición y velocidad aleatorias
                posData[i]     = (Math.random() - 0.5) * 80;
                posData[i + 1] = (Math.random() - 0.5) * 10;
                posData[i + 2] = (Math.random() - 0.5) * 80;
                posData[i + 3] = 1;
                velData[i]     = (Math.random() - 0.5) * 10;
                velData[i + 1] = (Math.random() - 0.5) * 10;
                velData[i + 2] = (Math.random() - 0.5) * 10;
                velData[i + 3] = 1;
            }
        } else {
            // Colocar boids "fantasma" (sin uso) lejos y sin velocidad para que no influyan
            posData[i]     = 9999;
            posData[i + 1] = 9999;
            posData[i + 2] = 9999;
            posData[i + 3] = 1;
            velData[i]     = 0;
            velData[i + 1] = 0;
            velData[i + 2] = 0;
            velData[i + 3] = 1;
        }
    }
    // Configurar variables de simulación con los shaders de posición y velocidad
    const velVar = newCompute.addVariable("VelocityTexture", BoidVelocityFragmentShader, dtVelocity);
    const posVar = newCompute.addVariable("PositionTexture", BoidPositionFragmentShader, dtPosition);
    newCompute.setVariableDependencies(velVar, [posVar, velVar]);
    newCompute.setVariableDependencies(posVar, [posVar, velVar]);
    // Definir uniforms necesarios para las nuevas variables
    posVar.material.uniforms.clock = { value: 0.0 };
    posVar.material.uniforms.del_change = { value: 0.0 };
    velVar.material.uniforms.clock = { value: 0.0 };
    velVar.material.uniforms.del_change = { value: 0.0 };
    velVar.material.uniforms.testing = { value: 1.0 };
    velVar.material.uniforms.seperation_distance = { value: 10.0 };
    velVar.material.uniforms.alignment_distance = { value: 25.0 };
    velVar.material.uniforms.cohesion_distance = { value: 30.0 };
    velVar.material.uniforms.freedom_distance = { value: 0.4 };
    velVar.material.uniforms.predator = { value: new THREE.Vector3() };
    velVar.material.uniforms.globalDrift = { value: new THREE.Vector3() };
    velVar.material.uniforms.leader = { value: new THREE.Vector3() };
    velVar.material.uniforms.leaderVelocity = { value: new THREE.Vector3() };
    velVar.material.uniforms.leaderAcceleration = { value: new THREE.Vector3() };
    velVar.material.uniforms.leaderBrakingForce = { value: 0.0 };
    velVar.material.uniforms.leaderTurningForce = { value: 0.0 };
    velVar.material.uniforms.windField = { value: new THREE.Vector3() };
    velVar.material.uniforms.groupInertia = { value: 1.0 };
    velVar.material.uniforms.vortexStrength = { value: 0.0 };
    velVar.material.uniforms.boidSpeed = { value: boidSpeedMultiplier };
    // Definir la constante 'bounds' en el shader de velocidad (depredador y límites)
    velVar.material.defines.bounds = bounds.toFixed(2);
    // Configurar wrapping (repetición) de las texturas de simulación
    velVar.wrapS = velVar.wrapT = THREE.RepeatWrapping;
    posVar.wrapS = posVar.wrapT = THREE.RepeatWrapping;
    // Inicializar el nuevo sistema de computación GPU
    const error = newCompute.init();
    if (error !== null) {
        console.error(error);
    }
    // Reemplazar el estado en el modulo de computacion GPU con las nuevas referencias
    Compute.setComputeState({
        gpu_allocation: newCompute,
        velocity_variable: velVar,
        position_variable: posVar,
        currentResolution: newRes
    });

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
        // Mostrar/Ocultar depredador
        predatorVisible = !predatorVisible;
        predatorMesh.visible = predatorVisible;
        updateHUD();
    }
});

// Exportar elementos necesarios para main.js
export {
    initBirds,
    birdMeshes,
    leaderMesh,
    predatorMesh,
    leaderPosition,
    leaderVelocity,
    leaderAcceleration,
    predatorPosition,
    predatorVelocity,
    leaderChangeTimer,
    predatorChangeTimer,
    bounds,
    updateLeader,
    updatePredator
};
