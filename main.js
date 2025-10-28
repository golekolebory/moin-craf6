import { Renderer } from './src/renderer.js';
import { World } from './src/world.js';
import { Player } from './src/player.js';
import { InputManager } from './src/input.js';
import { BLOCK_TYPES } from './src/blocks.js';

/**
 * @typedef {import("three")} THREE
 */

let renderer, world, player, inputManager;
let clock = new THREE.Clock();
let lastTime = 0;

// Current block type to place (default to STONE)
let currentBlockToPlace = BLOCK_TYPES.STONE;

/**
 * Initializes the game.
 */
async function init() {
    console.log('Initializing game...');
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas element with ID "gameCanvas" not found.');
        return;
    }

    renderer = new Renderer();
    renderer.init(canvas);

    inputManager = new InputManager();
    // Request pointer lock when clicking on the canvas
    canvas.addEventListener('click', () => {
        if (!inputManager.pointerLocked) {
            inputManager.requestPointerLock(canvas);
        }
    });

    world = new World(renderer.scene, new THREE.TextureLoader(), new THREE.AudioLoader(), renderer.getAudioListener());
    await world.loadMaterials(); // Ensure materials are loaded before world generation

    player = new Player(renderer.scene, renderer.getCamera(), new THREE.Vector3(0, 70, 0)); // Start player above ground

    // Initial chunk generation around player
    const playerChunkX = Math.floor(player.position.x / 16);
    const playerChunkZ = Math.floor(player.position.z / 16);
    const renderDistance = 3; // Render a 7x7 grid of chunks around the player

    for (let dz = -renderDistance; dz <= renderDistance; dz++) {
        for (let dx = -renderDistance; dx <= renderDistance; dx++) {
            world.generateChunk(playerChunkX + dx, playerChunkZ + dz);
        }
    }
    world.update(); // Generate initial meshes

    console.log('Game initialized. Click on the canvas to start!');
    gameLoop();
}

/**
 * The main game loop.
 * @param {DOMHighResTimeStamp} time - The current time provided by requestAnimationFrame.
 */
function gameLoop(time = 0) {
    const deltaTime = clock.getDelta(); // Get time since last frame in seconds

    // Update player
    player.update(deltaTime, world, inputManager);

    // Update world (regenerate dirty chunk meshes)
    world.update();

    // Handle block interactions
    if (inputManager.pointerLocked) {
        // Break block (Left Mouse Button)
        if (inputManager.getMouseButtonClicked('Mouse1')) {
            const hit = player.raycastBlock(world, 8); // Raycast up to 8 units
            if (hit && hit.blockId !== BLOCK_TYPES.AIR) {
                world.setBlock(hit.blockPosition.x, hit.blockPosition.y, hit.blockPosition.z, BLOCK_TYPES.AIR);
            }
        }

        // Place block (Right Mouse Button)
        if (inputManager.getMouseButtonClicked('Mouse2')) {
            const hit = player.raycastBlock(world, 8);
            if (hit && hit.blockId !== BLOCK_TYPES.AIR) {
                // Calculate placement position based on hit block and face normal
                const placeX = hit.blockPosition.x + hit.faceNormal.x;
                const placeY = hit.blockPosition.y + hit.faceNormal.y;
                const placeZ = hit.blockPosition.z + hit.faceNormal.z;

                // Prevent placing block inside player
                const playerMinY = Math.floor(player.position.y - player.camera.position.y + 0.1); // Adjust for player's feet
                const playerMaxY = Math.floor(player.position.y - player.camera.position.y + 1.8); // Adjust for player's head

                if (!(
                    placeX === Math.floor(player.position.x) &&
                    (placeY === playerMinY || placeY === playerMaxY) &&
                    placeZ === Math.floor(player.position.z)
                )) {
                    world.setBlock(placeX, placeY, placeZ, currentBlockToPlace);
                }
            }
        }
    }

    // Reset mouse delta for the next frame
    inputManager.resetMouseDelta();

    // Render the scene
    renderer.render(renderer.scene, player.getCamera());

    requestAnimationFrame(gameLoop);
}

// Start the game when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

// Cleanup on page unload (optional, for SPA scenarios)
window.addEventListener('beforeunload', () => {
    if (renderer) renderer.dispose();
    if (world) world.dispose();
    if (player) player.dispose();
    if (inputManager) inputManager.dispose();
});
