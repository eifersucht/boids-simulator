# Flocking Simulation

Simulacion de boids en Three.js con computacion GPU para velocidad/posicion y render de mallas en CPU.

## Arranque local

Desde la raiz del proyecto:

```powershell
python -m http.server 8000
```

Abrir en navegador:

```text
http://localhost:8000
```

Verificacion rapida:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/quick-check.ps1
```

## Estructura principal

- `index.html`: carga de scripts base y entrada ESM.
- `css/style.css`: estilos de HUD y panel de grabacion.
- `js/main.js`: bootstrap, loop de render, sync de boids.
- `js/config.js`: configuracion global de simulacion, boids, shader y depredadores.
- `js/submodule/sceneSetup.js`: escena, camara, renderer y orbit controls.
- `js/submodule/GPUComputeSystem.js`: variables de GPUComputationRenderer y uniforms.
- `js/submodule/birdSystem.js`: boids visuales, lider, depredadores y HUD.
- `js/submodule/uniformSync.js`: sincronizacion CPU->GPU de uniforms dinamicos.
- `js/submodule/recording.js`: grabacion de video y controles de teclado.
- `js/submodule/renderUtils.js`: utilidades de drift/viento.
- `js/shaders/BoidVelocityFragmentShader.js`: comportamiento de flocking.
- `js/shaders/BoidPositionFragmentShader.js`: integracion de posicion.

## Controles

- `+` / `-`: subir/bajar velocidad del lider.
- `R`: reset de velocidad del lider.
- `L`: mostrar/ocultar lider.
- `P`: activar/desactivar depredadores.
- `V`: iniciar grabacion.
- `S`: detener grabacion.

## Notas tecnicas

- La simulacion se calcula en GPU y la posicion final se lee cada frame para actualizar mallas.
- `CONFIG.predator.maxCount` define el tamano de arreglo de depredadores en shader.
- El HUD permite cambiar cantidad de boids, velocidad global, tamano y estado de depredadores.
