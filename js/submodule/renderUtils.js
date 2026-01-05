// js/submodule/renderUtils.js
function driftUniformUpdater(uniformVelocity, now) {
    const driftSpeed = 0.2;
    uniformVelocity.globalDrift.value.set(
        Math.sin(now * 0.00015) * driftSpeed,
        Math.cos(now * 0.0001) * driftSpeed,
        Math.sin(now * 0.00012) * driftSpeed
    );
}

export {
    driftUniformUpdater
};
