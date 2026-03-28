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
    currentResolution = resolution;

    gpu_allocation = new GPUComputationRenderer(resolution, resolution, renderer);

    const dtPosition = gpu_allocation.createTexture();
    const dtVelocity = gpu_allocation.createTexture();

    fillPositionTexture(dtPosition);
    fillVelocityTexture(dtVelocity);

    velocity_variable = gpu_allocation.addVariable("VelocityTexture", BoidVelocityFragmentShader, dtVelocity);
    position_variable = gpu_allocation.addVariable("PositionTexture", BoidPositionFragmentShader, dtPosition);

    gpu_allocation.setVariableDependencies(velocity_variable, [position_variable, velocity_variable]);
    gpu_allocation.setVariableDependencies(position_variable, [position_variable, velocity_variable]);

    uniform_position = position_variable.material.uniforms;
    uniform_velocity = velocity_variable.material.uniforms;

    uniform_position.clock = { value: 0.0 };
    uniform_position.del_change = { value: 0.0 };

    uniform_velocity.clock = { value: 0.0 };
    uniform_velocity.del_change = { value: 0.0 };
    uniform_velocity.seperation_distance = { value: CONFIG.boids.separationDistance };
    uniform_velocity.alignment_distance = { value: CONFIG.boids.alignmentDistance };
    uniform_velocity.cohesion_distance = { value: CONFIG.boids.cohesionDistance };
    uniform_velocity.predators = { value: [] };
    uniform_velocity.predatorCount = { value: 0 };
    uniform_velocity.globalDrift = { value: new THREE.Vector3() };
    uniform_velocity.leader = { value: new THREE.Vector3() };

    // Extra uniforms for dynamic realism.
    uniform_velocity.windField = { value: new THREE.Vector3() };

    uniform_velocity.vortexStrength = { value: 0.0 };
    uniform_velocity.boidSpeed = { value: CONFIG.boids.speedDefault };
    uniform_velocity.predatorRange = { value: CONFIG.predator.influenceRange };
    uniform_velocity.predatorStrength = { value: CONFIG.predator.influenceStrength };
    uniform_velocity.predatorSpeedLimitBoost = { value: CONFIG.predator.speedLimitBoost };
    uniform_velocity.speedLimit = { value: CONFIG.shader.speedLimit };
    uniform_velocity.centerPullStrength = { value: CONFIG.shader.centerPullStrength };
    uniform_velocity.centerYScale = { value: CONFIG.shader.centerYScale };
    uniform_velocity.separationStrength = { value: CONFIG.shader.separationStrength };
    uniform_velocity.cohesionStrength = { value: CONFIG.shader.cohesionStrength };
    uniform_velocity.alignmentStrength = { value: CONFIG.shader.alignmentStrength };
    uniform_velocity.leaderAttractStrength = { value: CONFIG.shader.leaderAttractStrength };
    uniform_velocity.randomMix = { value: CONFIG.shader.randomMix };
    uniform_velocity.vortexForceScale = { value: CONFIG.shader.vortexForceScale };
    uniform_velocity.gravityStrength = { value: CONFIG.shader.gravityStrength };
    uniform_velocity.neighborSampleCount = {
        value: Math.max(16, Math.min(256, Math.floor(CONFIG.performance?.neighborSampleCount || 128)))
    };



    velocity_variable.material.defines.bounds = bounds.toFixed(2);

    velocity_variable.wrapS = THREE.RepeatWrapping;
    velocity_variable.wrapT = THREE.RepeatWrapping;
    position_variable.wrapS = THREE.RepeatWrapping;
    position_variable.wrapT = THREE.RepeatWrapping;

    const error = gpu_allocation.init();
    if (error !== null) {
        throw new Error(`GPUComputationRenderer init failed: ${error}`);
    }
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
    initComputeRenderer,
    setComputeState,
    gpu_allocation,
    velocity_variable,
    position_variable,
    uniform_position,
    uniform_velocity,
    currentResolution
};
