# Phaser 3 Game

A minimal Phaser 3 + TypeScript + Vite game project with Arcade Physics, WASD movement controls, sprint functionality, and wall colliders.

## Features

- **WASD Movement**: Use W, A, S, D keys to move the player
- **Arrow Keys**: Alternative movement controls
- **Sprint**: Hold Shift to move faster
- **Wall Colliders**: Player collides with walls and boundaries
- **Arcade Physics**: Simple 2D physics system
- **TypeScript**: Full TypeScript support
- **Vite**: Fast development server and build tool

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Controls

- **W, A, S, D**: Move player
- **Arrow Keys**: Alternative movement
- **Shift**: Sprint (hold while moving)

## Project Structure

```
├── index.html          # Main HTML file
├── src/
│   ├── main.ts         # Game entry point
│   └── scenes/
│       └── Game.ts     # Main game scene
├── vite.config.ts      # Vite configuration
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── README.md          # This file
```

## Technologies Used

- [Phaser 3](https://phaser.io/) - Game framework
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Vite](https://vitejs.dev/) - Build tool and dev server

## License

MIT
