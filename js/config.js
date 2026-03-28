// Central config for the simulation. Keep values here so behavior is easy to tune.
// Notes use ASCII only to avoid encoding issues.

export const CONFIG = {
    simulation: {
        // Simulation box half-size. Increase => more space, lower density. Decrease => tighter flock.
        bounds: 600,

        // Default grid side used when no hash or UI is present. Boid count = grid^2.
        defaultGridSize: 64,

        // Clamp delta time (seconds). Increase => allows bigger time steps. Decrease => more stability.
        maxDeltaSeconds: 1
    },

    // Recording settings.
    recording: {
        fps: 60 // Increase => smoother capture, higher CPU. Decrease => lighter capture.
    },

    performance: {
        readbackOptimizationEnabled: true, // Enable to reduce GPU->CPU readback frequency.
        readbackStride: 2, // Readback every N frames when optimization is enabled.
        neighborSampleCount: 128, // Number of sampled neighbors in velocity shader (higher => more fidelity, more GPU cost).
        presets: {
            quality: {
                readbackOptimizationEnabled: false,
                readbackStride: 1,
                neighborSampleCount: 160
            },
            balanced: {
                readbackOptimizationEnabled: true,
                readbackStride: 2,
                neighborSampleCount: 128
            },
            performance: {
                readbackOptimizationEnabled: true,
                readbackStride: 3,
                neighborSampleCount: 96
            }
        }
    },

    // Boid visual defaults.
    boids: {
        sizeDefault: 3, // Increase => bigger boids. Decrease => smaller boids.
        speedDefault: 1.0, // Global speed multiplier. Increase => faster flock.
        groupInertia: 1.0, // If used in shader: 1 = follow new velocity fully, 0 = keep old velocity.

        // Neighbor distance thresholds.
        separationDistance: 10.0, // Increase => more personal space. Decrease => tighter packing.
        alignmentDistance: 25.0, // Increase => stronger alignment radius. Decrease => more variation.
        cohesionDistance: 30.0, // Increase => stronger attraction radius. Decrease => looser group.
        freedomDistance: 0.4 // Increase => more independence. Decrease => more cohesion.
    },

    // Leader (guide boid) behavior.
    leader: {
        speed: 150, // Increase => faster leader movement.
        turnLerp: 0.5, // Increase => quicker turning. Decrease => smoother turns.
        changeIntervalMin: 8.0, // Increase => changes direction less often.
        changeIntervalJitter: 4.0, // Increase => more randomness in change timing.
        targetScale: { x: 2.0, y: 1.0, z: 2.0 } // Increase axes => wider target spread.
    },

    // Predator influence shared by all predators (shader only).
    predator: {
        influenceRange: 120.0, // Increase => predators affect boids from farther away.
        influenceStrength: 180.0, // Increase => stronger avoidance force.
        speedLimitBoost: 10.0, // Increase => higher max speed when escaping.
        maxCount: 4 // Increase => more predators sent to shader (also update MAX_PREDATORS).
    },

    // Predator instances (each one can be enabled from HUD).
    predators: [
        {
            name: 'Predator 1',
            enabled: true,
            visible: false,
            aggression: 2.0, // Increase => faster predator.
            startPosition: { x: 200, y: 0, z: 0 },
            randomVelocityScale: 50, // Increase => more initial randomness.
            noiseScale: { x: 0.2, y: 0.1, z: 0.2 }, // Increase => noisier pursuit.
            baseSpeed: 100, // Increase => faster predator baseline speed.
            distanceSpeedFactor: 0.5, // Increase => accelerates more when far from center.
            distanceSpeedClamp: 300, // Increase => allows higher distance-based speed.
            changeIntervalMin: 2.0, // Increase => change direction less often.
            changeIntervalJitter: 2.0 // Increase => more randomness in change timing.
        },
        {
            name: 'Predator 2',
            enabled: false,
            visible: false,
            aggression: 2.0,
            startPosition: { x: -200, y: 0, z: 0 },
            randomVelocityScale: 50,
            noiseScale: { x: 0.2, y: 0.1, z: 0.2 },
            baseSpeed: 100,
            distanceSpeedFactor: 0.5,
            distanceSpeedClamp: 300,
            changeIntervalMin: 2.0,
            changeIntervalJitter: 2.0
        }
    ],

    // Shader tuning (kept here to keep behavior reproducible).
    shader: {
        speedLimit: 10.0, // Increase => higher max boid speed.
        centerPullStrength: 0.0025, // Increase => stronger pull to center.
        centerYScale: 0.5, // Increase => vertical pull weight.
        separationStrength: 1.5, // Increase => stronger short-range repulsion.
        cohesionStrength: 0.5, // Increase => stronger group attraction.
        alignmentStrength: 0.5, // Increase => stronger velocity alignment.
        leaderAttractStrength: 4.0, // Increase => stronger leader attraction.
        randomMix: 0.2, // Increase => more randomness in motion.
        vortexForceScale: 15.0, // Increase => stronger vortex effect.
        gravityStrength: 0.008 // Increase => stronger vertical damping.
    },

    environment: {
        // Global drift (wind) strength.
        driftSpeed: 0.2 // Increase => stronger ambient drift.
    }
};
