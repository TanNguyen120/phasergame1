import Phaser from 'phaser';
import Game from '@/scenes/Game';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#87CEEB',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: Boolean(import.meta.env.VITE_DEBUG)
        }
    },
    scene: [Game]
};

const game = new Phaser.Game(config);
