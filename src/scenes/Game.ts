import Phaser from 'phaser';

export default class Game extends Phaser.Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: any;
    private shiftKey!: Phaser.Input.Keyboard.Key;
    private walls!: Phaser.Physics.Arcade.StaticGroup;

    constructor() {
        super({ key: 'Game' });
    }

    preload() {
        // Create a simple colored rectangle for the player
        this.load.image('player', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
        
        // Create a simple colored rectangle for walls
        this.load.image('wall', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
    }

    create() {
        // Create walls group
        this.walls = this.physics.add.staticGroup();

        // Create walls around the edges
        this.walls.create(400, 0, 'wall').setScale(800, 20).refreshBody();
        this.walls.create(400, 600, 'wall').setScale(800, 20).refreshBody();
        this.walls.create(0, 300, 'wall').setScale(20, 600).refreshBody();
        this.walls.create(800, 300, 'wall').setScale(20, 600).refreshBody();

        // Create some interior walls
        this.walls.create(200, 200, 'wall').setScale(100, 20).refreshBody();
        this.walls.create(600, 400, 'wall').setScale(100, 20).refreshBody();
        this.walls.create(400, 300, 'wall').setScale(20, 100).refreshBody();

        // Create player
        this.player = this.physics.add.sprite(100, 100, 'player');
        this.player.setDisplaySize(32, 32);
        this.player.setTint(0x00ff00); // Green color
        this.player.setCollideWorldBounds(true);

        // Set up physics
        this.physics.add.collider(this.player, this.walls);

        // Set up input
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = this.input.keyboard!.addKeys('W,S,A,D');
        this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

        // Add some visual feedback
        this.add.text(16, 16, 'WASD to move, Shift to sprint', {
            fontSize: '16px',
            color: '#000000',
            backgroundColor: '#ffffff',
            padding: { x: 8, y: 4 }
        });
    }

    update() {
        const speed = this.shiftKey.isDown ? 200 : 100;
        
        // Reset velocity
        this.player.setVelocity(0);

        // Handle movement
        if (this.cursors.left.isDown || this.wasd.A.isDown) {
            this.player.setVelocityX(-speed);
        } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
            this.player.setVelocityX(speed);
        }

        if (this.cursors.up.isDown || this.wasd.W.isDown) {
            this.player.setVelocityY(-speed);
        } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
            this.player.setVelocityY(speed);
        }
    }
}
