/**
 * MAIN GAME ENTRY POINT
 * =====================
 *
 * This file is where the Phaser game starts up. It's like the "main menu"
 * of a game - it sets up the game engine and tells it which scene to load.
 *
 * Think of it as the foundation that everything else builds on.
 */

// Import Phaser game engine and our custom Game scene
import Phaser from 'phaser';
import Game from '@/scenes/Game';

/**
 * GAME CONFIGURATION
 * ==================
 *
 * This object tells Phaser how to set up the game. It's like the settings
 * you might see in a game's options menu, but for the game engine itself.
 */
const config: Phaser.Types.Core.GameConfig = {
  // Use WebGL if available, fall back to Canvas if not
  type: Phaser.AUTO,

  // SCALE SETTINGS - How the game fits on the screen
  scale: {
    mode: Phaser.Scale.RESIZE, // Game resizes when browser window resizes
    width: '100%', // Take up full width of the container
    height: '100%', // Take up full height of the container
    parent: 'game-container', // Put the game inside this HTML element
  },

  // BACKGROUND COLOR - What color shows behind the game
  backgroundColor: '#000000', // Black background

  // PHYSICS SETTINGS - How objects move and interact
  physics: {
    default: 'arcade', // Use simple arcade physics (good for 2D games)
    arcade: {
      gravity: { x: 0, y: 0 }, // No gravity (space game!)
      debug: Boolean(import.meta.env.VITE_DEBUG), // Show collision boxes in debug mode
    },
  },

  // SCENES - The different "screens" or "levels" in the game
  scene: [Game], // Start with our Game scene
};

/**
 * CREATE THE GAME
 * ===============
 *
 * This line actually creates and starts the game using our configuration.
 * It's like pressing "Start Game" - everything begins here!
 */
const game = new Phaser.Game(config);
