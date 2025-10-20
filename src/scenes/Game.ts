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
  gameObject: Phaser.GameObjects.Image; // The visual ship on screen
  highlightImage: Phaser.GameObjects.Image | null; // Highlight image shown when selected
  type: 'corvette' | 'cruiser' | 'enemy'; // What kind of ship it is
  target: Phaser.Math.Vector2 | null; // Where the ship is trying to go
  pathStart: Phaser.Math.Vector2 | null; // Where the ship started its current path
  waypoints: Phaser.Math.Vector2[]; // List of points the ship will visit
  waypointDirections: number[]; // Direction the ship should face at each waypoint
  currentSpeed: number; // How fast the ship is moving right now
  waypointDots: Phaser.GameObjects.Container[]; // Visual dots showing waypoints
  lastFireTime: number; // When the ship last shot (for fire rate limiting)
  health: number; // Current health points
  maxHealth: number; // Maximum health points
  healthBar: Phaser.GameObjects.Graphics; // Visual health bar above ship
  rotation: number; // Current rotation angle in radians
  targetRotation: number; // Target rotation angle in radians
  // Optional: if set, this ship will continuously follow the given ship
  followTarget?: Ship | null;
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
  private bulletShooters: Ship[] = []; // Which ship shot each bullet

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
  private params = { speed: 200, fps: 0 }; // Parameters that can be changed in debug panel
  private fpsCounter: number = 0; // Current FPS value
  private lastFpsUpdate: number = 0; // Last time FPS was calculated
  private frameCount: number = 0; // Frame counter for FPS calculation

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

  // ============================================
  // ROTATION INDICATOR SYSTEM
  // ============================================
  private rotationIndicator!: Phaser.GameObjects.Graphics; // Graphics for rotation indicator
  private shipDirectionGraphics!: Phaser.GameObjects.Graphics; // Graphics for ship direction lines
  private isRotating: boolean = false; // Are we currently setting rotation?
  private rotationStartPos: Phaser.Math.Vector2 = new Phaser.Math.Vector2(); // Where rotation started
  private rotationCurrentPos: Phaser.Math.Vector2 = new Phaser.Math.Vector2(); // Current mouse position
  private rotationShip: Ship | null = null; // Which ship we're rotating

  // ============================================
  // TARGETING SYSTEM
  // ============================================
  private isTargeting: boolean = false; // Are we currently in targeting mode?
  private targetedEnemy: Ship | null = null; // Which enemy we're targeting
  private targetingCircle: Phaser.GameObjects.Graphics | null = null; // Red circle around enemy
  private targetingSnapRange: number = 50; // Distance to snap to enemy (pixels)
  private targetingReleaseRange: number = 100; // Distance to release from targeting (pixels)

  // ============================================
  // WAYPOINT LOCKING SYSTEM
  // ============================================
  private isWaypointLocked: boolean = false; // Is the waypoint locked to an enemy?
  private lockedEnemy: Ship | null = null; // Which enemy the waypoint is locked to
  private lockedDistance: number = 0; // Distance from enemy when locked
  private lockedWaypointPosition: Phaser.Math.Vector2 = new Phaser.Math.Vector2(); // Current locked waypoint position

  // ============================================
  // WAYPOINT PATH VISUALIZATION
  // ============================================
  private waypointPathGraphics!: Phaser.GameObjects.Graphics; // Graphics for showing waypoint paths

  // ============================================
  // ENEMY RANDOM MOVEMENT
  // ============================================
  private enemyMovementTimers: Map<Ship, number> = new Map(); // Track when each enemy last changed direction
  private enemyMovementDirections: Map<Ship, Phaser.Math.Vector2> = new Map(); // Current movement direction for each enemy

  // ============================================
  // CAMERA CONTROLS
  // ============================================
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys; // Arrow key controls
  private cameraSpeed: number = 200; // Camera movement speed (pixels per second)
  private minZoom: number = 0.5; // Minimum zoom level
  private maxZoom: number = 2.0; // Maximum zoom level
  private zoomSpeed: number = 0.1; // How fast to zoom in/out
  private isDraggingCamera: boolean = false; // Are we currently dragging the camera?
  private cameraDragStart: Phaser.Math.Vector2 = new Phaser.Math.Vector2(); // Where camera drag started
  private cameraStartScroll: Phaser.Math.Vector2 = new Phaser.Math.Vector2(); // Camera scroll position when drag started

  // Following flag
  private isFollowingShip: boolean = false; // Is the camera following a ship?
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
   * This runs before the game starts. Load images,
   * sounds, and other assets here.
   */
  preload() {
    // Load ship images
    this.load.image('player_ship', 'src/assets/ship_player_1.png');
    this.load.image('player_ship_highlight', 'src/assets/ship_player_1_highlight.png');
    this.load.image('enemy_ship', 'src/assets/ship_enemy_1.png');
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
    // CREATE SPACE BACKGROUND
    // ============================================
    this.createSpaceBackground();

    // ============================================
    // CREATE PLAYER SHIPS
    // ============================================

    // Create 2 Corvettes (fast, light ships) - positioned near the center of the world
    const worldCenterX = this.scale.width * 1.5;
    const worldCenterY = this.scale.height * 1.5;
    const corvettePositions = [
      { x: worldCenterX - 60, y: worldCenterY - 30 }, // Left of center
      { x: worldCenterX + 40, y: worldCenterY + 30 }, // Right of center
    ];

    corvettePositions.forEach((pos, index) => {
      const corvette = this.createShip('corvette', pos.x, pos.y);
      this.ships.push(corvette); // Add to our list of all ships
    });

    // ============================================
    // CREATE HOME ICON
    // ============================================

    // Create a home icon in the center of the world
    const homeIcon = this.add.polygon(
      worldCenterX,
      worldCenterY,
      [0, -15, -10, 5, -5, 5, -5, 15, 5, 15, 5, 5, 10, 5],
      0xffffff,
      0.8
    );
    homeIcon.setStrokeStyle(2, 0x000000, 1);
    homeIcon.setDepth(500);

    // ============================================
    // CREATE ENEMY SHIPS
    // ============================================

    // Create exactly 1 enemy ship at the bottom of the world
    const enemy = this.createShip('enemy', worldCenterX, worldCenterY + 300);
    this.enemyShips.push(enemy); // Add to enemy list for AI
    this.ships.push(enemy); // Also add to general ships list

    // Initialize enemy random movement
    this.initializeEnemyMovement(enemy);

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

    // Create graphics object for drawing the rotation indicator
    this.rotationIndicator = this.add.graphics().setDepth(975);

    // Create graphics object for drawing ship direction lines
    this.shipDirectionGraphics = this.add.graphics().setDepth(1000);

    // Create graphics object for drawing waypoint paths
    this.waypointPathGraphics = this.add.graphics().setDepth(850);

    // ============================================
    // SETUP USER INPUT HANDLING
    // ============================================

    // Handle mouse clicks for ship selection, movement, and rotation
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

          // Normal left click - select ships or start movement/rotation
          const clickedShip = this.ships.find(
            (ship) => ship.gameObject === currentlyOver.find((obj) => obj === ship.gameObject)
          );
          if (clickedShip) {
            if (clickedShip.type === 'enemy') {
              const currentShip = Array.from(this.selectedShips)[0];
              console.log('Selected ship: ', currentShip);
              console.log('HA HA HA HA HA HA ');
              console.log('enemy ship is: ');
              console.log(enemy);
              this.updateShipFollowingPosition(currentShip, enemy);
            } else {
              // Clicked on a ship - select only this ship and start rotation mode
              this.selectOnlyShip(clickedShip);
              this.startRotationOrMovement(pointer);
            }
          } else if (this.selectedShips.size > 0) {
            console.log('start movement');
            // Clicked on empty space with ships selected - start rotation/movement
            this.startRotationOrMovement(pointer);
          } else {
            // Clicked on empty space with no selection - start box selection
            this.startBoxSelection(pointer);
          }
        } else if (pointer.rightButtonDown()) {
          // RIGHT CLICK - Start camera dragging
          this.startCameraDrag(pointer);
        }
      }
    );

    // Handle mouse movement for box selection, rotation, camera dragging, and waypoint highlighting
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isBoxSelecting) {
        // Update the selection box as the mouse moves
        this.boxEndX = pointer.worldX;
        this.boxEndY = pointer.worldY;
        this.drawSelectionBox();
      } else if (this.isRotating && this.rotationShip) {
        // Update rotation indicator as the mouse moves
        this.rotationCurrentPos.set(pointer.worldX, pointer.worldY);
        this.drawRotationIndicator();
      } else if (this.isDraggingCamera) {
        // Update camera position as the mouse moves
        this.updateCameraDrag(pointer);
      }

      // Handle waypoint dot highlighting when shift is held
      const shiftHeld = (pointer.event as MouseEvent).shiftKey === true;
      if (shiftHeld) {
        const hoveredDot = this.getHoveredDot(pointer);

        // Reset all waypoint dots to normal color
        this.ships.forEach((ship) => {
          ship.waypointDots.forEach((dot) => {
            const circle = dot.getAt(0) as Phaser.GameObjects.Arc;
            if (circle) {
              circle.setFillStyle(VARIABLES[ship.type].color, 1);
            }
          });
        });

        // Highlight the waypoint dot under the mouse
        if (hoveredDot) {
          const circle = hoveredDot.dot.getAt(0) as Phaser.GameObjects.Arc;
          if (circle) {
            circle.setFillStyle(0xffffff, 1);
          }
        }
      } else {
        // Reset all dots to normal color when shift is not held
        this.ships.forEach((ship) => {
          ship.waypointDots.forEach((dot) => {
            const circle = dot.getAt(0) as Phaser.GameObjects.Arc;
            if (circle) {
              circle.setFillStyle(VARIABLES[ship.type].color, 1);
            }
          });
        });
      }
    });

    // Handle mouse release (finish box selection, rotation, or camera drag)
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isBoxSelecting) {
        this.finishBoxSelection();
      } else if (this.isRotating && this.rotationShip) {
        this.finishRotation(pointer);
      } else if (this.isDraggingCamera) {
        this.finishCameraDrag();
      }
    });

    // ============================================
    // CREATE USER INTERFACE
    // ============================================

    // Selection buttons removed - using direct ship clicking and box selection only

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

    // Add FPS counter to the debug panel (read-only display)
    this.gui
      .add(this.params, 'fps', 0, 120, 1)
      .name('FPS')
      .listen() // This makes it update automatically
      .disable(); // This makes it read-only (display only)

    // Clean up the debug panel when the game shuts down
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.gui.destroy();
    });

    // Disable the browser's right-click context menu inside the game
    this.input.mouse?.disableContextMenu();

    // ============================================
    // SETUP CAMERA CONTROLS
    // ============================================

    // Set up camera with larger world bounds for scrolling
    this.cameras.main.setBounds(0, 0, this.scale.width * 3, this.scale.height * 3);
    this.cameras.main.centerOn(this.scale.width * 1.5, this.scale.height * 1.5);

    // Arrow key controls
    const cursors = this.input.keyboard?.createCursorKeys();
    if (cursors) {
      this.cursors = cursors;
    }

    // Mouse wheel zoom
    this.input.on(
      'wheel',
      (
        pointer: Phaser.Input.Pointer,
        gameObjects: Phaser.GameObjects.GameObject[],
        deltaX: number,
        deltaY: number,
        deltaZ: number
      ) => {
        this.handleMouseWheel(deltaY);
      }
    );
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
    // UPDATE FPS COUNTER
    // ============================================
    this.updateFpsCounter(time);

    // ============================================
    // UPDATE CAMERA CONTROLS
    // ============================================
    this.updateCameraControls(delta);

    // ============================================
    // UPDATE ALL GAME OBJECTS
    // ============================================

    // Clear graphics at the start of each frame
    this.shipDirectionGraphics.clear();
    this.waypointPathGraphics.clear();

    // Update all ships (movement, collision detection, etc.)
    this.ships.forEach((ship) => {
      this.updateShip(ship, delta);
    });

    // Draw waypoint paths if shift is held
    this.drawWaypointPaths();

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

    // Path lines removed - waypoint dots now show direction with arrows
  }

  // Update individual ship
  private updateShip(ship: Ship, delta: number) {
    const shipData = VARIABLES[ship.type];
    const dt = delta / 1000;

    // Update rotation smoothly
    const rotationSpeed = shipData.rotationSpeed; // radians per second
    const rotationDelta = rotationSpeed * dt;
    ship.rotation = this.approachRotation(ship.rotation, ship.targetRotation, rotationDelta);
    ship.gameObject.setRotation(ship.rotation);

    // Update highlight image position and rotation to match the main ship
    if (ship.highlightImage) {
      ship.highlightImage.setPosition(ship.gameObject.x, ship.gameObject.y);
      ship.highlightImage.setRotation(ship.rotation);
    }

    // DEBUG: Draw a line showing the ship's forward direction
    if (ship === this.selectedShips.values().next().value) {
      this.drawShipDirection(ship);
    }

    // Compute current speed with acceleration/deceleration
    const desired = ship.target ? shipData.speed : 0;
    const accel = Math.max(ship.currentSpeed, desired) / (shipData.acceleration / 100);
    ship.currentSpeed = this.approach(ship.currentSpeed, desired, accel * dt);

    // If this ship is following another ship, update its target to follow
    if (ship.followTarget && ship.followTarget.gameObject) {
      // Follow position with a small offset behind the followed ship
      const followedPos = new Phaser.Math.Vector2(
        ship.followTarget.gameObject.x,
        ship.followTarget.gameObject.y
      );
      // Maintain an offset so follower doesn't overlap; place follower 80 px behind in direction of followed rotation
      const offsetDistance = -200;
      const behindX =
        followedPos.x - Math.cos(ship.followTarget.gameObject.rotation) * offsetDistance;
      const behindY =
        followedPos.y - Math.sin(ship.followTarget.gameObject.rotation) * offsetDistance;
      const followTargetPos = new Phaser.Math.Vector2(behindX, behindY);

      // If follower doesn't already have waypoints or manual target, set/replace immediate target
      ship.target = followTargetPos;
      // Also ensure waypoint array is empty so normal arrival logic applies
      if (ship.waypoints.length === 0) {
        ship.pathStart = this.getObjectCenter(ship.gameObject);
      }
    }

    // Move ship toward target (only the first waypoint)
    ship.target = this.moveToward(ship, ship.target, ship.currentSpeed, delta);

    // Apply separation force if ship has reached destination (no waypoints)
    if (!ship.waypoints.length && ship.target === null) {
      this.applySeparationForce(ship, delta);
    }

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

      // Get the direction for the waypoint we just reached BEFORE shifting arrays
      const currentWaypointDirection =
        ship.waypointDirections.length > 0 ? ship.waypointDirections[0] : undefined;

      // Set rotation to the direction for the waypoint we just reached
      if (currentWaypointDirection !== undefined) {
        ship.targetRotation = currentWaypointDirection;
      }

      // Advance to next waypoint AFTER getting the direction
      ship.waypoints.shift();
      ship.waypointDirections.shift();

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

    // Collision detection removed - ships can now overlap

    // Clamp overshoot
    if (nextPos.distance(target) > distance) {
      // Move to target position (collision detection removed)
      ship.gameObject.setPosition(target.x, target.y);
      this.updateHealthBar(ship);

      // Get the direction for the waypoint we just reached BEFORE shifting arrays
      const currentWaypointDirection =
        ship.waypointDirections.length > 0 ? ship.waypointDirections[0] : undefined;

      // Set rotation to the direction for the waypoint we just reached
      if (currentWaypointDirection !== undefined) {
        ship.targetRotation = currentWaypointDirection;
      }

      // Advance to next waypoint AFTER getting the direction
      ship.waypoints.shift();
      ship.waypointDirections.shift();

      this.updateWaypointDots(ship);
      const next = ship.waypoints[0] ?? null;
      if (next) {
        ship.pathStart = new Phaser.Math.Vector2(target.x, target.y);
      } else {
        ship.pathStart = null;
      }
      return next;
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

      // Update random movement
      this.updateEnemyRandomMovement(enemyShip, delta);

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

        // Keep enemy within world bounds even when chasing
        const worldWidth = this.scale.width * 3;
        const worldHeight = this.scale.height * 3;
        targetPos.x = Math.max(50, Math.min(worldWidth - 50, targetPos.x));
        targetPos.y = Math.max(50, Math.min(worldHeight - 50, targetPos.y));

        enemyShip.target = targetPos;

        // Try to shoot if in range
        if (closestDistance <= enemyData.weapon.range) {
          this.tryShoot(enemyShip, closestShip);
        }
      } else {
        // Use random movement when no player ships in range
        const randomDirection = this.enemyMovementDirections.get(enemyShip);
        if (randomDirection) {
          const currentPos = new Phaser.Math.Vector2(
            enemyShip.gameObject.x,
            enemyShip.gameObject.y
          );
          const targetPos = currentPos.clone().add(randomDirection.scale(100)); // Move 100 pixels in random direction

          // Keep enemy within world bounds
          const worldWidth = this.scale.width * 3;
          const worldHeight = this.scale.height * 3;
          targetPos.x = Math.max(50, Math.min(worldWidth - 50, targetPos.x));
          targetPos.y = Math.max(50, Math.min(worldHeight - 50, targetPos.y));

          enemyShip.target = targetPos;
        }
      }
    });
  }

  // Initialize enemy random movement
  private initializeEnemyMovement(enemy: Ship) {
    const currentTime = this.time.now;
    this.enemyMovementTimers.set(enemy, currentTime);

    // Generate random direction
    const randomAngle = Math.random() * Math.PI * 2; // Random angle 0 to 2π
    const randomDirection = new Phaser.Math.Vector2(Math.cos(randomAngle), Math.sin(randomAngle));
    this.enemyMovementDirections.set(enemy, randomDirection);
  }

  // Update enemy random movement
  private updateEnemyRandomMovement(enemy: Ship, delta: number) {
    const currentTime = this.time.now;
    const lastChangeTime = this.enemyMovementTimers.get(enemy) || 0;

    // Change direction every 30 seconds (30000ms)
    if (currentTime - lastChangeTime >= 30000) {
      // Generate new random direction
      const randomAngle = Math.random() * Math.PI * 2; // Random angle 0 to 2π
      const randomDirection = new Phaser.Math.Vector2(Math.cos(randomAngle), Math.sin(randomAngle));
      this.enemyMovementDirections.set(enemy, randomDirection);
      this.enemyMovementTimers.set(enemy, currentTime);
    }
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
      const shooter = this.bulletShooters[i];

      if (!bullet || !velocity || timer === undefined) {
        // Clean up invalid entries
        this.bullets.splice(i, 1);
        this.bulletVelocities.splice(i, 1);
        this.bulletTimers.splice(i, 1);
        this.bulletShooters.splice(i, 1);
        continue;
      }

      // Move bullet
      bullet.x += velocity.x * (delta / 1000);
      bullet.y += velocity.y * (delta / 1000);

      // Update timer
      this.bulletTimers[i] = timer - delta;

      // Remove bullet if expired or out of world bounds
      const worldWidth = this.scale.width * 3;
      const worldHeight = this.scale.height * 3;
      if (
        this.bulletTimers[i]! <= 0 ||
        bullet.x < 0 ||
        bullet.x > worldWidth ||
        bullet.y < 0 ||
        bullet.y > worldHeight
      ) {
        bullet.destroy();
        this.bullets.splice(i, 1);
        this.bulletVelocities.splice(i, 1);
        this.bulletTimers.splice(i, 1);
        this.bulletShooters.splice(i, 1);
      } else {
        // Check for collisions
        this.checkBulletCollisions(bullet, i, shooter);
      }
    }
  }

  // Check bullet collisions
  private checkBulletCollisions(
    bullet: Phaser.GameObjects.Arc,
    bulletIndex: number,
    shooter: Ship | undefined
  ) {
    const bulletPos = new Phaser.Math.Vector2(bullet.x, bullet.y);

    this.ships.forEach((ship) => {
      // Don't hit the ship that shot the bullet
      if (ship === shooter) return;

      const shipPos = new Phaser.Math.Vector2(ship.gameObject.x, ship.gameObject.y);
      const distance = bulletPos.distance(shipPos);

      if (distance < VARIABLES[ship.type].size / 2) {
        // Hit! Apply damage based on shooter's weapon
        let damage = 10; // Default damage
        if (shooter) {
          damage = VARIABLES[shooter.type].weapon.damage;
        }

        ship.health -= damage;
        this.updateHealthBar(ship);

        // Create damage effect
        this.createDamageEffect(shipPos.x, shipPos.y, shooter || null);

        // Remove bullet
        bullet.destroy();
        this.bullets.splice(bulletIndex, 1);
        this.bulletVelocities.splice(bulletIndex, 1);
        this.bulletTimers.splice(bulletIndex, 1);
        this.bulletShooters.splice(bulletIndex, 1);

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
    this.bulletShooters.push(shooter);
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

    // Destroy game object, highlight image, health bar, and waypoint dots
    ship.gameObject.destroy();
    if (ship.highlightImage) {
      ship.highlightImage.destroy();
    }
    ship.healthBar.destroy();
    ship.waypointDots.forEach((dot) => dot.destroy());

    // Remove circular path if exists
    this.circularPaths.delete(ship);

    // Clean up enemy movement data if it's an enemy
    if (ship.type === 'enemy') {
      this.enemyMovementTimers.delete(ship);
      this.enemyMovementDirections.delete(ship);
    }
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

        // Move ship (collision detection removed)
        ship.gameObject.setPosition(newX, newY);
        this.updateHealthBar(ship);
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

  // Compute the object center in world space so lines originate from the ship's middle
  private getObjectCenter(obj: Phaser.GameObjects.Image): Phaser.Math.Vector2 {
    // For images, just use the object's position since they're centered
    return new Phaser.Math.Vector2(obj.x, obj.y);
  }

  // Linear approach helper: move current toward target by maxDelta
  private approach(current: number, target: number, maxDelta: number): number {
    if (current < target) return Math.min(current + maxDelta, target);
    if (current > target) return Math.max(current - maxDelta, target);
    return current;
  }

  // Apply separation force to prevent ships from overlapping at destination
  private applySeparationForce(ship: Ship, delta: number) {
    const shipPos = new Phaser.Math.Vector2(ship.gameObject.x, ship.gameObject.y);
    const minDistance = VARIABLES.separation.minDistance;
    const separationForce = VARIABLES.separation.separationForce;

    let separationVector = new Phaser.Math.Vector2(0, 0);
    let nearbyShipsCount = 0;

    // Check all other ships for proximity
    for (const otherShip of this.ships) {
      if (otherShip === ship) continue;

      const otherPos = new Phaser.Math.Vector2(otherShip.gameObject.x, otherShip.gameObject.y);
      const distance = shipPos.distance(otherPos);

      // If ships are too close, calculate separation force
      if (distance < minDistance && distance > 0) {
        const direction = shipPos.clone().subtract(otherPos).normalize();
        const force = (minDistance - distance) / minDistance; // Stronger force when closer
        separationVector.add(direction.scale(force));
        nearbyShipsCount++;
      }
    }

    // Apply separation force if there are nearby ships
    if (nearbyShipsCount > 0) {
      separationVector.normalize();
      const moveDistance = separationForce * (delta / 1000); // Scale by delta time
      const newPos = shipPos.add(separationVector.scale(moveDistance));

      // Keep ships within world bounds
      const worldWidth = this.scale.width * 3;
      const worldHeight = this.scale.height * 3;
      newPos.x = Math.max(0, Math.min(worldWidth, newPos.x));
      newPos.y = Math.max(0, Math.min(worldHeight, newPos.y));

      ship.gameObject.setPosition(newPos.x, newPos.y);
      this.updateHealthBar(ship);
    }
  }

  // Box selection helper methods

  private selectOnlyShip(ship: Ship) {
    this.selectedShips.clear();
    this.selectedShips.add(ship);
    console.log('Selected ship:', this.selectedShips);
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
    // Reset all ships to their default appearance
    this.ships.forEach((ship) => {
      ship.gameObject.setTint(0xffffff); // Reset to normal color
      // Hide highlight image for all ships
      if (ship.highlightImage) {
        ship.highlightImage.setVisible(false);
      }
    });

    // Show highlight image for selected ships
    this.selectedShips.forEach((ship) => {
      if (ship.highlightImage) {
        ship.highlightImage.setVisible(true);
      }
    });
  }

  // Create a waypoint dot with direction arrow
  private createWaypointDot(
    x: number,
    y: number,
    direction?: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Create the dot
    const dot = this.add.circle(0, 0, 3, VARIABLES.corvette.color, 1);
    dot.setInteractive({ useHandCursor: true });

    container.add(dot);

    // Add direction arrow if direction is provided
    if (direction !== undefined) {
      const arrowLength = 30; // Increased from 10 to 30 pixels
      const arrowEndX = Math.cos(direction) * arrowLength;
      const arrowEndY = Math.sin(direction) * arrowLength;

      // Create arrow line
      const arrowLine = this.add.graphics();
      arrowLine.lineStyle(2, VARIABLES.corvette.color, 1);
      arrowLine.beginPath();
      arrowLine.moveTo(0, 0);
      arrowLine.lineTo(arrowEndX, arrowEndY);
      arrowLine.strokePath();

      // Create arrowhead - same size as rotation indicator arrow
      const arrowHeadLength = 15; // Increased from 6 to 15 to match rotation indicator
      const arrowAngle1 = direction - Math.PI / 6;
      const arrowAngle2 = direction + Math.PI / 6;

      const headX1 = arrowEndX - Math.cos(arrowAngle1) * arrowHeadLength;
      const headY1 = arrowEndY - Math.sin(arrowAngle1) * arrowHeadLength;
      const headX2 = arrowEndX - Math.cos(arrowAngle2) * arrowHeadLength;
      const headY2 = arrowEndY - Math.sin(arrowAngle2) * arrowHeadLength;

      arrowLine.beginPath();
      arrowLine.moveTo(arrowEndX, arrowEndY);
      arrowLine.lineTo(headX1, headY1);
      arrowLine.moveTo(arrowEndX, arrowEndY);
      arrowLine.lineTo(headX2, headY2);
      arrowLine.strokePath();

      container.add(arrowLine);
    }

    container.setDepth(850);
    return container;
  }

  // Update waypoint dots for a ship
  private updateWaypointDots(ship: Ship) {
    // Remove existing dots
    ship.waypointDots.forEach((dot) => dot.destroy());
    ship.waypointDots.length = 0;

    // Create new dots for each waypoint
    ship.waypoints.forEach((waypoint, index) => {
      // Use the stored direction for this waypoint
      const direction = ship.waypointDirections[index];
      const dot = this.createWaypointDot(waypoint.x, waypoint.y, direction);
      ship.waypointDots.push(dot);
    });
  }

  // Check if pointer is hovering over a waypoint dot
  private getHoveredDot(
    pointer: Phaser.Input.Pointer
  ): { dot: Phaser.GameObjects.Container; ship: Ship; waypointIndex: number } | null {
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
    let gameObject: Phaser.GameObjects.Image;
    let highlightImage: Phaser.GameObjects.Image | null = null;

    if (type === 'corvette') {
      // Use player ship image for corvettes
      gameObject = this.add.image(x, y, 'player_ship');
      // Create highlight image for player ships
      highlightImage = this.add.image(x, y, 'player_ship_highlight');
    } else if (type === 'enemy') {
      // Use enemy ship image for enemies
      gameObject = this.add.image(x, y, 'enemy_ship');
      // No highlight image for enemy ships
    } else {
      // For cruiser (though we removed cruisers, keeping for completeness)
      gameObject = this.add.image(x, y, 'player_ship');
      // Create highlight image for player ships
      highlightImage = this.add.image(x, y, 'player_ship_highlight');
    }

    // Set ship size and make it interactive
    gameObject.setScale(shipData.size / 32); // Assuming original image is 32x32
    gameObject.setOrigin(0.5, 0.5);
    gameObject.setRotation(Math.PI / 2); // Flip sprite 90 degrees to fix orientation
    gameObject.setInteractive();
    if (gameObject.input) gameObject.input.cursor = 'pointer';

    // Set up highlight image if it exists
    if (highlightImage) {
      highlightImage.setScale(shipData.size / 32); // Same scale as main ship
      highlightImage.setOrigin(0.5, 0.5);
      highlightImage.setRotation(Math.PI / 2); // Same rotation as main ship
      highlightImage.setDepth(gameObject.depth + 1); // Slightly above the main ship
      highlightImage.setVisible(false); // Hidden by default
    }

    // Create health bar
    const healthBar = this.add.graphics();
    healthBar.setDepth(700);

    const ship = {
      gameObject,
      highlightImage,
      type,
      target: null,
      pathStart: null,
      waypoints: [],
      waypointDirections: [],
      currentSpeed: 0,
      waypointDots: [],
      lastFireTime: 0,
      health: shipData.health,
      maxHealth: shipData.health,
      healthBar,
      rotation: -Math.PI / 2, // Start facing north (up) - adjusted for flipped sprite
      targetRotation: -Math.PI / 2, // Start facing north (up) - adjusted for flipped sprite
      followTarget: null,
    };

    // Update health bar display
    this.updateHealthBar(ship);

    return ship;
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

  /**
   * UPDATE CAMERA CONTROLS
   * ======================
   *
   * Handles all camera movement and zoom controls including:
   * - Arrow key scrolling
   * - Mouse wheel zoom
   */
  private updateCameraControls(delta: number) {
    const camera = this.cameras.main;
    const speed = this.cameraSpeed * (delta / 1000); // Convert to pixels per frame

    // Arrow key controls
    if (this.cursors) {
      if (this.cursors.left.isDown) {
        camera.scrollX -= speed;
      }
      if (this.cursors.right.isDown) {
        camera.scrollX += speed;
      }
      if (this.cursors.up.isDown) {
        camera.scrollY -= speed;
      }
      if (this.cursors.down.isDown) {
        camera.scrollY += speed;
      }
    }
  }

  /**
   * Update FPS counter
   * ==================
   *
   * Calculates and updates the current FPS value for display in the debug panel.
   * Updates every second to provide a smooth reading.
   */
  private updateFpsCounter(time: number) {
    this.frameCount++;

    // Initialize on first frame
    if (this.lastFpsUpdate === 0) {
      this.lastFpsUpdate = time;
      return;
    }

    // Update FPS every second
    if (time - this.lastFpsUpdate >= 1000) {
      this.fpsCounter = Math.round((this.frameCount * 1000) / (time - this.lastFpsUpdate));
      this.params.fps = this.fpsCounter;
      this.frameCount = 0;
      this.lastFpsUpdate = time;
    }
  }

  /**
   * HANDLE MOUSE WHEEL ZOOM
   * =======================
   *
   * Handles mouse wheel zoom in/out functionality.
   * @param deltaY - The wheel delta (positive = zoom out, negative = zoom in)
   */
  private handleMouseWheel(deltaY: number) {
    const camera = this.cameras.main;
    const currentZoom = camera.zoom;

    // Calculate new zoom level
    let newZoom = currentZoom;
    if (deltaY > 0) {
      // Zoom out
      newZoom = Math.max(this.minZoom, currentZoom - this.zoomSpeed);
    } else if (deltaY < 0) {
      // Zoom in
      newZoom = Math.min(this.maxZoom, currentZoom + this.zoomSpeed);
    }

    // Apply zoom if it changed
    if (newZoom !== currentZoom) {
      camera.setZoom(newZoom);
    }
  }

  /**
   * ROTATION HANDLING METHODS
   * =========================
   *
   * Methods for handling ship rotation with visual indicators.
   */

  // Start rotation or movement when clicking on empty space with ships selected
  private startRotationOrMovement(pointer: Phaser.Input.Pointer) {
    // Get the first selected ship for rotation reference
    const firstSelectedShip = Array.from(this.selectedShips)[0];
    if (!firstSelectedShip) return;

    // Start rotation mode
    this.isRotating = true;
    this.rotationShip = firstSelectedShip;
    this.rotationStartPos.set(pointer.worldX, pointer.worldY);
    this.rotationCurrentPos.set(pointer.worldX, pointer.worldY);

    // Draw initial rotation indicator
    this.drawRotationIndicator();
  }

  // update ship position via enemy ship position
  private updateShipFollowingPosition(currentShip: Ship | undefined, enemyShip: Ship | undefined) {
    if (!currentShip || !enemyShip) return;

    // Set the ship to follow the enemy ship
    currentShip.followTarget = enemyShip;

    // Start rotation/follow indicator positioned slightly ahead of the enemy so user sees the command
    const indicatorX = enemyShip.gameObject.x;
    const indicatorY = enemyShip.gameObject.y - 100;

    this.isRotating = true;
    this.rotationShip = currentShip;
    this.rotationCurrentPos.set(indicatorX, indicatorY);
    this.rotationStartPos.set(indicatorX, indicatorY);

    // Immediately set an initial target just behind the enemy so the follower starts moving
    const behindX = enemyShip.gameObject.x - Math.cos(enemyShip.gameObject.rotation) * 80;
    const behindY = enemyShip.gameObject.y - Math.sin(enemyShip.gameObject.rotation) * 80;
    currentShip.target = new Phaser.Math.Vector2(behindX, behindY);
    currentShip.waypoints = [];
    currentShip.waypointDirections = [];

    this.drawRotationIndicator();
  }

  // Draw the rotation indicator (green dot + rotating arrow) or targeting mode
  private drawRotationIndicator() {
    if (!this.rotationShip) return;

    this.rotationIndicator.clear();

    // Check if we're near an enemy and should enter targeting mode or lock waypoint
    const nearestEnemy = this.findNearestEnemy(this.rotationCurrentPos);

    if (nearestEnemy) {
      const distanceToEnemy = this.rotationCurrentPos.distance(
        new Phaser.Math.Vector2(nearestEnemy.gameObject.x, nearestEnemy.gameObject.y)
      );

      if (distanceToEnemy <= this.targetingSnapRange) {
        // Check if we're dragging a waypoint (not just rotating)
        const isDraggingWaypoint = this.rotationStartPos.distance(this.rotationCurrentPos) > 10;

        if (isDraggingWaypoint && !this.isWaypointLocked) {
          // Lock the waypoint to this enemy
          this.lockWaypointToEnemy(nearestEnemy);
        } else if (!isDraggingWaypoint && !this.isTargeting) {
          // Enter normal targeting mode
          this.enterTargetingMode(nearestEnemy);
        }
      }
    }

    // Update locked waypoint position if we have one
    if (this.isWaypointLocked && this.lockedEnemy) {
      this.updateLockedWaypointPosition();
    }

    if (this.isTargeting && this.targetedEnemy) {
      // We're in targeting mode - show targeting circle/arrow
      this.updateTargetingMode();
    } else if (this.isWaypointLocked && this.lockedEnemy) {
      // We have a locked waypoint - show targeting from locked position
      this.updateLockedWaypointTargeting();
    } else {
      // Normal rotation mode - draw green dot and arrow
      this.drawNormalRotationIndicator();
    }
  }

  // Draw normal rotation indicator (green dot + arrow)
  private drawNormalRotationIndicator() {
    // Draw green dot at start position
    this.rotationIndicator.fillStyle(0x00ff00, 1);
    this.rotationIndicator.fillCircle(this.rotationStartPos.x, this.rotationStartPos.y, 4);

    // Calculate angle from start to current position
    const deltaX = this.rotationCurrentPos.x - this.rotationStartPos.x;
    const deltaY = this.rotationCurrentPos.y - this.rotationStartPos.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > 10) {
      // Only draw arrow if mouse moved far enough
      const angle = Math.atan2(deltaY, deltaX);

      // Draw arrow line
      this.rotationIndicator.lineStyle(2, 0x00ff00, 1);
      this.rotationIndicator.beginPath();
      this.rotationIndicator.moveTo(this.rotationStartPos.x, this.rotationStartPos.y);
      this.rotationIndicator.lineTo(this.rotationCurrentPos.x, this.rotationCurrentPos.y);
      this.rotationIndicator.strokePath();

      // Draw arrowhead
      const arrowLength = 15;
      const arrowAngle1 = angle - Math.PI / 6;
      const arrowAngle2 = angle + Math.PI / 6;

      const arrowX1 = this.rotationCurrentPos.x - Math.cos(arrowAngle1) * arrowLength;
      const arrowY1 = this.rotationCurrentPos.y - Math.sin(arrowAngle1) * arrowLength;
      const arrowX2 = this.rotationCurrentPos.x - Math.cos(arrowAngle2) * arrowLength;
      const arrowY2 = this.rotationCurrentPos.y - Math.sin(arrowAngle2) * arrowLength;

      this.rotationIndicator.beginPath();
      this.rotationIndicator.moveTo(this.rotationCurrentPos.x, this.rotationCurrentPos.y);
      this.rotationIndicator.lineTo(arrowX1, arrowY1);
      this.rotationIndicator.moveTo(this.rotationCurrentPos.x, this.rotationCurrentPos.y);
      this.rotationIndicator.lineTo(arrowX2, arrowY2);
      this.rotationIndicator.strokePath();
    }
  }

  // Find the nearest enemy to a given position
  private findNearestEnemy(position: Phaser.Math.Vector2): Ship | null {
    let nearestEnemy: Ship | null = null;
    let nearestDistance = Infinity;

    for (const enemy of this.enemyShips) {
      const distance = position.distance(
        new Phaser.Math.Vector2(enemy.gameObject.x, enemy.gameObject.y)
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestEnemy = enemy;
      }
    }

    return nearestEnemy;
  }

  // Enter targeting mode
  private enterTargetingMode(enemy: Ship) {
    this.isTargeting = true;
    this.targetedEnemy = enemy;

    // Create red circle around enemy
    this.targetingCircle = this.add.graphics();
    this.targetingCircle.setDepth(1000); // Above everything else
  }

  // Update targeting mode
  private updateTargetingMode() {
    if (!this.targetedEnemy || !this.targetingCircle) return;

    // Check if we should exit targeting mode
    const distanceToEnemy = this.rotationCurrentPos.distance(
      new Phaser.Math.Vector2(this.targetedEnemy.gameObject.x, this.targetedEnemy.gameObject.y)
    );

    if (distanceToEnemy > this.targetingReleaseRange) {
      // Exit targeting mode
      this.exitTargetingMode();
      return;
    }

    // Clear previous drawing
    this.targetingCircle.clear();

    const enemyPos = new Phaser.Math.Vector2(
      this.targetedEnemy.gameObject.x,
      this.targetedEnemy.gameObject.y
    );

    // Draw red circle around enemy
    this.targetingCircle.lineStyle(3, 0xff0000, 1); // Red color, 3px thick
    this.targetingCircle.strokeCircle(enemyPos.x, enemyPos.y, 40); // 40px radius circle

    // Calculate the angle from enemy to cursor
    const angleToCursor = Math.atan2(
      this.rotationCurrentPos.y - enemyPos.y,
      this.rotationCurrentPos.x - enemyPos.x
    );

    // Draw red arrow from enemy center pointing toward cursor
    const arrowLength = 50;
    const arrowEndX = enemyPos.x + Math.cos(angleToCursor) * arrowLength;
    const arrowEndY = enemyPos.y + Math.sin(angleToCursor) * arrowLength;

    // Draw arrow line
    this.targetingCircle.lineStyle(3, 0xff0000, 1); // Red color, 3px thick
    this.targetingCircle.beginPath();
    this.targetingCircle.moveTo(enemyPos.x, enemyPos.y);
    this.targetingCircle.lineTo(arrowEndX, arrowEndY);
    this.targetingCircle.strokePath();

    // Draw arrowhead
    const arrowHeadLength = 15;
    const arrowAngle1 = angleToCursor - Math.PI / 6;
    const arrowAngle2 = angleToCursor + Math.PI / 6;

    const headX1 = arrowEndX - Math.cos(arrowAngle1) * arrowHeadLength;
    const headY1 = arrowEndY - Math.sin(arrowAngle1) * arrowHeadLength;
    const headX2 = arrowEndX - Math.cos(arrowAngle2) * arrowHeadLength;
    const headY2 = arrowEndY - Math.sin(arrowAngle2) * arrowHeadLength;

    this.targetingCircle.beginPath();
    this.targetingCircle.moveTo(arrowEndX, arrowEndY);
    this.targetingCircle.lineTo(headX1, headY1);
    this.targetingCircle.moveTo(arrowEndX, arrowEndY);
    this.targetingCircle.lineTo(headX2, headY2);
    this.targetingCircle.strokePath();
  }

  // Exit targeting mode
  private exitTargetingMode() {
    this.isTargeting = false;
    this.targetedEnemy = null;

    if (this.targetingCircle) {
      this.targetingCircle.destroy();
      this.targetingCircle = null;
    }
  }

  // Lock waypoint to an enemy
  private lockWaypointToEnemy(enemy: Ship) {
    this.isWaypointLocked = true;
    this.lockedEnemy = enemy;

    // Calculate the distance from enemy to current waypoint position
    const enemyPos = new Phaser.Math.Vector2(enemy.gameObject.x, enemy.gameObject.y);
    this.lockedDistance = this.rotationCurrentPos.distance(enemyPos);

    // Set initial locked waypoint position
    this.lockedWaypointPosition.copy(this.rotationCurrentPos);

    // Create targeting circle for locked waypoint
    this.targetingCircle = this.add.graphics();
    this.targetingCircle.setDepth(1000); // Above everything else
  }

  // Update locked waypoint position to follow enemy movement
  private updateLockedWaypointPosition() {
    if (!this.lockedEnemy) return;

    const enemyPos = new Phaser.Math.Vector2(
      this.lockedEnemy.gameObject.x,
      this.lockedEnemy.gameObject.y
    );

    // Calculate direction from enemy to current mouse position
    const direction = new Phaser.Math.Vector2(
      this.rotationCurrentPos.x - enemyPos.x,
      this.rotationCurrentPos.y - enemyPos.y
    );
    direction.normalize();

    // Set locked waypoint position at the locked distance from enemy
    this.lockedWaypointPosition.set(
      enemyPos.x + direction.x * this.lockedDistance,
      enemyPos.y + direction.y * this.lockedDistance
    );
  }

  // Update targeting display for locked waypoint
  private updateLockedWaypointTargeting() {
    if (!this.lockedEnemy || !this.targetingCircle) return;

    // Check if we should unlock the waypoint
    const distanceToEnemy = this.rotationCurrentPos.distance(
      new Phaser.Math.Vector2(this.lockedEnemy.gameObject.x, this.lockedEnemy.gameObject.y)
    );

    if (distanceToEnemy > this.targetingReleaseRange) {
      // Unlock the waypoint
      this.unlockWaypoint();
      return;
    }

    // Clear previous drawing
    this.targetingCircle.clear();

    // Draw red circle around enemy
    this.targetingCircle.lineStyle(3, 0xff0000, 1); // Red color, 3px thick
    this.targetingCircle.strokeCircle(
      this.lockedEnemy.gameObject.x,
      this.lockedEnemy.gameObject.y,
      30
    );

    // Draw red arrow from locked waypoint position toward mouse cursor
    const waypointPos = this.lockedWaypointPosition;
    const mousePos = this.rotationCurrentPos;

    // Calculate angle from waypoint to mouse
    const angleToMouse = Math.atan2(mousePos.y - waypointPos.y, mousePos.x - waypointPos.x);

    // Draw arrow from waypoint to mouse
    const arrowLength = 20;
    const arrowEndX = waypointPos.x + Math.cos(angleToMouse) * arrowLength;
    const arrowEndY = waypointPos.y + Math.sin(angleToMouse) * arrowLength;

    this.targetingCircle.lineStyle(3, 0xff0000, 1);
    this.targetingCircle.beginPath();
    this.targetingCircle.moveTo(waypointPos.x, waypointPos.y);
    this.targetingCircle.lineTo(arrowEndX, arrowEndY);
    this.targetingCircle.strokePath();

    // Draw arrow head
    const headLength = 8;
    const headAngle = Math.PI / 6; // 30 degrees
    const headX1 = arrowEndX - Math.cos(angleToMouse - headAngle) * headLength;
    const headY1 = arrowEndY - Math.sin(angleToMouse - headAngle) * headLength;
    const headX2 = arrowEndX - Math.cos(angleToMouse + headAngle) * headLength;
    const headY2 = arrowEndY - Math.sin(angleToMouse + headAngle) * headLength;

    this.targetingCircle.beginPath();
    this.targetingCircle.moveTo(arrowEndX, arrowEndY);
    this.targetingCircle.lineTo(headX1, headY1);
    this.targetingCircle.moveTo(arrowEndX, arrowEndY);
    this.targetingCircle.lineTo(headX2, headY2);
    this.targetingCircle.strokePath();
  }

  // Unlock waypoint from enemy
  private unlockWaypoint() {
    this.isWaypointLocked = false;
    this.lockedEnemy = null;
    this.lockedDistance = 0;

    if (this.targetingCircle) {
      this.targetingCircle.destroy();
      this.targetingCircle = null;
    }
  }

  // Finish rotation and set ship movement
  private finishRotation(pointer: Phaser.Input.Pointer) {
    if (!this.rotationShip) return;

    // Clear rotation indicator and exit targeting/locking modes if active
    this.rotationIndicator.clear();
    this.exitTargetingMode();
    this.unlockWaypoint();

    const clickPos = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
    const append = (pointer.event as MouseEvent).shiftKey === true;

    // Calculate distance from start to finish
    const deltaX = clickPos.x - this.rotationStartPos.x;
    const deltaY = clickPos.y - this.rotationStartPos.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Always move to the initial click position (where the green dot is)
    this.selectedShips.forEach((ship) => {
      // Clear circular path when giving new movement commands
      this.circularPaths.delete(ship);

      // Move to the initial click position (where the green dot is) or locked waypoint position
      const movementTarget = this.isWaypointLocked
        ? this.lockedWaypointPosition.clone()
        : new Phaser.Math.Vector2(this.rotationStartPos.x, this.rotationStartPos.y);
      const waypointDirection = distance > 10 ? Math.atan2(deltaY, deltaX) : ship.targetRotation;

      if (append && ship.waypoints.length > 0) {
        ship.waypoints.push(movementTarget);
        ship.waypointDirections.push(waypointDirection);
        // Don't change target - keep moving to current target
      } else {
        ship.waypoints = [movementTarget];
        ship.waypointDirections = [waypointDirection];
        ship.pathStart = this.getObjectCenter(ship.gameObject);
        // Set target to the first (and only) waypoint
        ship.target = ship.waypoints[0] ?? null;
      }

      // Set initial rotation to the first waypoint's direction (only for new waypoint sets)
      if (
        !append &&
        ship.waypointDirections.length > 0 &&
        ship.waypointDirections[0] !== undefined
      ) {
        ship.targetRotation = ship.waypointDirections[0];
      }

      this.updateWaypointDots(ship);
    });

    // Only change rotation if mouse moved far enough AND it's a new waypoint set (not appending)
    if (distance > 10) {
      // If mouse moved far enough, set rotation
      const angle = Math.atan2(deltaY, deltaX);

      // Set rotation for all selected ships (only for new waypoint sets, not when appending)
      this.selectedShips.forEach((ship) => {
        const append = (pointer.event as MouseEvent).shiftKey === true;
        if (!append) {
          // Set the ship's rotation to face the arrow direction (only for new waypoint sets)
          ship.targetRotation = angle;
        }
        // When appending, don't change the ship's current rotation - it will rotate when it reaches each waypoint
      });
    }

    // Reset rotation state
    this.isRotating = false;
    this.rotationShip = null;
  }

  // Helper method for smooth rotation interpolation
  private approachRotation(current: number, target: number, maxDelta: number): number {
    let diff = target - current;

    // Handle angle wrapping (shortest path)
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    if (Math.abs(diff) < maxDelta) {
      return target;
    }

    return current + Math.sign(diff) * maxDelta;
  }

  // DEBUG: Draw a line showing the ship's forward direction
  private drawShipDirection(ship: Ship) {
    const shipPos = new Phaser.Math.Vector2(ship.gameObject.x, ship.gameObject.y);
    const directionLength = 40;

    // Check if mouse is hovering over this ship
    const mousePos = this.input.activePointer;
    const shipBounds = ship.gameObject.getBounds();
    const isHovering = shipBounds.contains(mousePos.worldX, mousePos.worldY);

    // Draw red line showing current rotation
    this.shipDirectionGraphics.lineStyle(3, 0xff0000, 1);
    this.shipDirectionGraphics.beginPath();
    this.shipDirectionGraphics.moveTo(shipPos.x, shipPos.y);
    this.shipDirectionGraphics.lineTo(
      shipPos.x + Math.cos(ship.rotation) * directionLength,
      shipPos.y + Math.sin(ship.rotation) * directionLength
    );
    this.shipDirectionGraphics.strokePath();

    // Draw red arrowhead for current rotation
    const redEndX = shipPos.x + Math.cos(ship.rotation) * directionLength;
    const redEndY = shipPos.y + Math.sin(ship.rotation) * directionLength;
    const redAngle = ship.rotation;
    const redArrowLength = 12;
    const redArrowAngle1 = redAngle - Math.PI / 6;
    const redArrowAngle2 = redAngle + Math.PI / 6;

    this.shipDirectionGraphics.beginPath();
    this.shipDirectionGraphics.moveTo(redEndX, redEndY);
    this.shipDirectionGraphics.lineTo(
      redEndX - Math.cos(redArrowAngle1) * redArrowLength,
      redEndY - Math.sin(redArrowAngle1) * redArrowLength
    );
    this.shipDirectionGraphics.moveTo(redEndX, redEndY);
    this.shipDirectionGraphics.lineTo(
      redEndX - Math.cos(redArrowAngle2) * redArrowLength,
      redEndY - Math.sin(redArrowAngle2) * redArrowLength
    );
    this.shipDirectionGraphics.strokePath();

    // Draw direction line - green normally, red when hovering
    const directionColor = isHovering ? 0xff0000 : 0x00ff00; // Red if hovering, green otherwise
    this.shipDirectionGraphics.lineStyle(3, directionColor, 1);
    this.shipDirectionGraphics.beginPath();
    this.shipDirectionGraphics.moveTo(shipPos.x, shipPos.y);

    // Get the raw direction angle (what the user is pointing to)
    const rawDirectionAngle = ship.targetRotation; // Use the target rotation directly

    this.shipDirectionGraphics.lineTo(
      shipPos.x + Math.cos(rawDirectionAngle) * directionLength,
      shipPos.y + Math.sin(rawDirectionAngle) * directionLength
    );
    this.shipDirectionGraphics.strokePath();

    // Draw arrowhead for the direction
    const directionEndX = shipPos.x + Math.cos(rawDirectionAngle) * directionLength;
    const directionEndY = shipPos.y + Math.sin(rawDirectionAngle) * directionLength;
    const directionAngle = rawDirectionAngle;
    const directionArrowLength = 12;
    const directionArrowAngle1 = directionAngle - Math.PI / 6;
    const directionArrowAngle2 = directionAngle + Math.PI / 6;

    this.shipDirectionGraphics.beginPath();
    this.shipDirectionGraphics.moveTo(directionEndX, directionEndY);
    this.shipDirectionGraphics.lineTo(
      directionEndX - Math.cos(directionArrowAngle1) * directionArrowLength,
      directionEndY - Math.sin(directionArrowAngle1) * directionArrowLength
    );
    this.shipDirectionGraphics.moveTo(directionEndX, directionEndY);
    this.shipDirectionGraphics.lineTo(
      directionEndX - Math.cos(directionArrowAngle2) * directionArrowLength,
      directionEndY - Math.sin(directionArrowAngle2) * directionArrowLength
    );
    this.shipDirectionGraphics.strokePath();
  }

  // Draw waypoint paths when shift is held
  private drawWaypointPaths() {
    // Check if shift key is held
    const shiftHeld = this.input.keyboard?.checkDown(this.input.keyboard.addKey('SHIFT'), 0);
    if (!shiftHeld) return;

    // Draw waypoint paths for all player ships
    this.ships.forEach((ship) => {
      if (ship.type !== 'enemy' && ship.waypoints.length > 0) {
        this.drawShipWaypointPath(ship);
      }
    });
  }

  // Draw waypoint path for a specific ship
  private drawShipWaypointPath(ship: Ship) {
    const shipPos = new Phaser.Math.Vector2(ship.gameObject.x, ship.gameObject.y);

    // Set line style for waypoint paths
    this.waypointPathGraphics.lineStyle(2, VARIABLES[ship.type].color, 0.8);

    // Draw line from ship to first waypoint
    if (ship.waypoints.length > 0) {
      const firstWaypoint = ship.waypoints[0];
      if (firstWaypoint) {
        this.waypointPathGraphics.beginPath();
        this.waypointPathGraphics.moveTo(shipPos.x, shipPos.y);
        this.waypointPathGraphics.lineTo(firstWaypoint.x, firstWaypoint.y);
        this.waypointPathGraphics.strokePath();
      }
    }

    // Draw lines between consecutive waypoints
    for (let i = 0; i < ship.waypoints.length - 1; i++) {
      const currentWaypoint = ship.waypoints[i];
      const nextWaypoint = ship.waypoints[i + 1];

      if (currentWaypoint && nextWaypoint) {
        this.waypointPathGraphics.beginPath();
        this.waypointPathGraphics.moveTo(currentWaypoint.x, currentWaypoint.y);
        this.waypointPathGraphics.lineTo(nextWaypoint.x, nextWaypoint.y);
        this.waypointPathGraphics.strokePath();
      }
    }
  }

  /**
   * CAMERA DRAG METHODS
   * ===================
   *
   * Methods for handling right-click and drag camera movement.
   */

  // Start camera dragging
  private startCameraDrag(pointer: Phaser.Input.Pointer) {
    this.isDraggingCamera = true;
    this.cameraDragStart.set(pointer.x, pointer.y); // Screen coordinates
    this.cameraStartScroll.set(this.cameras.main.scrollX, this.cameras.main.scrollY);
  }

  // Update camera position during drag
  private updateCameraDrag(pointer: Phaser.Input.Pointer) {
    if (!this.isDraggingCamera) return;

    const camera = this.cameras.main;
    const deltaX = this.cameraDragStart.x - pointer.x; // Inverted for natural feel
    const deltaY = this.cameraDragStart.y - pointer.y;

    camera.setScroll(this.cameraStartScroll.x + deltaX, this.cameraStartScroll.y + deltaY);
  }

  // Finish camera dragging
  private finishCameraDrag() {
    this.isDraggingCamera = false;
  }

  /**
   * CREATE SPACE BACKGROUND
   * =======================
   *
   * Creates a subtle space background with stars and nebula effects.
   * This runs once when the game starts to set up the visual backdrop.
   */
  private createSpaceBackground() {
    // Create a graphics object for the background
    const background = this.add.graphics();
    background.setDepth(-1000); // Place behind everything else

    // Fill the entire world with a very dark space color (3x larger than screen)
    const worldWidth = this.scale.width * 3;
    const worldHeight = this.scale.height * 3;
    background.fillStyle(0x000000, 1); // Pure black
    background.fillRect(0, 0, worldWidth, worldHeight);

    // Create a subtle nebula effect using gradient circles
    const nebulaGraphics = this.add.graphics();
    nebulaGraphics.setDepth(-999);

    // Create several nebula clouds with very dark colors and low opacities
    const nebulaColors = [
      { color: 0x050510, alpha: 0.15 }, // Very dark purple
      { color: 0x080815, alpha: 0.1 }, // Very dark blue
      { color: 0x0a0a1a, alpha: 0.08 }, // Slightly lighter but still very dark
    ];

    nebulaColors.forEach((nebula, index) => {
      nebulaGraphics.fillStyle(nebula.color, nebula.alpha);

      // Create 2-3 nebula clouds per color across the entire world
      for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
        const x = Math.random() * worldWidth;
        const y = Math.random() * worldHeight;
        const radius = 80 + Math.random() * 120; // Varying sizes

        nebulaGraphics.fillCircle(x, y, radius);
      }
    });

    // Create stars
    const starGraphics = this.add.graphics();
    starGraphics.setDepth(-998);

    // Generate random stars across the entire world
    const numStars = 450 + Math.floor(Math.random() * 300); // 450-750 stars (3x more for larger world)

    for (let i = 0; i < numStars; i++) {
      const x = Math.random() * worldWidth;
      const y = Math.random() * worldHeight;

      // Vary star brightness and size (much dimmer)
      const brightness = 0.1 + Math.random() * 0.3; // 0.1 to 0.4 (much dimmer)
      const size = Math.random() * 1.5 + 0.3; // 0.3 to 1.8 pixels (smaller)

      // Most stars are very dim white, some are slightly blue or yellow
      const starColors = [0x404040, 0x303040, 0x404030]; // Much darker colors
      const color = starColors[Math.floor(Math.random() * starColors.length)] || 0xffffff;

      starGraphics.fillStyle(color, brightness);
      starGraphics.fillCircle(x, y, size);
    }

    // Add a few brighter "star clusters" for visual interest
    const clusterGraphics = this.add.graphics();
    clusterGraphics.setDepth(-997);

    for (let i = 0; i < 9; i++) {
      // 9 clusters for the larger world
      const centerX = Math.random() * worldWidth;
      const centerY = Math.random() * worldHeight;
      const clusterSize = 3 + Math.floor(Math.random() * 2); // 3-5 stars per cluster

      for (let j = 0; j < clusterSize; j++) {
        const offsetX = (Math.random() - 0.5) * 40; // Spread within 40px
        const offsetY = (Math.random() - 0.5) * 40;
        const x = centerX + offsetX;
        const y = centerY + offsetY;

        // Slightly brighter stars in clusters (but still dim)
        clusterGraphics.fillStyle(0x606060, 0.3 + Math.random() * 0.2);
        clusterGraphics.fillCircle(x, y, 1 + Math.random() * 0.8);
      }
    }
  }
}
