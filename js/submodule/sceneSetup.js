// OrbitControls is loaded globally, no import needed.

let scene, camera, renderer, controls;

function initScene() {
    scene = new THREE.Scene();
    scene.background = null; // Real transparent background.

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        1,
        3000
    );
    camera.position.set(600, 600, 600);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // Alpha enabled.
    renderer.setClearColor(0x000000, 0); // Fully transparent clear.
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);

    const angleOffset = Math.PI / 36; // 5 degrees in radians.
    controls.minPolarAngle = Math.PI / 2 - angleOffset; // 85 degrees.
    controls.maxPolarAngle = Math.PI / 2 + angleOffset; // 95 degrees.
}

function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
}

export { initScene, onWindowResize, scene, camera, renderer };
