/**
 * MAIN GAME SCENE
 * ===============
 *
 * This is the heart of the game! It handles:
 * - Creating and managing ships (player and enemy)
 * - Ship movement and pathfinding
 * - Combat (shooting, damage, health)
 * - User input (clicking, selecting, moving ships)
 * - AI behavior for enemy ships
 * - Visual effects (bullets, damage, paths)
 *
 * Think of this as the "game world" where everything happens.
 */

// Import the game engine and our custom variables
import Phaser from 'phaser';
import { GUI } from 'lil-gui'; // For the debug controls panel
import { VARIABLES } from '@/variables'; // Our game settings

/**
 * SHIP INTERFACE
 * ==============
 *
 * This defines what data each ship needs to keep track of.
 * Think of it as a "blueprint" for what information each ship stores.
 *
 * In programming, an "interface" is like a contract that says
 * "every ship must have these properties"
 */
interface Ship {
    gameObject: Phaser.GameObjects.Polygon; // The visual ship on screen
    type: 'corvette' | 'cruiser' | 'enemy'; // What kind of ship it is
    target: Phaser.Math.Vector2 | null; // Where the ship is trying to go
    pathStart: Phaser.Math.Vector2 | null; // Where the ship started its current path
    waypoints: Phaser.Math.Vector2[]; // List of points the ship will visit
    currentSpeed: number; // How fast the ship is moving right now
    waypointDots: Phaser.GameObjects.Arc[]; // Visual dots showing waypoints
    lastFireTime: number; // When the ship last shot (for fire rate limiting)
    health: number; // Current health points
    maxHealth: number; // Maximum health points
    healthBar: Phaser.GameObjects.Graphics; // Visual health bar above ship
}

/**
 * GAME SCENE CLASS
 * ================
 *
 * This class contains all the game logic. It's like the "brain" of the game.
 * It keeps track of all the ships, bullets, and handles user input.
 */
export default class Game extends Phaser.Scene {
    // ============================================
    // SHIP MANAGEMENT
    // ============================================
    private ships: Ship[] = []; // All ships in the game (player + enemy)
    private selectedShips: Set<Ship> = new Set(); // Which ships the player has selected
    private enemyShips: Ship[] = []; // Just the enemy ships (for AI targeting)

    // ============================================
    // BULLET SYSTEM
    // ============================================
    private bullets: Phaser.GameObjects.Arc[] = []; // All bullets currently flying
    private bulletVelocities: Phaser.Math.Vector2[] = []; // How fast each bullet is moving
    private bulletTimers: number[] = []; // How long each bullet has left to live

    // ============================================
    // VISUAL EFFECTS
    // ============================================
    private damageEffects: Phaser.GameObjects.Arc[] = []; // Damage explosion effects
    private damageEffectTimers: number[] = []; // How long each effect has left

    // ============================================
    // SPECIAL MOVEMENT
    // ============================================
    private circularPaths: Map<
        Ship,
        { center: Phaser.Math.Vector2; radius: number; startAngle: number }
    > = new Map(); // Ships that are moving in circles

    // ============================================
    // DEBUG CONTROLS
    // ============================================
    private gui!: GUI; // The debug control panel
    private params = { speed: 200 }; // Parameters that can be changed in debug panel

    // ============================================
    // USER INTERFACE
    // ============================================
    private btn1!: Phaser.GameObjects.Rectangle; // Selection button 1
    private btn1Label!: Phaser.GameObjects.Text; // Text for button 1
    private btn2!: Phaser.GameObjects.Rectangle; // Selection button 2
    private btn2Label!: Phaser.GameObjects.Text; // Text for button 2
    private pathGraphics!: Phaser.GameObjects.Graphics; // For drawing ship paths
    private readonly pathColor: number = 0x39ff14; // Green color for paths

    // ============================================
    // SHIP MOVEMENT TRACKING
    // ============================================
    private ship1CurrentSpeed: number = 0; // Current speed of ship 1
    private ship2CurrentSpeed: number = 0; // Current speed of ship 2

    // ============================================
    // BOX SELECTION SYSTEM
    // ============================================
    private selectionBox!: Phaser.GameObjects.Graphics; // Visual selection box
    private isBoxSelecting: boolean = false; // Are we currently selecting with a box?
    private boxStartX: number = 0; // Where the selection box started (X coordinate)
    private boxStartY: number = 0; // Where the selection box started (Y coordinate)
    private boxEndX: number = 0; // Where the selection box ends (X coordinate)
    private boxEndY: number = 0; // Where the selection box ends (Y coordinate)

    /**
     * CONSTRUCTOR
     * ===========
     *
     * This runs when the scene is created. It tells Phaser
     * what to call this scene ('Game').
     */
    constructor() {
        super({ key: 'Game' });
    }

    /**
     * PRELOAD METHOD
     * ==============
     *
     * This runs before the game starts. Usually you'd load images,
     * sounds, and other assets here. But our game uses simple shapes
     * so we don't need to load anything!
     */
    preload() {
        // We don't need to load any images or sounds
        // because we're using simple geometric shapes
    }

    /**
     * CREATE METHOD
     * =============
     *
     * This runs once when the game starts. It sets up everything:
     * - Creates all the ships
     * - Sets up user input handling
     * - Creates the UI elements
     * - Starts the debug controls
     *
     * Think of this as the "game setup" phase.
     */
    create() {
        // ============================================
        // CREATE PLAYER SHIPS
        // ============================================

        // Create 3 Corvettes (fast, light ships)
        const corvettePositions = [
            { x: 100, y: 150 }, // Left side of screen
            { x: 150, y: 200 }, // Middle-left
            { x: 200, y: 100 }, // Upper-middle
        ];

        corvettePositions.forEach((pos, index) => {
            const corvette = this.createShip('corvette', pos.x, pos.y);
            this.ships.push(corvette); // Add to our list of all ships
        });

        // Create 1 Cruiser (slow, heavy ship)
        const cruiser = this.createShip('cruiser', 250, 150);
        this.ships.push(cruiser);

        // ============================================
        // CREATE ENEMY SHIPS
        // ============================================

        // Create enemy ship in the middle of the screen
        const enemy = this.createShip('enemy', this.scale.width / 2, this.scale.height / 2);
        this.enemyShips.push(enemy); // Add to enemy list for AI
        this.ships.push(enemy); // Also add to general ships list

        // Create 3 additional enemies to the right of the current enemy
        const additionalEnemyPositions = [
            { x: this.scale.width / 2 + 100, y: this.scale.height / 2 - 50 }, // Above
            { x: this.scale.width / 2 + 100, y: this.scale.height / 2 }, // Same level
            { x: this.scale.width / 2 + 100, y: this.scale.height / 2 + 50 }, // Below
        ];

        additionalEnemyPositions.forEach((pos, index) => {
            const additionalEnemy = this.createShip('enemy', pos.x, pos.y);
            this.enemyShips.push(additionalEnemy);
            this.ships.push(additionalEnemy);
        });

        // ============================================
        // INITIAL SELECTION
        // ============================================

        // Select the first corvette by default so the player can start playing immediately
        const firstCorvette = this.ships.find((ship) => ship.type === 'corvette');
        if (firstCorvette) {
            this.selectOnlyShip(firstCorvette);
        }

        // ============================================
        // SETUP GRAPHICS FOR DRAWING
        // ============================================

        // Create graphics object for drawing ship paths (the lines showing where ships will go)
        this.pathGraphics = this.add.graphics().setDepth(900);

        // Create graphics object for drawing the selection box (when you drag to select multiple ships)
        this.selectionBox = this.add.graphics().setDepth(950);

        // ============================================
        // SETUP USER INPUT HANDLING
        // ============================================

        // Handle mouse clicks for ship selection and movement
        this.input.on(
            'pointerdown',
            (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
                if (pointer.leftButtonDown()) {
                    // LEFT CLICK HANDLING

                    // Check if clicking on a waypoint dot with shift held (for circular movement)
                    const shiftHeld = (pointer.event as MouseEvent).shiftKey === true;
                    if (shiftHeld) {
                        const hoveredDot = this.getHoveredDot(pointer);
                        if (hoveredDot) {
                            // Start circular path from this waypoint (advanced feature)
                            const waypoint = hoveredDot.ship.waypoints[hoveredDot.waypointIndex];
                            if (waypoint) {
                                const shipCenter = this.getObjectCenter(hoveredDot.ship.gameObject);
                                const radius = shipCenter.distance(waypoint);
                                this.startCircularPath(hoveredDot.ship, waypoint, radius);
                                return;
                            }
                        }
                    }

                    // Normal left click - select ships or start box selection
                    const clickedShip = this.ships.find(
                        (ship) => ship.gameObject === currentlyOver.find((obj) => obj === ship.gameObject)
                    );
                    if (clickedShip) {
                        // Clicked on a ship - select only this ship
                        this.selectOnlyShip(clickedShip);
                    } else {
                        // Clicked on empty space - start box selection (drag to select multiple ships)
                        this.startBoxSelection(pointer);
                    }
                } else if (pointer.rightButtonDown()) {
                    // RIGHT CLICK HANDLING
                    // Right click - give movement commands to selected ships
                    this.handleRightClick(pointer);
                }
            }
        );

        // Handle mouse movement for box selection and waypoint highlighting
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.isBoxSelecting) {
                // Update the selection box as the mouse moves
                this.boxEndX = pointer.worldX;
                this.boxEndY = pointer.worldY;
                this.drawSelectionBox();
            }

            // Handle waypoint dot highlighting when shift is held
            const shiftHeld = (pointer.event as MouseEvent).shiftKey === true;
            if (shiftHeld) {
                const hoveredDot = this.getHoveredDot(pointer);

                // Reset all waypoint dots to normal color
                this.ships.forEach((ship) => {
                    ship.waypointDots.forEach((dot) => {
                        dot.setFillStyle(VARIABLES[ship.type].color, 1);
                    });
                });

                // Highlight the waypoint dot under the mouse
                if (hoveredDot) {
                    hoveredDot.dot.setFillStyle(0xffffff, 1);
                }
            } else {
                // Reset all dots to normal color when shift is not held
                this.ships.forEach((ship) => {
                    ship.waypointDots.forEach((dot) => {
                        dot.setFillStyle(VARIABLES[ship.type].color, 1);
                    });
                });
            }
        });

        // Handle mouse release (finish box selection)
        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (this.isBoxSelecting) {
                this.finishBoxSelection();
            }
        });

        // ============================================
        // CREATE USER INTERFACE
        // ============================================

        // Create selection buttons in the top-left corner (only for player ships, not enemies)
        this.createSelectionButtons();

        // ============================================
        // SETUP DEBUG CONTROLS
        // ============================================

        // Create the debug control panel (the floating panel with sliders)
        this.gui = new GUI();
        this.params.speed = VARIABLES.corvette.speed;
        this.gui
            .add(this.params, 'speed', 10, 1000, 1) // Speed slider from 10 to 1000
            .name('Corvette Speed')
            .onChange((value: number) => {
                // When the slider changes, update all corvette speeds
                this.ships.forEach((ship) => {
                    if (ship.type === 'corvette') {
                        VARIABLES.corvette.speed = value;
                    }
                });
            });

        // Clean up the debug panel when the game shuts down
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.gui.destroy();
        });

        // Disable the browser's right-click context menu inside the game
        this.input.mouse?.disableContextMenu();
    }

    /**
     * UPDATE METHOD
     * =============
     *
     * This runs every frame (60 times per second). It's like the "heartbeat"
     * of the game - everything that needs to happen continuously happens here.
     *
     * @param time - Total time since the game started (milliseconds)
     * @param delta - Time since last frame (milliseconds)
     */
    update(time: number, delta: number) {
        // ============================================
        // UPDATE ALL GAME OBJECTS
        // ============================================

        // Update all ships (movement, collision detection, etc.)
        this.ships.forEach((ship) => {
            this.updateShip(ship, delta);
        });

        // Update enemy AI (make enemies hunt and attack player ships)
        this.updateEnemyAI(delta);

        // Update player AI (make player ships automatically shoot at enemies)
        this.updatePlayerAI(delta);

        // Update all bullets (move them, check for hits, remove expired ones)
        this.updateBullets(delta);

        // Update damage effects (fade out explosion effects)
        this.updateDamageEffects(delta);

        // Handle ships that are moving in circular paths
        this.updateCircularPaths(delta);

        // Draw the path lines showing where ships are going
        this.drawAllPaths();
    }

    // Update individual ship
    private updateShip(ship: Ship, delta: number) {
        const shipData = VARIABLES[ship.type];
        const dt = delta / 1000;

        // Compute current speed with acceleration/deceleration
        const desired = ship.target ? shipData.speed : 0;
        const accel = Math.max(ship.currentSpeed, desired) / (shipData.acceleration / 100);
        ship.currentSpeed = this.approach(ship.currentSpeed, desired, accel * dt);

        // Move ship toward target
        ship.target = this.moveToward(ship, ship.target, ship.currentSpeed, delta);

        // Update waypoint tracking
        if (ship.waypoints.length && ship.pathStart === null) {
            ship.pathStart = this.getObjectCenter(ship.gameObject);
        }

        // Clear path if no waypoints
        if (!ship.waypoints.length) {
            ship.target = null;
            ship.pathStart = null;
            this.updateWaypointDots(ship);
        }
    }

    // Move ship toward target and return next target
    private moveToward(
        ship: Ship,
        target: Phaser.Math.Vector2 | null,
        effectiveSpeed: number,
        delta: number
    ): Phaser.Math.Vector2 | null {
        if (!target) return null;

        const current = new Phaser.Math.Vector2(ship.gameObject.x, ship.gameObject.y);
        const toTarget = target.clone().subtract(current);
        const distance = toTarget.length();

        if (distance < VARIABLES.arriveThreshold) {
            ship.gameObject.setPosition(target.x, target.y);
            // Advance to next waypoint
            ship.waypoints.shift();
            this.updateWaypointDots(ship);
            const next = ship.waypoints[0] ?? null;
            if (next) {
                ship.pathStart = new Phaser.Math.Vector2(target.x, target.y);
            } else {
                ship.pathStart = null;
            }
            return next;
        }

        const direction = toTarget.normalize();
        const step = (effectiveSpeed * delta) / 1000;
        const nextPos = current.add(direction.scale(step));

        // Check for collisions before moving
        if (this.checkShipCollisions(ship, nextPos.x, nextPos.y)) {
            // Stop movement if collision would occur
            return target;
        }

        // Clamp overshoot
        if (nextPos.distance(target) > distance) {
            // Check collision at target position
            if (!this.checkShipCollisions(ship, target.x, target.y)) {
                ship.gameObject.setPosition(target.x, target.y);
                this.updateHealthBar(ship);
                ship.waypoints.shift();
                this.updateWaypointDots(ship);
                const next = ship.waypoints[0] ?? null;
                if (next) {
                    ship.pathStart = new Phaser.Math.Vector2(target.x, target.y);
                } else {
                    ship.pathStart = null;
                }
                return next;
            } else {
                // Can't reach target due to collision
                return target;
            }
        } else {
            ship.gameObject.setPosition(nextPos.x, nextPos.y);
            this.updateHealthBar(ship);
            return target;
        }
    }

    // Update enemy AI
    private updateEnemyAI(delta: number) {
        this.enemyShips.forEach((enemyShip) => {
            const enemyData = VARIABLES.enemy;
            const enemyPos = new Phaser.Math.Vector2(enemyShip.gameObject.x, enemyShip.gameObject.y);

            // Find closest player ship
            let closestShip: Ship | null = null;
            let closestDistance = Infinity;

            for (const ship of this.ships) {
                if (ship.type !== 'enemy') {
                    const distance = enemyPos.distance(
                        new Phaser.Math.Vector2(ship.gameObject.x, ship.gameObject.y)
                    );
                    if (distance < closestDistance && distance <= enemyData.ai.detectionRange) {
                        closestDistance = distance;
                        closestShip = ship;
                    }
                }
            }

            // Move toward closest ship if in range
            if (closestShip && closestDistance <= enemyData.ai.detectionRange) {
                const targetPos = new Phaser.Math.Vector2(
                    closestShip.gameObject.x,
                    closestShip.gameObject.y
                );
                enemyShip.target = targetPos;

                // Try to shoot if in range
                if (closestDistance <= enemyData.weapon.range) {
                    this.tryShoot(enemyShip, closestShip);
                }
            } else {
                enemyShip.target = null;
            }
        });
    }

    // Update player ship AI - make them shoot at enemies
    private updatePlayerAI(delta: number) {
        const playerShips = this.ships.filter((ship) => ship.type !== 'enemy');

        playerShips.forEach((playerShip) => {
            const playerData = VARIABLES[playerShip.type];
            const playerPos = new Phaser.Math.Vector2(playerShip.gameObject.x, playerShip.gameObject.y);

            // Find closest enemy ship
            let closestEnemy: Ship | null = null;
            let closestDistance = Infinity;

            for (const enemyShip of this.enemyShips) {
                const distance = playerPos.distance(
                    new Phaser.Math.Vector2(enemyShip.gameObject.x, enemyShip.gameObject.y)
                );
                if (distance < closestDistance && distance <= playerData.weapon.range) {
                    closestDistance = distance;
                    closestEnemy = enemyShip;
                }
            }

            // Try to shoot if enemy is in range
            if (closestEnemy && closestDistance <= playerData.weapon.range) {
                this.tryShoot(playerShip, closestEnemy);
            }
        });
    }

    // Update bullets
    private updateBullets(delta: number) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            const velocity = this.bulletVelocities[i];
            const timer = this.bulletTimers[i];

            if (!bullet || !velocity || timer === undefined) {
                // Clean up invalid entries
                this.bullets.splice(i, 1);
                this.bulletVelocities.splice(i, 1);
                this.bulletTimers.splice(i, 1);
                continue;
            }

            // Move bullet
            bullet.x += velocity.x * (delta / 1000);
            bullet.y += velocity.y * (delta / 1000);

            // Update timer
            this.bulletTimers[i] = timer - delta;

            // Remove bullet if expired or out of bounds
            if (
                this.bulletTimers[i]! <= 0 ||
                bullet.x < 0 ||
                bullet.x > this.scale.width ||
                bullet.y < 0 ||
                bullet.y > this.scale.height
            ) {
                bullet.destroy();
                this.bullets.splice(i, 1);
                this.bulletVelocities.splice(i, 1);
                this.bulletTimers.splice(i, 1);
            } else {
                // Check for collisions
                this.checkBulletCollisions(bullet, i);
            }
        }
    }

    // Check bullet collisions
    private checkBulletCollisions(bullet: Phaser.GameObjects.Arc, bulletIndex: number) {
        const bulletPos = new Phaser.Math.Vector2(bullet.x, bullet.y);

        // Find which ship shot this bullet (by color)
        let shooterShip: Ship | null = null;
        if (bullet.fillColor === VARIABLES.bullet.playerColor) {
            // Player bullet
            shooterShip =
                this.ships.find((ship) => ship.type === 'corvette' || ship.type === 'cruiser') || null;
        } else if (bullet.fillColor === VARIABLES.bullet.enemyColor) {
            // Enemy bullet - find the enemy that shot it (this is approximate)
            shooterShip = this.enemyShips[0] || null;
        }

        this.ships.forEach((ship) => {
            // Don't hit the ship that shot the bullet
            if (ship === shooterShip) return;

            const shipPos = new Phaser.Math.Vector2(ship.gameObject.x, ship.gameObject.y);
            const distance = bulletPos.distance(shipPos);

            if (distance < VARIABLES[ship.type].size / 2) {
                // Hit! Apply damage based on shooter's weapon
                let damage = 10; // Default damage
                if (shooterShip) {
                    damage = VARIABLES[shooterShip.type].weapon.damage;
                }

                ship.health -= damage;
                this.updateHealthBar(ship);

                // Create damage effect
                this.createDamageEffect(shipPos.x, shipPos.y, shooterShip);

                // Remove bullet
                bullet.destroy();
                this.bullets.splice(bulletIndex, 1);
                this.bulletVelocities.splice(bulletIndex, 1);
                this.bulletTimers.splice(bulletIndex, 1);

                // Check if ship is destroyed
                if (ship.health <= 0) {
                    this.destroyShip(ship);
                }
            }
        });
    }

    // Try to shoot
    private tryShoot(shooter: Ship, target: Ship) {
        const currentTime = this.time.now;
        const shipData = VARIABLES[shooter.type];

        if (currentTime - shooter.lastFireTime >= 1000 / shipData.weapon.fireRate) {
            this.shoot(shooter, target);
            shooter.lastFireTime = currentTime;
        }
    }

    // Create and fire a bullet
    private shoot(shooter: Ship, target: Ship) {
        const shooterPos = new Phaser.Math.Vector2(shooter.gameObject.x, shooter.gameObject.y);
        const targetPos = new Phaser.Math.Vector2(target.gameObject.x, target.gameObject.y);

        // Create bullet with appropriate color based on shooter type
        let bulletColor: number;
        if (shooter.type === 'enemy') {
            bulletColor = VARIABLES.bullet.enemyColor; // Red for enemy bullets
        } else {
            bulletColor = VARIABLES.bullet.playerColor; // Green for player bullets
        }

        const bullet = this.add.circle(
            shooterPos.x,
            shooterPos.y,
            VARIABLES.bullet.size,
            bulletColor,
            1
        );
        bullet.setDepth(800);

        // Calculate direction
        const direction = targetPos.clone().subtract(shooterPos).normalize();
        const velocity = direction.scale(VARIABLES.bullet.speed);

        // Add to arrays
        this.bullets.push(bullet);
        this.bulletVelocities.push(velocity);
        this.bulletTimers.push(VARIABLES.bullet.lifetime);
    }

    // Create damage effect
    private createDamageEffect(x: number, y: number, shooter: Ship | null) {
        // Determine damage color: red for enemy damage, green for player damage
        let damageColor: number;
        if (shooter && shooter.type === 'enemy') {
            damageColor = 0xff0000; // Red for enemy damage
        } else {
            damageColor = 0x00ff00; // Green for player damage
        }

        const damageEffect = this.add.circle(x, y, 8, damageColor, 0.8);
        damageEffect.setDepth(850);

        this.damageEffects.push(damageEffect);
        this.damageEffectTimers.push(500); // 500ms duration
    }

    // Update damage effects
    private updateDamageEffects(delta: number) {
        for (let i = this.damageEffects.length - 1; i >= 0; i--) {
            const effect = this.damageEffects[i];
            const timer = this.damageEffectTimers[i];

            if (!effect || timer === undefined) {
                // Clean up invalid entries
                this.damageEffects.splice(i, 1);
                this.damageEffectTimers.splice(i, 1);
                continue;
            }

            // Update timer
            this.damageEffectTimers[i] = timer - delta;

            // Fade out effect
            const alpha = Math.max(0, timer / 500);
            effect.setAlpha(alpha);

            // Remove effect if expired
            if (this.damageEffectTimers[i]! <= 0) {
                effect.destroy();
                this.damageEffects.splice(i, 1);
                this.damageEffectTimers.splice(i, 1);
            }
        }
    }

    // Destroy a ship
    private destroyShip(ship: Ship) {
        // Remove from ships array
        const index = this.ships.indexOf(ship);
        if (index > -1) {
            this.ships.splice(index, 1);
        }

        // Remove from enemy ships array if it's an enemy
        if (ship.type === 'enemy') {
            const enemyIndex = this.enemyShips.indexOf(ship);
            if (enemyIndex > -1) {
                this.enemyShips.splice(enemyIndex, 1);
            }
        }

        // Remove from selected ships
        this.selectedShips.delete(ship);

        // Destroy game object, health bar, and waypoint dots
        ship.gameObject.destroy();
        ship.healthBar.destroy();
        ship.waypointDots.forEach((dot) => dot.destroy());

        // Remove circular path if exists
        this.circularPaths.delete(ship);
    }

    // Draw all ship paths
    private drawAllPaths() {
        this.pathGraphics.clear();

        this.ships.forEach((ship) => {
            if (ship.pathStart && ship.waypoints.length) {
                const start = ship.pathStart;
                const shipPos = this.getObjectCenter(ship.gameObject);
                const first = ship.waypoints[0]!;
                const traveled = this.getProgressDistanceAlongSegment(start, first, shipPos);
                this.drawDashedLine(
                    this.pathGraphics,
                    start.x,
                    start.y,
                    first.x,
                    first.y,
                    6,
                    4,
                    VARIABLES[ship.type].color,
                    1,
                    traveled
                );

                for (let i = 0; i + 1 < ship.waypoints.length; i++) {
                    const a = ship.waypoints[i]!;
                    const b = ship.waypoints[i + 1]!;
                    this.drawDashedLine(
                        this.pathGraphics,
                        a.x,
                        a.y,
                        b.x,
                        b.y,
                        6,
                        4,
                        VARIABLES[ship.type].color,
                        1,
                        0
                    );
                }
            }
        });
    }

    // Update circular path movement
    private updateCircularPaths(delta: number) {
        this.circularPaths.forEach((pathData, ship) => {
            const { center, radius, startAngle } = pathData;

            if (ship.currentSpeed > 0) {
                // Calculate angular velocity based on speed and radius
                const angularVelocity = ship.currentSpeed / radius;

                // Update the start angle for continuous movement
                pathData.startAngle += angularVelocity * (delta / 1000);

                // Calculate new position on the circle
                const newX = center.x + Math.cos(pathData.startAngle) * radius;
                const newY = center.y + Math.sin(pathData.startAngle) * radius;

                // Check for collisions before moving
                if (!this.checkShipCollisions(ship, newX, newY)) {
                    ship.gameObject.setPosition(newX, newY);
                    this.updateHealthBar(ship);
                }
            }
        });
    }

    // Draw a solid line, optionally trimmed from the start by startOffset
    private drawDashedLine(
        g: Phaser.GameObjects.Graphics,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        dashLength: number,
        gapLength: number,
        color: number,
        alpha: number,
        startOffset: number = 0
    ) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) return;
        const angle = Math.atan2(dy, dx);
        const offset = Math.max(0, Math.min(startOffset, dist));
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const startX = x1 + cos * offset;
        const startY = y1 + sin * offset;
        g.lineStyle(1, color, alpha);
        g.beginPath();
        g.moveTo(startX, startY);
        g.lineTo(x2, y2);
        g.strokePath();
    }

    // Distance from start to the orthogonal projection of p onto the segment [start, end]
    private getProgressDistanceAlongSegment(
        start: Phaser.Math.Vector2,
        end: Phaser.Math.Vector2,
        p: Phaser.Math.Vector2
    ): number {
        const abx = end.x - start.x;
        const aby = end.y - start.y;
        const apx = p.x - start.x;
        const apy = p.y - start.y;
        const abLenSq = abx * abx + aby * aby;
        if (abLenSq === 0) return 0;
        let t = (apx * abx + apy * aby) / abLenSq;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(abx, aby) * t;
    }

    // Compute the polygon centroid in world space so lines originate from the triangle's middle
    private getObjectCenter(obj: Phaser.GameObjects.Polygon): Phaser.Math.Vector2 {
        // Access polygon points in local space
        const geom: any = (obj as any).geom;
        const points: { x: number; y: number }[] = geom && geom.points ? geom.points : [];
        if (!points.length) {
            // Fallback to bounds center if points are unavailable
            const b = obj.getBounds();
            return new Phaser.Math.Vector2(b.centerX, b.centerY);
        }

        const mat = obj.getWorldTransformMatrix();
        const tmp = new Phaser.Math.Vector2();
        let sumX = 0;
        let sumY = 0;
        for (const p of points) {
            const w = mat.transformPoint(p.x, p.y, tmp);
            sumX += w.x;
            sumY += w.y;
        }
        const inv = 1 / points.length;
        return new Phaser.Math.Vector2(sumX * inv, sumY * inv);
    }

    // Linear approach helper: move current toward target by maxDelta
    private approach(current: number, target: number, maxDelta: number): number {
        if (current < target) return Math.min(current + maxDelta, target);
        if (current > target) return Math.max(current - maxDelta, target);
        return current;
    }

    // Box selection helper methods

    private handleRightClick(pointer: Phaser.Input.Pointer) {
        const clickPos = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
        const append = (pointer.event as MouseEvent).shiftKey === true;

        // Move all selected ships to the target
        this.selectedShips.forEach((ship) => {
            // Clear circular path when giving new movement commands
            this.circularPaths.delete(ship);

            if (append && ship.waypoints.length > 0) {
                ship.waypoints.push(clickPos);
            } else {
                ship.waypoints = [clickPos];
                ship.pathStart = this.getObjectCenter(ship.gameObject);
            }
            ship.target = ship.waypoints[0] ?? null;
            this.updateWaypointDots(ship);
        });
    }

    private selectOnlyShip(ship: Ship) {
        this.selectedShips.clear();
        this.selectedShips.add(ship);
        this.updateShipColors();
    }

    private startBoxSelection(pointer: Phaser.Input.Pointer) {
        this.isBoxSelecting = true;
        this.boxStartX = pointer.worldX;
        this.boxStartY = pointer.worldY;
        this.boxEndX = pointer.worldX;
        this.boxEndY = pointer.worldY;
    }

    private drawSelectionBox() {
        this.selectionBox.clear();
        if (this.isBoxSelecting) {
            const x = Math.min(this.boxStartX, this.boxEndX);
            const y = Math.min(this.boxStartY, this.boxEndY);
            const width = Math.abs(this.boxEndX - this.boxStartX);
            const height = Math.abs(this.boxEndY - this.boxStartY);

            // Draw transparent selection box
            this.selectionBox.lineStyle(2, 0xffffff, 0.8);
            this.selectionBox.strokeRect(x, y, width, height);
            this.selectionBox.fillStyle(0xffffff, 0.1);
            this.selectionBox.fillRect(x, y, width, height);
        }
    }

    private finishBoxSelection() {
        this.isBoxSelecting = false;
        this.selectionBox.clear();

        // Find ships within the selection box
        const x1 = Math.min(this.boxStartX, this.boxEndX);
        const y1 = Math.min(this.boxStartY, this.boxEndY);
        const x2 = Math.max(this.boxStartX, this.boxEndX);
        const y2 = Math.max(this.boxStartY, this.boxEndY);

        this.selectedShips.clear();

        this.ships.forEach((ship) => {
            if (ship.type !== 'enemy') {
                // Don't select enemy ships
                const center = this.getObjectCenter(ship.gameObject);
                if (center.x >= x1 && center.x <= x2 && center.y >= y1 && center.y <= y2) {
                    this.selectedShips.add(ship);
                }
            }
        });

        this.updateShipColors();
    }

    private updateShipColors() {
        // Reset all ships to their default colors
        this.ships.forEach((ship) => {
            ship.gameObject.setFillStyle(0x00ff00, 0).setStrokeStyle(2, VARIABLES[ship.type].color, 1);
        });

        // Change selected ships to white
        this.selectedShips.forEach((ship) => {
            ship.gameObject.setFillStyle(0xffffff, 0).setStrokeStyle(2, 0xffffff, 1);
        });
    }

    // Create a waypoint dot
    private createWaypointDot(x: number, y: number): Phaser.GameObjects.Arc {
        const dot = this.add.circle(x, y, 3, VARIABLES.corvette.color, 1);
        dot.setDepth(850);
        dot.setInteractive({ useHandCursor: true });
        return dot;
    }

    // Update waypoint dots for a ship
    private updateWaypointDots(ship: Ship) {
        // Remove existing dots
        ship.waypointDots.forEach((dot) => dot.destroy());
        ship.waypointDots.length = 0;

        // Create new dots for each waypoint
        ship.waypoints.forEach((waypoint) => {
            const dot = this.createWaypointDot(waypoint.x, waypoint.y);
            ship.waypointDots.push(dot);
        });
    }

    // Check if pointer is hovering over a waypoint dot
    private getHoveredDot(
        pointer: Phaser.Input.Pointer
    ): { dot: Phaser.GameObjects.Arc; ship: Ship; waypointIndex: number } | null {
        for (const ship of this.ships) {
            for (let i = 0; i < ship.waypointDots.length; i++) {
                const dot = ship.waypointDots[i];
                if (dot && dot.getBounds().contains(pointer.worldX, pointer.worldY)) {
                    return { dot, ship, waypointIndex: i };
                }
            }
        }
        return null;
    }

    // Create a ship of the specified type
    private createShip(type: 'corvette' | 'cruiser' | 'enemy', x: number, y: number): Ship {
        const shipData = VARIABLES[type];
        let gameObject: Phaser.GameObjects.Polygon;

        if (type === 'corvette' || type === 'enemy') {
            // Triangle shape
            const half = shipData.size / 2;
            const triPoints = [0, -half, -half, half, half, half];
            gameObject = this.add
                .polygon(x, y, triPoints, 0x00ff00, 0)
                .setStrokeStyle(2, shipData.color, 1)
                .setOrigin(0.5, 0.5);
        } else {
            // Square shape for cruiser
            const half = shipData.size / 2;
            const squarePoints = [-half, -half, half, -half, half, half, -half, half];
            gameObject = this.add
                .polygon(x, y, squarePoints, 0x00ff00, 0)
                .setStrokeStyle(2, shipData.color, 1)
                .setOrigin(0.5, 0.5);
        }

        // Make ship interactive
        const geom: Phaser.Geom.Polygon = (gameObject as any).geom as Phaser.Geom.Polygon;
        gameObject.setInteractive(geom, Phaser.Geom.Polygon.Contains);
        if (gameObject.input) gameObject.input.cursor = 'pointer';

        // Create health bar
        const healthBar = this.add.graphics();
        healthBar.setDepth(700);

        const ship = {
            gameObject,
            type,
            target: null,
            pathStart: null,
            waypoints: [],
            currentSpeed: 0,
            waypointDots: [],
            lastFireTime: 0,
            health: shipData.health,
            maxHealth: shipData.health,
            healthBar,
        };

        // Update health bar display
        this.updateHealthBar(ship);

        return ship;
    }

    // Create selection buttons for player ships
    private createSelectionButtons() {
        const margin = 12;
        const btnWidth = 100;
        const btnHeight = 30;
        const playerShips = this.ships.filter((ship) => ship.type !== 'enemy');

        playerShips.forEach((ship, index) => {
            const btn = this.add
                .rectangle(margin, margin + index * (btnHeight + 8), btnWidth, btnHeight, 0x000000)
                .setOrigin(0, 0)
                .setScrollFactor(0)
                .setDepth(1000)
                .setInteractive({ useHandCursor: true });
            btn.setStrokeStyle(1, 0xffffff, 1);

            const label = this.add
                .text(
                    margin + 10,
                    margin + index * (btnHeight + 8) + 7,
                    `${VARIABLES[ship.type].name} ${index + 1}`,
                    { color: '#ffffff' }
                )
                .setScrollFactor(0)
                .setDepth(1001);

            btn.on('pointerdown', () => {
                this.selectOnlyShip(ship);
            });
        });
    }

    // Update health bar display
    private updateHealthBar(ship: Ship) {
        const healthPercent = ship.health / ship.maxHealth;
        const barWidth = 30;
        const barHeight = 4;
        const offsetY = -ship.gameObject.height / 2 - 10;

        ship.healthBar.clear();

        // Background (red)
        ship.healthBar.fillStyle(0xff0000, 0.8);
        ship.healthBar.fillRect(
            ship.gameObject.x - barWidth / 2,
            ship.gameObject.y + offsetY,
            barWidth,
            barHeight
        );

        // Health (green)
        ship.healthBar.fillStyle(0x00ff00, 0.8);
        ship.healthBar.fillRect(
            ship.gameObject.x - barWidth / 2,
            ship.gameObject.y + offsetY,
            barWidth * healthPercent,
            barHeight
        );
    }

    // Check for ship collisions
    private checkShipCollisions(ship: Ship, newX: number, newY: number): boolean {
        const shipRadius = VARIABLES[ship.type].size / 2;

        for (const otherShip of this.ships) {
            if (otherShip === ship) continue;

            const otherRadius = VARIABLES[otherShip.type].size / 2;
            const distance = Math.hypot(newX - otherShip.gameObject.x, newY - otherShip.gameObject.y);
            const minDistance = shipRadius + otherRadius + 5; // 5px buffer

            if (distance < minDistance) {
                return true; // Collision detected
            }
        }
        return false;
    }

    // Start circular path movement
    private startCircularPath(ship: Ship, center: Phaser.Math.Vector2, radius: number) {
        const shipCenter = this.getObjectCenter(ship.gameObject);
        const startAngle = Math.atan2(shipCenter.y - center.y, shipCenter.x - center.x);
        this.circularPaths.set(ship, { center, radius, startAngle });

        // Clear waypoints for this ship
        ship.waypoints = [];
        ship.target = null;
        ship.pathStart = null;
        this.updateWaypointDots(ship);
    }
}
