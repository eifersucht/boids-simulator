// js/submodule/lighting.js
let spotLight;
let guiControls;

function createLighting(scene) {
    guiControls = {
        rotationX: 0.0,
        rotationY: 0.0,
        rotationZ: 0.0,
        lightX: 19,
        lightY: 47,
        lightZ: 19,
        intensity: 2.5,
        distance: 373,
        angle: 1.6,
        exponent: 38,
        shadowCameraNear: 34,
        shadowCameraFar: 2635,
        shadowCameraFov: 68,
        shadowCameraVisible: false, // Este valor ya no se usa directamente, pero lo dejamos
        shadowMapWidth: 512,
        shadowMapHeight: 512,
        shadowBias: 0.00,
        shadowDarkness: 0.11 // Nota: también deprecated, simplemente lo ignoraremos
    };

    spotLight = new THREE.SpotLight(0xffffff);
    spotLight.castShadow = true;
    spotLight.position.set(guiControls.lightX, guiControls.lightY, guiControls.lightZ);

    spotLight.intensity = guiControls.intensity;
    spotLight.distance = guiControls.distance;
    spotLight.angle = guiControls.angle;
    spotLight.exponent = guiControls.exponent; // Obsoleto pero no rompe
    spotLight.shadow.camera.near = guiControls.shadowCameraNear;
    spotLight.shadow.camera.far = guiControls.shadowCameraFar;
    spotLight.shadow.camera.fov = guiControls.shadowCameraFov;
    spotLight.shadow.bias = guiControls.shadowBias;
    
    // No hacemos nada con shadowDarkness ni shadowCameraVisible porque ya no existen.

    scene.add(spotLight);
}

export {
    createLighting,
    spotLight,
    guiControls
};
