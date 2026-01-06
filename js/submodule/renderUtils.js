// js/submodule/renderUtils.js
import { CONFIG } from '../config.js';

function driftUniformUpdater(uniformVelocity, now) {
    const driftSpeed = CONFIG.driftSpeed;
    uniformVelocity.globalDrift.value.set(
        Math.sin(now * 0.00015) * driftSpeed,
        Math.cos(now * 0.0001) * driftSpeed,
        Math.sin(now * 0.00012) * driftSpeed
    );
}

export {
    driftUniformUpdater
};
