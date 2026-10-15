import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export async function createMushroomPowerUp(x, y) {
    const group = new THREE.Group();
    const loader = new GLTFLoader();
    let mushroomModel = null;
    let initialZ = 0;

    try {
        const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/mushrooms.glb`);
        mushroomModel = gltf.scene;

        // Apply rotation to align with scene's XY plane ground
        mushroomModel.rotation.x = Math.PI / 2;

        // Scale mushroom to be smaller than the player (player scale is 20)
        mushroomModel.scale.setScalar(112);

        // Calculate Z offset to sit flush on the ground
        const box = new THREE.Box3().setFromObject(mushroomModel);
        initialZ = -box.min.z;
        mushroomModel.position.z = initialZ;

        // Calculate bounding radius for player pickup/activation
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        group.userData.radius = sphere.radius * 0.5;

        group.add(mushroomModel);
    } catch (error) {
        console.error('Error loading mushroom powerup model:', error);
    }

    group.position.set(x, y, 0);
    group.userData.type = 'mushroom';
    group.userData.activated = false;

    return group;
}
