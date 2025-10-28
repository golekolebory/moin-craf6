import { InputManager } from './input.js';
import { BLOCK_TYPES, BLOCK_DATA } from './blocks.js';

/**
 * @typedef {import("three")} THREE
 * @typedef {import("./world").World} World
 */

const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.3;
const EYE_HEIGHT = PLAYER_HEIGHT * 0.9; // Camera position relative to player bottom
const GRAVITY = -25; // m/s^2
const JUMP_VELOCITY = 8; // m/s
const MOVEMENT_SPEED = 5; // m/s
const MOUSE_SENSITIVITY = 0.002; // Radians per pixel
const MAX_LOOK_UP_ANGLE = Math.PI / 2 - 0.05; // Limit to prevent flipping
const MAX_LOOK_DOWN_ANGLE = -Math.PI / 2 + 0.05;

export class Player {
    /**
     * @param {THREE.Scene} scene - The Three.js scene.
     * @param {THREE.PerspectiveCamera} camera - The player's camera.
     * @param {THREE.Vector3} initialPosition - The initial world position of the player.
     */
    constructor(scene, camera, initialPosition) {
        this.scene = scene;
        /** @type {THREE.PerspectiveCamera} */
        this.camera = camera;
        this.camera.rotation.order = 'YXZ'; // Yaw (Y) then Pitch (X)

        /** @type {THREE.Vector3} */
        this.position = initialPosition.clone();
        this.position.y += EYE_HEIGHT; // Adjust initial position for eye height

        /** @type {THREE.Vector3} */
        this.velocity = new THREE.Vector3();
        /** @type {boolean} */
        this.onGround = false;

        /** @type {THREE.Euler} */
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ'); // Stores camera rotation (pitch and yaw)
        this.camera.rotation.copy(this.euler);

        // Crosshair (simple HTML overlay, not part of Three.js scene)
        this.createCrosshair();
    }

    /**
     * Creates a simple crosshair HTML element.
     */
    createCrosshair() {
        const crosshair = document.createElement('div');
        crosshair.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 2px;
            height: 2px;
            background-color: white;
            transform: translate(-50%, -50%);
            z-index: 100;
        `;
        document.body.appendChild(crosshair);
    }

    /**
     * Updates player position, velocity, and camera rotation based on input and world physics.
     * @param {number} deltaTime - Time elapsed since the last frame in seconds.
     * @param {World} world - The game world instance.
     * @param {InputManager} inputManager - The input manager instance.
     */
    update(deltaTime, world, inputManager) {
        if (!inputManager.pointerLocked) {
            return;
        }

        // --- Camera Rotation ---
        const mouseDeltaX = inputManager.getMouseDeltaX();
        const mouseDeltaY = inputManager.getMouseDeltaY();

        this.euler.y -= mouseDeltaX * MOUSE_SENSITIVITY; // Yaw
        this.euler.x -= mouseDeltaY * MOUSE_SENSITIVITY; // Pitch

        // Clamp pitch to prevent camera from flipping
        this.euler.x = Math.max(MAX_LOOK_DOWN_ANGLE, Math.min(MAX_LOOK_UP_ANGLE, this.euler.x));

        this.camera.rotation.copy(this.euler);
        this.camera.position.copy(this.position);

        // --- Movement ---
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        forward.y = 0; // Keep movement horizontal
        forward.normalize();

        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        right.y = 0; // Keep movement horizontal
        right.normalize();

        let moveDirection = new THREE.Vector3();
        if (inputManager.isKeyPressed('KeyW')) moveDirection.add(forward);
        if (inputManager.isKeyPressed('KeyS')) moveDirection.sub(forward);
        if (inputManager.isKeyPressed('KeyA')) moveDirection.sub(right);
        if (inputManager.isKeyPressed('KeyD')) moveDirection.add(right);

        moveDirection.normalize().multiplyScalar(MOVEMENT_SPEED * deltaTime);

        this.velocity.x = moveDirection.x;
        this.velocity.z = moveDirection.z;

        // Apply gravity
        this.velocity.y += GRAVITY * deltaTime;

        // Jump
        if (inputManager.isKeyPressed('Space') && this.onGround) {
            this.velocity.y = JUMP_VELOCITY;
            this.onGround = false; // Reset onGround immediately
        }

        // --- Collision Detection ---
        const newPosition = this.position.clone().add(this.velocity.clone().multiplyScalar(deltaTime));
        const oldPosition = this.position.clone();

        // Check X collision
        this.position.x = newPosition.x;
        if (this.checkCollision(this.position, world)) {
            this.position.x = oldPosition.x;
            this.velocity.x = 0;
        }

        // Check Y collision
        this.position.y = newPosition.y;
        if (this.checkCollision(this.position, world)) {
            this.position.y = oldPosition.y;
            this.velocity.y = 0;
            this.onGround = (newPosition.y < oldPosition.y); // Landed if moving downwards
        } else {
            this.onGround = false;
        }

        // Check Z collision
        this.position.z = newPosition.z;
        if (this.checkCollision(this.position, world)) {
            this.position.z = oldPosition.z;
            this.velocity.z = 0;
        }

        // Ensure camera position matches player position after collisions
        this.camera.position.copy(this.position);
    }

    /**
     * Checks for collision with solid blocks around the player.
     * @param {THREE.Vector3} currentPosition - The player's current position (eye level).
     * @param {World} world - The game world instance.
     * @returns {boolean} True if collision detected, false otherwise.
     */
    checkCollision(currentPosition, world) {
        const minX = Math.floor(currentPosition.x - PLAYER_RADIUS);
        const maxX = Math.floor(currentPosition.x + PLAYER_RADIUS);
        const minY = Math.floor(currentPosition.y - EYE_HEIGHT); // Bottom of player
        const maxY = Math.floor(currentPosition.y + (PLAYER_HEIGHT - EYE_HEIGHT)); // Top of player
        const minZ = Math.floor(currentPosition.z - PLAYER_RADIUS);
        const maxZ = Math.floor(currentPosition.z + PLAYER_RADIUS);

        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                for (let x = minX; x <= maxX; x++) {
                    const blockId = world.getBlock(x, y, z);
                    const blockData = BLOCK_DATA[blockId];
                    if (blockData && blockData.solid) {
                        return true; // Collision detected
                    }
                }
            }
        }
        return false;
    }

    /**
     * Performs a raycast from the player's camera to find the first intersected block.
     * @param {World} world - The game world instance.
     * @param {number} maxDistance - The maximum distance for the raycast.
     * @returns {{blockPosition: THREE.Vector3, faceNormal: THREE.Vector3, blockId: number} | null}
     *          An object containing the position of the hit block (floor coordinates),
     *          the normal of the hit face, and the block ID, or null if no block is hit.
     */
    raycastBlock(world, maxDistance = 5) {
        const raycaster = new THREE.Raycaster();
        const origin = this.camera.position.clone();
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion); // Camera's forward direction

        raycaster.set(origin, direction);
        raycaster.far = maxDistance;

        // Manual raycasting against the voxel grid
        let t = 0;
        const step = 0.1; // Smaller steps for more precision
        const intersectionPoint = new THREE.Vector3();
        const lastBlockCoords = new THREE.Vector3();

        while (t < maxDistance) {
            intersectionPoint.copy(origin).addScaledVector(direction, t);

            const x = Math.floor(intersectionPoint.x);
            const y = Math.floor(intersectionPoint.y);
            const z = Math.floor(intersectionPoint.z);

            const blockId = world.getBlock(x, y, z);
            const blockData = BLOCK_DATA[blockId];

            if (blockData && blockData.solid) {
                // We hit a solid block. Now determine the face normal.
                // Move back slightly to find the point *before* entering the block.
                const pointBeforeEntry = origin.clone().addScaledVector(direction, t - step);

                // Compare integer coordinates of hit point and point before entry
                const currentBlockCoords = new THREE.Vector3(x, y, z);
                const prevBlockCoords = new THREE.Vector3(
                    Math.floor(pointBeforeEntry.x),
                    Math.floor(pointBeforeEntry.y),
                    Math.floor(pointBeforeEntry.z)
                );

                // The face normal is the difference between the current and previous block coordinates.
                // This works because the ray crosses from one block to another.
                const faceNormal = currentBlockCoords.clone().sub(prevBlockCoords).normalize();

                return {
                    blockPosition: currentBlockCoords,
                    faceNormal: faceNormal,
                    blockId: blockId
                };
            }

            lastBlockCoords.set(x, y, z); // Keep track of the last air block
            t += step;
        }

        return null;
    }

    /**
     * Returns the player's camera.
     * @returns {THREE.PerspectiveCamera}
     */
    getCamera() {
        return this.camera;
    }

    /**
     * Disposes of player resources if any.
     */
    dispose() {
        // Remove crosshair if it was added
        const crosshair = document.querySelector('div[style*="crosshair"]');
        if (crosshair) {
            crosshair.remove();
        }
    }
}
