import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import './style.css';
import { createRenderer } from './components/Renderer.js';
import { createCamera } from './components/Camera.js';
import { createPlayer } from './components/Player.js';
import { createEnemy } from './components/Enemy.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

// Grid pattern
const gridGroup = new THREE.Group();
const gridSize = 1000;
const divisions = 20;
const tileSize = gridSize / divisions;
const colors = [0x2d5a27, 0x35662e]; // Green tones

for (let i = 0; i < divisions; i++) {
    for (let j = 0; j < divisions; j++) {
        const geometry = new THREE.PlaneGeometry(tileSize, tileSize);
        const material = new THREE.MeshBasicMaterial({ 
            color: colors[(i + j) % 2],
            side: THREE.DoubleSide 
        });
        const tile = new THREE.Mesh(geometry, material);
        tile.position.set(
            (i - divisions / 2 + 0.5) * tileSize,
            (j - divisions / 2 + 0.5) * tileSize,
            -0.1 // Slightly below ground level
        );
        gridGroup.add(tile);
    }
}
scene.add(gridGroup);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(-100, -100, 200);
scene.add(directionalLight);

// Renderer
const renderer = createRenderer();

// Camera
const camera = createCamera();

// Spawning constants
const SPAWN_DELAY = 4; // seconds
const SPAWN_LOCATIONS = [
    { x: 500, y: 500 },
    { x: -500, y: 500 },
    { x: 500, y: -500 },
    { x: -500, y: -500 }
];

// Score constants
const SCORE_PER_SECOND = 0.1;
const SCORE_PER_KILL = 10;

let highScore = 0;
try {
    const saved = localStorage.getItem('frog_game_high_score');
    if (saved !== null) {
        highScore = parseInt(saved, 10) || 0;
    }
} catch (e) {
    console.warn('Could not read high score from localStorage:', e);
}

// Player
async function init() {
    const player = await createPlayer();
    scene.add(player);

    let enemies = [];
    let obstacles = [];
    let lastSpawnTime = 0;
    let gameOver = false;
    let score = 0;
    let enemiesKilled = 0;

    // Load obstacles
    const loader = new GLTFLoader();
    let houseBase = null;
    let treeBase = null;

    async function spawnObstacles() {
        // Clear existing obstacles
        obstacles.forEach(obs => scene.remove(obs));
        obstacles = [];

        if (!houseBase) {
            try {
                const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/small_house.glb`);
                houseBase = gltf.scene;
                houseBase.rotation.x = Math.PI / 2;
                houseBase.scale.setScalar(50);
            } catch (error) {
                console.error('Error loading house obstacles:', error);
                return;
            }
        }

        if (!treeBase) {
            try {
                const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/tree.glb`);
                treeBase = gltf.scene;
                treeBase.rotation.x = Math.PI / 2;
                treeBase.scale.setScalar(6);
            } catch (error) {
                console.error('Error loading tree obstacles:', error);
                return;
            }
        }

        const obstacleConfigs = [
            { base: houseBase, count: 6 },
            { base: treeBase, count: 6 }
        ];

        for (const config of obstacleConfigs) {
            for (let i = 0; i < config.count; i++) {
                const obstacle = config.base.clone();
                
                let x, y;
                do {
                    x = (Math.random() - 0.5) * 900;
                    y = (Math.random() - 0.5) * 900;
                } while (Math.sqrt(x*x + y*y) < 100);

                obstacle.position.set(x, y, 0);
                
                const box = new THREE.Box3().setFromObject(obstacle);
                obstacle.position.z = -box.min.z;
                
                const sphere = new THREE.Sphere();
                box.getBoundingSphere(sphere);
                // Reduce the radius by a factor to make it tighter (e.g., 0.5) and match 2D footprint
                obstacle.userData.radius = sphere.radius * 0.5;
                
                scene.add(obstacle);
                obstacles.push(obstacle);
            }
        }
    }

    await spawnObstacles();

    const gameOverUI = document.getElementById('game-over');
    const finalScoreUI = document.getElementById('final-score');
    const restartButton = document.getElementById('restart-button');
    const scoreUI = document.querySelector('.score');
    const highScoreUI = document.getElementById('high-score');
    const killsUI = document.getElementById('kills');

    if (highScoreUI) {
        highScoreUI.textContent = `High Score: ${highScore}`;
    }
    if (killsUI) {
        killsUI.textContent = `Kills: ${enemiesKilled}`;
    }

    function checkHighScore(currentScore) {
        const scoreInt = Math.floor(currentScore);
        if (scoreInt > highScore) {
            highScore = scoreInt;
            try {
                localStorage.setItem('frog_game_high_score', highScore.toString());
            } catch (e) {
                console.warn('Could not save high score to localStorage:', e);
            }
            if (highScoreUI) {
                highScoreUI.textContent = `High Score: ${highScore}`;
            }
        }
    }

    function resetGame() {
        gameOver = false;
        gameOverUI.style.display = 'none';
        score = 0;
        enemiesKilled = 0;
        if (scoreUI) {
            scoreUI.textContent = 'Score: 0';
        }
        if (killsUI) {
            killsUI.textContent = 'Kills: 0';
        }
        
        // Remove enemies from scene
        enemies.forEach(enemy => scene.remove(enemy));
        enemies = [];
        
        // Randomize obstacles
        spawnObstacles();
        
        // Reset player position
        player.position.set(0, 0, 0);
        if (player.userData.resetState) {
            player.userData.resetState();
        }

        lastSpawnTime = clock.getElapsedTime();
    }

    restartButton.addEventListener('click', resetGame);

    // Add the camera as a child of the player group
    player.add(camera);

    // Basic render loop
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
        const deltaTime = clock.getDelta();
        const elapsedTime = clock.getElapsedTime();

        if (!gameOver) {
            // Update score based on survival time
            score += deltaTime * SCORE_PER_SECOND;
            if (scoreUI) {
                scoreUI.textContent = `Score: ${Math.floor(score)}`;
            }
            checkHighScore(score);

            // Update player
            if (player.update) {
                const kills = player.update(deltaTime, enemies, scene, obstacles);
                if (kills > 0) {
                    enemiesKilled += kills;
                    score += kills * SCORE_PER_KILL;
                    if (scoreUI) {
                        scoreUI.textContent = `Score: ${Math.floor(score)}`;
                    }
                    if (killsUI) {
                        killsUI.textContent = `Kills: ${enemiesKilled}`;
                    }
                    checkHighScore(score);
                }
            }

            // Spawning logic
            if (elapsedTime - lastSpawnTime > SPAWN_DELAY) {
                const spawnPos = SPAWN_LOCATIONS[Math.floor(Math.random() * SPAWN_LOCATIONS.length)];
                createEnemy(spawnPos.x, spawnPos.y).then(enemy => {
                    if (!gameOver) {
                        scene.add(enemy);
                        enemies.push(enemy);
                    }
                });
                lastSpawnTime = elapsedTime;
            }

            // Update enemies
            enemies.forEach(enemy => {
                if (enemy.update) {
                    enemy.update(deltaTime, player, enemies, obstacles);
                }

                // Check if enemy hit the player
                const dist = enemy.position.distanceTo(player.position);
                const COLLISION_THRESHOLD = 2;
                const minDistance = (enemy.userData.radius || 15) + (player.userData.radius || 15) + COLLISION_THRESHOLD;
                if (dist < minDistance) {
                    gameOver = true;
                    checkHighScore(score);
                    if (finalScoreUI) {
                        finalScoreUI.textContent = `Score: ${Math.floor(score)}`;
                    }
                    gameOverUI.style.display = 'block';
                    console.log('Game Over: Enemy hit the player!');
                }
            });
        }

        renderer.render(scene, camera);
    });
}

init();

