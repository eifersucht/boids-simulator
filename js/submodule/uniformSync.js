import { CONFIG } from '../config.js';

function syncBoidUniforms(params) {
    const {
        uniformVelocity,
        activePredators,
        leaderPosition
    } = params;

    const maxPredators = CONFIG.predator.maxCount;
    if (
        !uniformVelocity.predators.value ||
        uniformVelocity.predators.value.length !== maxPredators
    ) {
        uniformVelocity.predators.value = [];
        for (let i = 0; i < maxPredators; i++) {
            uniformVelocity.predators.value.push(new THREE.Vector3(9999, 9999, 9999));
        }
    }
    const predatorCount = Math.min(activePredators.length, maxPredators);
    uniformVelocity.predatorCount.value = predatorCount;
    for (let i = 0; i < maxPredators; i++) {
        const target = uniformVelocity.predators.value[i];
        if (i < predatorCount) {
            // Keep predator coordinates in the same world space as birdPosition in the shader.
            target.copy(activePredators[i]);
        } else {
            target.set(9999, 9999, 9999);
        }
    }

    uniformVelocity.leader.value.copy(leaderPosition);
}

export { syncBoidUniforms };
