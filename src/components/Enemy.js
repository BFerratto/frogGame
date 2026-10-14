import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ENEMY_SPEED = 1.7;
const GRID_SIZE = 1000;
const HALF_GRID_SIZE = GRID_SIZE / 2;
const COLLISION_THRESHOLD = 0.1;
const OBSTACLE_COLLISION_THRESHOLD = 0.01;

export async function createEnemy(x, y) {
    const group = new THREE.Group();
    const loader = new GLTFLoader();
    let enemyModel = null;
    let initialZ = 0;

    try {
        const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/enemy.glb`);
        enemyModel = gltf.scene;

        // Positioning: Apply a rotation of model.rotation.x = Math.PI / 2;
        enemyModel.rotation.x = Math.PI / 2;
        
        // Set the model scale using a scalar of 5
        enemyModel.scale.setScalar(5);

        // Calculate the Z offset based on the height of the model to position the model on top of the ground
        const box = new THREE.Box3().setFromObject(enemyModel);
        initialZ = -box.min.z;
        enemyModel.position.z = initialZ;

        // Calculate bounding sphere for collision detection
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        // Reduce the radius by a factor to make it tighter (e.g., 0.7)
        group.userData.radius = sphere.radius * 0.7;

        group.add(enemyModel);
    } catch (error) {
        console.error('Error loading enemy model:', error);
    }

    group.position.set(x, y, 0);

    group.update = (deltaTime, player, allEnemies = [], obstacles = []) => {
        if (!enemyModel || !player) return;

        // Calculate direction to player in XY plane
        const direction = new THREE.Vector3().subVectors(player.position, group.position);
        direction.z = 0; // Keep movement in XY plane
        
        if (direction.length() > 0.1) {
            direction.normalize();

            const moveStep = direction.clone().multiplyScalar(ENEMY_SPEED * deltaTime * 60);
            const nextPosition = group.position.clone().add(moveStep);

            // Boundary check
            if (Math.abs(nextPosition.x) > HALF_GRID_SIZE) {
                nextPosition.x = Math.sign(nextPosition.x) * HALF_GRID_SIZE;
            }
            if (Math.abs(nextPosition.y) > HALF_GRID_SIZE) {
                nextPosition.y = Math.sign(nextPosition.y) * HALF_GRID_SIZE;
            }

            // Collision check
            let canMove = true;

            // Check against player
            const distToPlayer = new THREE.Vector2(nextPosition.x, nextPosition.y)
                .distanceTo(new THREE.Vector2(player.position.x, player.position.y));
            const minPlayerDist = (group.userData.radius || 0) + (player.userData.radius || 0) + COLLISION_THRESHOLD;
            
            if (distToPlayer < minPlayerDist) {
                canMove = false;
            }

            // Check against other enemies
            if (canMove) {
                for (const other of allEnemies) {
                    if (other === group) continue;

                    const distToOther = new THREE.Vector2(nextPosition.x, nextPosition.y)
                        .distanceTo(new THREE.Vector2(other.position.x, other.position.y));
                    const minOtherDist = (group.userData.radius || 0) + (other.userData.radius || 0) + COLLISION_THRESHOLD;

                    if (distToOther < minOtherDist) {
                        canMove = false;
                        break;
                    }
                }
            }

            // Check against obstacles
            if (canMove) {
                for (const obstacle of obstacles) {
                    const distToObstacle = new THREE.Vector2(nextPosition.x, nextPosition.y)
                        .distanceTo(new THREE.Vector2(obstacle.position.x, obstacle.position.y));
                    const minObstacleDist = (group.userData.radius || 0) + (obstacle.userData.radius || 0) + OBSTACLE_COLLISION_THRESHOLD;

                    if (distToObstacle < minObstacleDist) {
                        canMove = false;
                        break;
                    }
                }
            }

            if (canMove) {
                // Update position
                group.position.copy(nextPosition);

                // Rotate enemy to face the player while moving
                // Using Math.atan2 for XY plane rotation
                const angle = Math.atan2(direction.y, direction.x) - Math.PI / 2;
                enemyModel.rotation.y = angle;
            }
        }
    };

    return group;
}
