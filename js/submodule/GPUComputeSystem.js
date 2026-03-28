// js/submodule/GPUComputeSystem.js
import { BoidPositionFragmentShader } from '../shaders/BoidPositionFragmentShader.js';
import { BoidVelocityFragmentShader } from '../shaders/BoidVelocityFragmentShader.js';
import { CONFIG } from '../config.js';

let gpu_allocation;
let velocity_variable;
let position_variable;
let uniform_position;
let uniform_velocity;
let currentResolution;

function initComputeRenderer(renderer, resolution, bounds) {
    const system = createComputeSystem(renderer, resolution, bounds);
    gpu_allocation = system.gpu_allocation;
    velocity_variable = system.velocity_variable;
    position_variable = system.position_variable;
    uniform_position = system.uniform_position;
    uniform_velocity = system.uniform_velocity;
    currentResolution = system.currentResolution;
}

function createComputeSystem(renderer, resolution, bounds) {
    const system = {};
    system.currentResolution = resolution;
    system.gpu_allocation = new GPUComputationRenderer(resolution, resolution, renderer);

    const dtPosition = system.gpu_allocation.createTexture();
    const dtVelocity = system.gpu_allocation.createTexture();
    fillPositionTexture(dtPosition);
    fillVelocityTexture(dtVelocity);

    system.velocity_variable = system.gpu_allocation.addVariable("VelocityTexture", BoidVelocityFragmentShader, dtVelocity);
    system.position_variable = system.gpu_allocation.addVariable("PositionTexture", BoidPositionFragmentShader, dtPosition);
    system.gpu_allocation.setVariableDependencies(system.velocity_variable, [system.position_variable, system.velocity_variable]);
    system.gpu_allocation.setVariableDependencies(system.position_variable, [system.position_variable, system.velocity_variable]);

    system.uniform_position = system.position_variable.material.uniforms;
    system.uniform_velocity = system.velocity_variable.material.uniforms;

    system.uniform_position.clock = { value: 0.0 };
    system.uniform_position.del_change = { value: 0.0 };
    system.uniform_velocity.clock = { value: 0.0 };
    system.uniform_velocity.del_change = { value: 0.0 };
    system.uniform_velocity.seperation_distance = { value: CONFIG.boids.separationDistance };
    system.uniform_velocity.alignment_distance = { value: CONFIG.boids.alignmentDistance };
    system.uniform_velocity.cohesion_distance = { value: CONFIG.boids.cohesionDistance };
    system.uniform_velocity.predators = { value: [] };
    system.uniform_velocity.predatorCount = { value: 0 };
    system.uniform_velocity.globalDrift = { value: new THREE.Vector3() };
    system.uniform_velocity.leader = { value: new THREE.Vector3() };
    system.uniform_velocity.windField = { value: new THREE.Vector3() };
    system.uniform_velocity.vortexStrength = { value: 0.0 };
    system.uniform_velocity.boidSpeed = { value: CONFIG.boids.speedDefault };
    system.uniform_velocity.predatorRange = { value: CONFIG.predator.influenceRange };
    system.uniform_velocity.predatorStrength = { value: CONFIG.predator.influenceStrength };
    system.uniform_velocity.predatorSpeedLimitBoost = { value: CONFIG.predator.speedLimitBoost };
    system.uniform_velocity.speedLimit = { value: CONFIG.shader.speedLimit };
    system.uniform_velocity.centerPullStrength = { value: CONFIG.shader.centerPullStrength };
    system.uniform_velocity.centerYScale = { value: CONFIG.shader.centerYScale };
    system.uniform_velocity.separationStrength = { value: CONFIG.shader.separationStrength };
    system.uniform_velocity.cohesionStrength = { value: CONFIG.shader.cohesionStrength };
    system.uniform_velocity.alignmentStrength = { value: CONFIG.shader.alignmentStrength };
    system.uniform_velocity.leaderAttractStrength = { value: CONFIG.shader.leaderAttractStrength };
    system.uniform_velocity.randomMix = { value: CONFIG.shader.randomMix };
    system.uniform_velocity.vortexForceScale = { value: CONFIG.shader.vortexForceScale };
    system.uniform_velocity.gravityStrength = { value: CONFIG.shader.gravityStrength };
    system.uniform_velocity.neighborSampleCount = {
        value: Math.max(16, Math.min(256, Math.floor(CONFIG.performance?.neighborSampleCount || 128)))
    };

    system.velocity_variable.material.defines.bounds = bounds.toFixed(2);
    system.velocity_variable.wrapS = THREE.RepeatWrapping;
    system.velocity_variable.wrapT = THREE.RepeatWrapping;
    system.position_variable.wrapS = THREE.RepeatWrapping;
    system.position_variable.wrapT = THREE.RepeatWrapping;

    const error = system.gpu_allocation.init();
    if (error !== null) {
        throw new Error(`GPUComputationRenderer init failed: ${error}`);
    }
    return system;
}

function setComputeState(nextState) {
    gpu_allocation = nextState.gpu_allocation;
    velocity_variable = nextState.velocity_variable;
    position_variable = nextState.position_variable;
    uniform_position = position_variable.material.uniforms;
    uniform_velocity = velocity_variable.material.uniforms;
    currentResolution = nextState.currentResolution;
}

function fillPositionTexture(texture) {
    const array = texture.image.data;
    for (let i = 0; i < array.length; i += 4) {
        array[i + 0] = (Math.random() - 0.5) * 80; 
        array[i + 1] = (Math.random() - 0.5) * 10; 
        array[i + 2] = (Math.random() - 0.5) * 80; 
        array[i + 3] = 1;
    }
}

function fillVelocityTexture(texture) {
    const array = texture.image.data;
    for (let i = 0; i < array.length; i += 4) {
        array[i + 0] = (Math.random() - 0.5) * 10;
        array[i + 1] = (Math.random() - 0.5) * 10;
        array[i + 2] = (Math.random() - 0.5) * 10;
        array[i + 3] = 1;
    }
}

export {
    createComputeSystem,
    initComputeRenderer,
    setComputeState,
    gpu_allocation,
    velocity_variable,
    position_variable,
    uniform_position,
    uniform_velocity,
    currentResolution
};
