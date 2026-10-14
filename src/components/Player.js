import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Movement constants
const MOVE_SPEED = 6;
const JUMP_HEIGHT = 15;
const JUMP_DISTANCE = 40;
const GRID_SIZE = 1000;
const HALF_GRID_SIZE = GRID_SIZE / 2;
const ATTACK_COOLDOWN = 0.3; // seconds
const ATTACK_RADIUS = 50;
const ATTACK_DURATION = 0.2; // seconds
const COLLISION_THRESHOLD = 0.1;
const OBSTACLE_COLLISION_THRESHOLD = 0.01;

export async function createPlayer() {
    const group = new THREE.Group();
    const loader = new GLTFLoader();
    let playerModel = null;
    let initialZ = 0;

    // Movement state
    const state = {
        isMoving: false,
        progress: 0,
        direction: new THREE.Vector3(),
        startPosition: new THREE.Vector2(),
        targetPosition: new THREE.Vector2(),
        lastAttackTime: -ATTACK_COOLDOWN,
        isAttacking: false,
        attackProgress: 0,
    };

    const inputQueue = [];
    let attackRequested = false;

    // Input collection
    window.addEventListener('keydown', (event) => {
        const directions = {
            'ArrowUp': new THREE.Vector3(0, 1, 0),
            'ArrowDown': new THREE.Vector3(0, -1, 0),
            'ArrowLeft': new THREE.Vector3(-1, 0, 0),
            'ArrowRight': new THREE.Vector3(1, 0, 0),
        };

        if (directions[event.key]) {
            inputQueue.push(directions[event.key]);
        }

        if (event.code === 'Space') {
            attackRequested = true;
        }
    });

    try {
        const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/tode.glb`);
        playerModel = gltf.scene;

        // Add model rotation: model.rotation.x = Math.PI / 2;
        playerModel.rotation.x = Math.PI / 2;
        playerModel.rotation.y = Math.PI; // Face forward initially (positive Y)

        // Scale the model using a scalar of 20
        playerModel.scale.setScalar(20);

        // Calculate the Z-offset based on the model height to ensure Tode sits flush on the ground
        const box = new THREE.Box3().setFromObject(playerModel);
        initialZ = -box.min.z;
        playerModel.position.z = initialZ;

        // Calculate bounding sphere for collision detection
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        // Reduce the radius by a factor to make it tighter (e.g., 0.5)
        group.userData.radius = sphere.radius * 0.5;
        group.add(playerModel);

        group.userData.resetState = () => {
            state.isMoving = false;
            state.progress = 0;
            state.direction.set(0, 0, 0);
            state.startPosition.set(0, 0);
            state.targetPosition.set(0, 0);
            state.isAttacking = false;
            state.attackProgress = 0;
            inputQueue.length = 0;
            attackRequested = false;
            if (playerModel) {
                playerModel.position.z = initialZ;
                playerModel.rotation.y = Math.PI;
            }
            if (boxHelper) {
                boxHelper.update();
            }
        };

        const originalUpdate = group.update;
        group.update = (deltaTime, enemies = [], scene = null) => {
            originalUpdate(deltaTime, enemies, scene);
            boxHelper.update();
        };
    } catch (error) {
        console.error('Error loading model:', error);
    }

    // Attack visual
    const attackGeometry = new THREE.CircleGeometry(ATTACK_RADIUS, 32);
    const attackMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0 });
    const attackMesh = new THREE.Mesh(attackGeometry, attackMaterial);
    attackMesh.position.z = 0.25;
    group.add(attackMesh);

    // Place the group at the center of the scene (default is 0,0,0)
    group.position.set(0, 0, 0);

    group.update = (deltaTime, enemies = [], scene = null, obstacles = []) => {
        // Handle attack request
        const currentTime = performance.now() / 1000;
        let kills = 0;
        if (attackRequested && currentTime - state.lastAttackTime >= ATTACK_COOLDOWN) {
            state.isAttacking = true;
            state.attackProgress = 1;
            state.lastAttackTime = currentTime;

            // Combat logic: detect collisions with enemies
            if (scene) {
                for (let i = enemies.length - 1; i >= 0; i--) {
                    const enemy = enemies[i];
                    const dist = group.position.distanceTo(enemy.position);
                    if (dist <= ATTACK_RADIUS) {
                        scene.remove(enemy);
                        enemies.splice(i, 1);
                        kills++;
                    }
                }
            }
        }
        attackRequested = false;

        // Update attack visual
        if (state.isAttacking) {
            state.attackProgress -= deltaTime / ATTACK_DURATION;
            if (state.attackProgress <= 0) {
                state.attackProgress = 0;
                state.isAttacking = false;
            }
            attackMaterial.opacity = state.attackProgress;
        }

        if (!state.isMoving && inputQueue.length > 0) {
            const nextDirection = inputQueue.shift();
            const targetX = group.position.x + nextDirection.x * JUMP_DISTANCE;
            const targetY = group.position.y + nextDirection.y * JUMP_DISTANCE;

            // Boundary check
            if (Math.abs(targetX) > HALF_GRID_SIZE || Math.abs(targetY) > HALF_GRID_SIZE) {
                return; 
            }

            // Collision check
            let canMove = true;

            // Check against enemies
            for (const enemy of enemies) {
                const enemyPos = new THREE.Vector2(enemy.position.x, enemy.position.y);
                const targetPos = new THREE.Vector2(targetX, targetY);
                const distance = targetPos.distanceTo(enemyPos);
                const minDistance = (group.userData.radius || 0) + (enemy.userData.radius || 0) + COLLISION_THRESHOLD;

                if (distance < minDistance) {
                    canMove = false;
                    break;
                }
            }

            // Check against obstacles
            if (canMove) {
                for (const obstacle of obstacles) {
                    const obstaclePos = new THREE.Vector2(obstacle.position.x, obstacle.position.y);
                    const targetPos = new THREE.Vector2(targetX, targetY);
                    const distance = targetPos.distanceTo(obstaclePos);
                    const minDistance = (group.userData.radius || 0) + (obstacle.userData.radius || 0) + OBSTACLE_COLLISION_THRESHOLD;

                    if (distance < minDistance) {
                        canMove = false;
                        break;
                    }
                }
            }

            if (canMove) {
                state.isMoving = true;
                state.progress = 0;
                state.direction.copy(nextDirection);
                state.startPosition.set(group.position.x, group.position.y);
                state.targetPosition.set(targetX, targetY);

                // Rotate the model to face the direction of movement
                if (playerModel) {
                    // Adjust rotation: Y+ is 180 degrees (Math.PI)
                    const angle = Math.atan2(nextDirection.y, nextDirection.x) - Math.PI / 2 + Math.PI;
                    playerModel.rotation.y = angle;
                }
            }
        }

        if (state.isMoving) {
            state.progress += MOVE_SPEED * deltaTime;

            if (state.progress >= 1) {
                state.progress = 1;
                state.isMoving = false;
            }

            // Interpolate position
            group.position.x = THREE.MathUtils.lerp(state.startPosition.x, state.targetPosition.x, state.progress);
            group.position.y = THREE.MathUtils.lerp(state.startPosition.y, state.targetPosition.y, state.progress);

            // Jump logic (Z-axis)
            if (playerModel) {
                const jumpZ = Math.sin(state.progress * Math.PI) * JUMP_HEIGHT;
                playerModel.position.z = initialZ + jumpZ;
            }
        }

        return kills;
    };

    return group;
}
