import * as THREE from 'three';

/**
 * Checks if two circular 2D entities collide given their radii and threshold.
 */
export function checkCircleCollision(posA, radiusA, posB, radiusB, threshold = 0) {
    const dist = new THREE.Vector2(posA.x, posA.y).distanceTo(new THREE.Vector2(posB.x, posB.y));
    const minDistance = (radiusA || 0) + (radiusB || 0) + threshold;
    return dist < minDistance;
}

/**
 * Checks if an enemy is within player's attack radius.
 */
export function isWithinAttackRange(playerPos, enemyPos, attackRadius = 50) {
    const p = new THREE.Vector2(playerPos.x, playerPos.y);
    const e = new THREE.Vector2(enemyPos.x, enemyPos.y);
    return p.distanceTo(e) <= attackRadius;
}

/**
 * Filters out killed enemies based on attack position and radius.
 */
export function resolveAttack(playerPos, enemies, attackRadius = 50) {
    const remainingEnemies = [];
    let kills = 0;

    for (const enemy of enemies) {
        if (isWithinAttackRange(playerPos, enemy.position, attackRadius)) {
            kills++;
        } else {
            remainingEnemies.push(enemy);
        }
    }

    return { kills, remainingEnemies };
}