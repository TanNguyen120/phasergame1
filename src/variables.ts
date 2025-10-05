/**
 * GAME VARIABLES CONFIGURATION FILE
 * =================================
 *
 * This file contains all the game settings and ship configurations.
 * It's like a control panel where you can easily adjust:
 * - Ship speeds, health, and weapon stats
 * - Bullet properties
 * - AI behavior settings
 *
 * Why separate this file? It makes it easy to balance the game
 * without digging through complex game logic code.
 *
 * HOW TO MODIFY VALUES:
 * - Change numbers to make ships faster/slower, stronger/weaker
 * - Colors use hex format: 0xRRGGBB (Red, Green, Blue)
 * - All distances are in pixels
 * - Time values are in milliseconds (1000ms = 1 second)
 */

export const VARIABLES = {
    // ============================================
    // SHIP CONFIGURATIONS
    // ============================================
    // Each ship type has different stats that affect gameplay

    corvette: {
        // Fast, light ship - good for quick attacks
        name: 'Corvette',
        speed: 30, // How fast the ship moves (pixels per second)
        acceleration: 150, // How quickly it speeds up/slows down (px/s^2)
        size: 24, // Ship size in pixels (affects collision detection)
        color: 0x39ff14, // Green color (hex format: 0xRRGGBB)
        shape: 'triangle', // Visual shape of the ship
        health: 100, // How much damage the ship can take
        rotationSpeed: 0.2, // How fast the ship rotates (radians per second)
        weapon: {
            fireRate: 1, // How many bullets per second it can shoot
            damage: 1, // How much damage each bullet does
            range: 150, // How far bullets can travel (pixels)
        },
    },

    cruiser: {
        // Slower, heavier ship - more health and damage
        name: 'Cruiser',
        speed: 15, // Slower than corvette but more durable
        acceleration: 100, // Takes longer to speed up/slow down
        size: 24, // Same size as corvette
        color: 0x39ff14, // Same green color as player ships
        shape: 'square', // Square shape to distinguish from corvette
        health: 150, // More health than corvette
        rotationSpeed: 0.5, // Slower rotation than corvette
        weapon: {
            fireRate: 0.5, // Shoots slower than corvette
            damage: 1, // But does more damage per shot
            range: 200, // Longer range than corvette
        },
    },

    enemy: {
        // Enemy ship - controlled by AI, not player
        name: 'Enemy',
        speed: 10, // Medium speed between corvette and cruiser
        acceleration: 50, // Medium acceleration
        size: 24, // Same size as player ships
        color: 0xff0000, // Red color to distinguish from player ships
        shape: 'triangle', // Triangle shape like corvette
        health: 50, // More health than corvette, less than cruiser
        rotationSpeed: .5, // Medium rotation speed
        weapon: {
            fireRate: 1, // Fires faster than cruiser, slower than corvette
            damage: 1, // Medium damage
            range: 100, // Shorter range than player ships
        },
        ai: {
            // AI behavior settings
            detectionRange: 200, // How far the enemy can "see" player ships
            attackRange: 100, // How close it needs to be to attack
        },
    },

    // ============================================
    // BULLET CONFIGURATION
    // ============================================
    bullet: {
        speed: 200, // How fast bullets travel (pixels per second)
        size: 3, // Bullet size in pixels (small circles)
        playerColor: 0x39ff14, // Green bullets for player ships
        enemyColor: 0xff0000, // Red bullets for enemy ships
        lifetime: 2000, // How long bullets exist before disappearing (milliseconds)
    },

    // ============================================
    // GAME BEHAVIOR SETTINGS
    // ============================================
    arriveThreshold: 3, // How close a ship needs to be to a waypoint to "arrive" (pixels)

    // ============================================
    // SHIP SEPARATION SETTINGS
    // ============================================
    separation: {
        minDistance: 20, // Minimum distance ships should maintain from each other (pixels)
        separationForce: 15, // How far ships move away from each other when too close (pixels)
    },

};

// This creates a TypeScript type that matches our VARIABLES object
// It helps catch errors if we try to access properties that don't exist
export type Variables = typeof VARIABLES;
