import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { checkCircleCollision, isWithinAttackRange, resolveAttack } from '../utils/collision.js';

describe('Attack Mechanics', () => {
    const ATTACK_RADIUS = 50;

    it('should hit an enemy within attack radius', () => {
        const playerPos = new THREE.Vector3(0, 0, 0);
        const enemyPos = new THREE.Vector3(30, 20, 0); // Distance = sqrt(900 + 400) ≈ 36.05 <= 50

        expect(isWithinAttackRange(playerPos, enemyPos, ATTACK_RADIUS)).toBe(true);
    });

    it('should miss an enemy outside attack radius', () => {
        const playerPos = new THREE.Vector3(0, 0, 0);
        const enemyPos = new THREE.Vector3(45, 45, 0); // Distance = sqrt(2025 + 2025) ≈ 63.64 > 50

        expect(isWithinAttackRange(playerPos, enemyPos, ATTACK_RADIUS)).toBe(false);
    });

    it('should correctly eliminate multiple enemies in range and keep enemies outside range', () => {
        const playerPos = new THREE.Vector3(0, 0, 0);
        const enemies = [
            { id: 1, position: new THREE.Vector3(10, 10, 0) },   // In range (~14.1)
            { id: 2, position: new THREE.Vector3(100, 100, 0) }, // Out of range (~141.4)
            { id: 3, position: new THREE.Vector3(-20, 30, 0) },  // In range (~36.05)
        ];

        const result = resolveAttack(playerPos, enemies, ATTACK_RADIUS);

        expect(result.kills).toBe(2);
        expect(result.remainingEnemies.length).toBe(1);
        expect(result.remainingEnemies[0].id).toBe(2);
    });
});

describe('Collision Detection', () => {
    it('should detect collision when entities overlap', () => {
        const playerPos = { x: 0, y: 0 };
        const playerRadius = 15;

        const enemyPos = { x: 20, y: 0 };
        const enemyRadius = 10;
        // Combined radii = 25, Distance = 20 -> Colliding

        expect(checkCircleCollision(playerPos, playerRadius, enemyPos, enemyRadius, 0.1)).toBe(true);
    });

    it('should not detect collision when entities are separated', () => {
        const playerPos = { x: 0, y: 0 };
        const playerRadius = 15;

        const obstaclePos = { x: 50, y: 0 };
        const obstacleRadius = 20;
        // Combined radii = 35, Distance = 50 -> Safe

        expect(checkCircleCollision(playerPos, playerRadius, obstaclePos, obstacleRadius, 0.01)).toBe(false);
    });

    it('should detect powerup pickup collision when player enters powerup area', () => {
        const playerPos = { x: 100, y: 100 };
        const playerRadius = 15;

        const powerUpPos = { x: 110, y: 105 };
        const powerUpRadius = 10;
        // Combined radius = 25, Distance ≈ 11.18 -> Collected

        expect(checkCircleCollision(playerPos, playerRadius, powerUpPos, powerUpRadius)).toBe(true);
    });
});