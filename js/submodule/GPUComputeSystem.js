// js/submodule/GPUComputeSystem.js
import { BoidPositionFragmentShader } from '../shaders/BoidPositionFragmentShader.js';
import { BoidVelocityFragmentShader } from '../shaders/BoidVelocityFragmentShader.js';

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
    uniform_velocity.testing = { value: 1.0 };
    uniform_velocity.seperation_distance = { value: 10.0 };
    uniform_velocity.alignment_distance = { value: 25.0 };
    uniform_velocity.cohesion_distance = { value: 30.0 };
    uniform_velocity.freedom_distance = { value: 0.4 };
    uniform_velocity.predator = { value: new THREE.Vector3() };
    uniform_velocity.globalDrift = { value: new THREE.Vector3() };
    uniform_velocity.leader = { value: new THREE.Vector3() };

    // Nuevos uniforms para realismo dinámico
    uniform_velocity.leaderVelocity = { value: new THREE.Vector3() };
    uniform_velocity.leaderAcceleration = { value: new THREE.Vector3() };
    uniform_velocity.leaderBrakingForce = { value: 0.0 };
    uniform_velocity.leaderTurningForce = { value: 0.0 };
    uniform_velocity.windField = { value: new THREE.Vector3() };
    uniform_velocity.groupInertia = { value: 1.0 };

    uniform_velocity.vortexStrength = { value: 0.0 };
    uniform_velocity.boidSpeed = { value: 1.0 };



    velocity_variable.material.defines.bounds = bounds.toFixed(2);

    velocity_variable.wrapS = THREE.RepeatWrapping;
    velocity_variable.wrapT = THREE.RepeatWrapping;
    position_variable.wrapS = THREE.RepeatWrapping;
    position_variable.wrapT = THREE.RepeatWrapping;

    const error = gpu_allocation.init();
    if (error !== null) {
        console.error(error);
    }
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
    gpu_allocation,
    velocity_variable,
    position_variable,
    uniform_position,
    uniform_velocity,
    currentResolution
};
