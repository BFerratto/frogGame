import * as THREE from 'three';

export function createCamera() {
    const camera = new THREE.PerspectiveCamera(
        30,
        window.innerWidth / window.innerHeight,
        0.1,
        9000
    );
    camera.position.set(300, -300, 300);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });

    return camera;
}
