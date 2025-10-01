import Phaser from 'phaser';

export default class Game extends Phaser.Scene {
    private cube!: Phaser.GameObjects.Rectangle;
    private moveTarget: Phaser.Math.Vector2 | null = null;
    private moveSpeed: number = 200;

    constructor() {
        super({ key: 'Game' });
    }

    preload() {
        // blank slate; no assets needed
    }

    create() {
        // create a simple cube (rectangle)
        this.cube = this.add.rectangle(100, 100, 32, 32, 0x00ff00);

        // on pointer down, set target to pointer world position
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.moveTarget = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
        });
    }

    update(time: number, delta: number) {
        if (!this.moveTarget) return;

        const current = new Phaser.Math.Vector2(this.cube.x, this.cube.y);
        const toTarget = this.moveTarget.clone().subtract(current);
        const distance = toTarget.length();

        if (distance < 2) {
            // close enough; stop
            this.moveTarget = null;
            return;
        }

        const direction = toTarget.normalize();
        const step = (this.moveSpeed * delta) / 1000;
        const nextPos = current.add(direction.scale(step));

        // clamp overshoot
        if (nextPos.distance(this.moveTarget) > distance) {
            this.cube.setPosition(this.moveTarget.x, this.moveTarget.y);
            this.moveTarget = null;
        } else {
            this.cube.setPosition(nextPos.x, nextPos.y);
        }
    }
}
