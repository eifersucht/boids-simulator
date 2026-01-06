// No importamos OrbitControls, ya sabemos que está cargado globalmente

let scene, camera, renderer, controls;

function initScene() {
    scene = new THREE.Scene();
    scene.background = null; // <-- Fondo transparente real

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        1,
        3000
    );
    camera.position.set(600, 600, 600);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // <-- Alpha activado
    renderer.setClearColor(0x000000, 0); // <-- Totalmente transparente
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);

    const angleOffset = Math.PI / 36; // 5 grados en radianes
    controls.minPolarAngle = Math.PI / 2 - angleOffset; // 85 grados
    controls.maxPolarAngle = Math.PI / 2 + angleOffset; // 95 grados
}

function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
}

function render() {
    renderer.render(scene, camera);
}

export { initScene, onWindowResize, scene, camera, renderer };
