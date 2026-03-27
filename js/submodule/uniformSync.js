import { CONFIG } from '../config.js';

function syncBoidUniforms(params) {
    const {
        uniformVelocity,
        activePredators,
        bounds,
        leaderPosition,
        leaderVelocity,
        leaderAcceleration
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
            target.copy(activePredators[i]).divideScalar(bounds);
        } else {
            target.set(9999, 9999, 9999);
        }
    }

    uniformVelocity.leader.value.copy(leaderPosition);
    uniformVelocity.leaderVelocity.value.copy(leaderVelocity);
    uniformVelocity.leaderAcceleration.value.copy(leaderAcceleration);

    let brakingForce = 0.0;
    const leaderSpeed = leaderVelocity.length();
    if (leaderSpeed > 0) {
        const accelAlongVelocity = leaderAcceleration.dot(leaderVelocity) / leaderSpeed;
        brakingForce = Math.max(0.0, -accelAlongVelocity);
    }
    const turningForce = Math.max(0.0, leaderAcceleration.length());
    uniformVelocity.leaderBrakingForce.value = brakingForce;
    uniformVelocity.leaderTurningForce.value = turningForce;
}

export { syncBoidUniforms };
