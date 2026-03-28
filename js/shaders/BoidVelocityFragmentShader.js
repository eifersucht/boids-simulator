// js/shaders/BoidVelocityFragmentShader.js

import { CONFIG } from '../config.js';

const MAX_PREDATORS = Math.max(1, Math.floor(CONFIG.predator?.maxCount || 1));
const MAX_NEIGHBOR_SAMPLES = 256;

export const BoidVelocityFragmentShader = `
    #define MAX_PREDATORS ${MAX_PREDATORS}
    #define MAX_NEIGHBOR_SAMPLES ${MAX_NEIGHBOR_SAMPLES}
    uniform float clock;
    uniform float del_change;
    uniform float seperation_distance;
    uniform float alignment_distance;
    uniform float cohesion_distance;
    uniform vec3 predators[MAX_PREDATORS];
    uniform int predatorCount;
    uniform vec3 globalDrift;
    uniform vec3 leader;
    uniform vec3 windField;
    uniform float vortexStrength;
    uniform float boidSpeed;
    uniform float predatorRange;
    uniform float predatorStrength;
    uniform float predatorSpeedLimitBoost;
    uniform float speedLimit;
    uniform float centerPullStrength;
    uniform float centerYScale;
    uniform float separationStrength;
    uniform float cohesionStrength;
    uniform float alignmentStrength;
    uniform float leaderAttractStrength;
    uniform float randomMix;
    uniform float vortexForceScale;
    uniform float gravityStrength;
    uniform int neighborSampleCount;

    float zoneRadius;
    float zoneRadiusSquared;
    float separationThresh;
    vec3 safeNormalize(vec3 v) {
        float lenSq = dot(v, v);
        if (lenSq < 1e-8) return vec3(0.0);
        return v * inversesqrt(lenSq);
    }
    float hash11(float p) {
        p = fract(p * 0.1031);
        p *= p + 33.33;
        p *= p + p;
        return fract(p);
    }
    vec2 hash22(float p) {
        return vec2(hash11(p + 1.7), hash11(p + 9.2));
    }
    void main() {
        zoneRadius = seperation_distance + alignment_distance + cohesion_distance;
        separationThresh = seperation_distance / zoneRadius;
        zoneRadiusSquared = zoneRadius * zoneRadius;

        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec3 birdPosition = texture2D(PositionTexture, uv).xyz;
        vec3 birdVelocity = texture2D(VelocityTexture, uv).xyz;

        vec3 velocity = birdVelocity;
        float limit = speedLimit;

        for (int i = 0; i < MAX_PREDATORS; i++) {
            if (i >= predatorCount) {
                break;
            }
            vec3 predatorDir = birdPosition - predators[i];
            float predatorDist = length(predatorDir);
            if (predatorDist < predatorRange) {
                float strength = (1.0 - (predatorDist / predatorRange)) * del_change * predatorStrength;
                velocity += safeNormalize(predatorDir) * strength;
                limit += predatorSpeedLimitBoost;
            }
        }

        vec3 toCenter = birdPosition * centerPullStrength;
        toCenter.y *= centerYScale;
        velocity -= toCenter * del_change;

        vec3 neighborhoodCenter = vec3(0.0);
        vec3 averageVelocity = vec3(0.0);
        float neighborCount = 0.0;

        float seed = dot(birdPosition, vec3(0.173, 0.319, 0.271)) + clock * 0.0001;
        for (int i = 0; i < MAX_NEIGHBOR_SAMPLES; i++) {
            if (i >= neighborSampleCount) {
                break;
            }
            vec2 ref = hash22(seed + float(i) * 1.61803);
            vec3 otherPos = texture2D(PositionTexture, ref).xyz;
            vec3 otherVel = texture2D(VelocityTexture, ref).xyz;

            vec3 offset = otherPos - birdPosition;
            offset.y *= 0.5;
            float distSq = dot(offset, offset);

            if (distSq > 0.0001 && distSq < zoneRadiusSquared) {
                neighborhoodCenter += otherPos;
                averageVelocity += otherVel;
                neighborCount += 1.0;

                if (distSq < separationThresh * zoneRadiusSquared) {
                    velocity -= safeNormalize(offset) * del_change * separationStrength;
                }
            }
        }

        if (neighborCount > 0.0) {
            neighborhoodCenter /= neighborCount;
            averageVelocity /= neighborCount;

            vec3 toNeighborsCenter = neighborhoodCenter - birdPosition;
            toNeighborsCenter.y *= centerYScale;
            velocity += safeNormalize(toNeighborsCenter) * del_change * cohesionStrength;
            velocity += safeNormalize(averageVelocity) * del_change * alignmentStrength;
        }

        vec3 toLeader = leader - birdPosition;
        velocity += safeNormalize(toLeader) * del_change * leaderAttractStrength;

        float time = clock * 0.001;
        vec3 randomDir = safeNormalize(vec3(
            sin(time + birdPosition.y * 0.5),
            cos(time + birdPosition.x * 0.8),
            sin(time + birdPosition.z * 0.6)
        ));
        velocity = mix(velocity, velocity + randomDir, randomMix * del_change);

        if (vortexStrength > 0.0) {
            vec3 toSelf = birdPosition - leader;
            float distVortex = length(toSelf) + 0.01;
            vec3 vortexForce = safeNormalize(cross(toSelf, vec3(0.0, 1.0, 0.0))) / distVortex;
            velocity += vortexForce * vortexStrength * del_change * vortexForceScale;
        }

        velocity.y -= birdPosition.y * gravityStrength * del_change;
        velocity += safeNormalize(globalDrift + windField) * del_change;

        // Aplica multiplicador ANTES del límite
        velocity *= boidSpeed;

        float velLength = length(velocity);
        if (velLength > limit) {
            velocity = safeNormalize(velocity) * limit;
        }

        gl_FragColor = vec4(velocity, 1.0);
    }
`;
