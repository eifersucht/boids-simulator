# Flocking Simulation

Boids simulation in Three.js with GPU computation for velocity/position and CPU mesh rendering.

## Local run (Node + Tailwind)

From the repository root:

```bash
npm install
npm run dev
```

Open in browser:

```text
http://localhost:5173/
```

Production build:

```bash
npm run build
npm run preview
```

Quick check:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/quick-check.ps1
```

## Main structure

- `index.html`: base script loading and ESM entry point.
- `css/style.css`: HUD and recording panel styles.
- `js/main.js`: bootstrap, render loop, boid sync.
- `js/config.js`: global simulation, boid, shader, and predator configuration.
- `js/submodule/sceneSetup.js`: scene, camera, renderer, and orbit controls.
- `js/submodule/GPUComputeSystem.js`: GPUComputationRenderer variables and uniforms.
- `js/submodule/birdSystem.js`: visual boids, leader, predators, and HUD.
- `js/submodule/uniformSync.js`: CPU->GPU dynamic uniform synchronization.
- `js/submodule/recording.js`: video recording and keyboard controls.
- `js/submodule/renderUtils.js`: drift/wind utilities.
- `js/shaders/BoidVelocityFragmentShader.js`: flocking behavior.
- `js/shaders/BoidPositionFragmentShader.js`: position integration.

## Controls

- `+` / `-`: increase/decrease leader speed.
- `R`: reset leader speed.
- `L`: show/hide leader.
- `P`: enable/disable predators.
- `V`: start recording.
- `S`: stop recording.

## Technical notes

- Simulation runs on GPU; final positions are read each frame to update meshes.
- `CONFIG.predator.maxCount` defines predator array size in the shader.
- HUD lets you change boid count, global speed, size, and predator state.
- `Performance mode` in HUD updates `CONFIG.performance` at runtime:
  - `Quality`: full readback.
  - `Balanced`: readback every 2 frames.
  - `Performance`: readback every 3 frames.
