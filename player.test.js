import { expect, use } from 'chai';
import spies from 'chai-spies';
import * as THREE from 'three';
import { Player } from '../src/player.js';
import { World } from '../src/world.js';
import { InputManager } from '../src/input.js';
import { BLOCK_TYPES, BLOCK_DATA } from '../src/blocks.js';

use(spies);

// Mock Three.js components for testing
class MockScene extends THREE.Scene { constructor() { super(); } }
class MockCamera extends THREE.PerspectiveCamera { constructor() { super(); } }
class MockTextureLoader { load(url, onLoad) { onLoad({}); } }
class MockAudioLoader { load(url, onLoad) { onLoad(new AudioBuffer()); } }
class MockAudioListener extends THREE.AudioListener { constructor() { super(); } }

describe('Player', () => {
    let mockScene;
    let mockCamera;
    let mockWorld;
    let mockInputManager;
    let player;

    beforeEach(async () => {
        mockScene = new MockScene();
        mockCamera = new MockCamera();
        mockInputManager = new InputManager();
        mockInputManager.pointerLocked = true; // Simulate pointer being locked for tests

        const mockTextureLoader = new MockTextureLoader();
        const mockAudioLoader = new MockAudioLoader();
        const mockAudioListener = new MockAudioListener();
        mockWorld = new World(mockScene, mockTextureLoader, mockAudioLoader, mockAudioListener);
        await mockWorld.loadMaterials();
        await mockWorld.initSounds();

        // Create a flat ground for testing
        const chunk = mockWorld.generateChunk(0, 0);
        for (let x = 0; x < 16; x++) {
            for (let z = 0; z < 16; z++) {
                // Set ground at y=59 (sea level - 1 for a solid layer)
                mockWorld.setBlock(x, 59, z, BLOCK_TYPES.DIRT);
                mockWorld.setBlock(x, 58, z, BLOCK_TYPES.STONE);
                for (let y = 60; y < 128; y++) {
                    mockWorld.setBlock(x, y, z, BLOCK_TYPES.AIR);
                }
            }
        }
        mockWorld.update(); // Update chunk meshes

        player = new Player(mockScene, mockCamera, new THREE.Vector3(0.5, 60, 0.5)); // Start above the ground
        player.position.set(0.5, 60 + 0.9, 0.5); // Initial player position (eye level)
    });

    afterEach(() => {
        player.dispose();
        mockWorld.dispose();
        mockInputManager.dispose();
    });

    describe('Initialization', () => {
        it('should set the camera position to player position', () => {
            expect(player.camera.position.x).to.equal(player.position.x);
            expect(player.camera.position.y).to.equal(player.position.y);
            expect(player.camera.position.z).to.equal(player.position.z);
        });

        it('should create a crosshair element', () => {
            const crosshair = document.querySelector('div[style*="crosshair"]');
            expect(crosshair).to.exist;
        });
    });

    describe('update', () => {
        it('should not update if pointer is not locked', () => {
            mockInputManager.pointerLocked = false;
            const initialPos = player.position.clone();
            const initialCamRot = player.camera.rotation.clone();
            player.update(0.1, mockWorld, mockInputManager);
            expect(player.position.equals(initialPos)).to.be.true;
            expect(player.camera.rotation.equals(initialCamRot)).to.be.true;
        });

        it('should apply gravity when in air', () => {
            player.position.y = 70; // Set player high in the air
            player.onGround = false;
            player.velocity.set(0, 0, 0);
            player.update(0.1, mockWorld, mockInputManager);
            expect(player.velocity.y).to.be.lessThan(0); // Gravity applied
            expect(player.position.y).to.be.lessThan(70); // Position changed
        });

        it('should stop falling and set onGround when hitting the ground', () => {
            player.position.y = 60.5; // Slightly above ground (y=59)
            player.velocity.set(0, -10, 0); // Falling fast
            player.onGround = false;

            player.update(0.1, mockWorld, mockInputManager);

            // Player should land on y=59 + EYE_HEIGHT (approx 59 + 1.8*0.9 = 60.62)
            // Due to discrete steps, it might be slightly off, but velocity should reset
            expect(player.onGround).to.be.true;
            expect(player.velocity.y).to.equal(0);
            expect(player.position.y).to.be.closeTo(59 + (1.8 * 0.9), 0.1); // Landed at correct height
        });

        it('should move forward with KeyW', () => {
            mockInputManager.keysPressed.add('KeyW');
            const initialZ = player.position.z;
            player.update(0.1, mockWorld, mockInputManager);
            expect(player.position.z).to.be.lessThan(initialZ); // Moving in -Z direction (forward)
        });

        it('should move backward with KeyS', () => {
            mockInputManager.keysPressed.add('KeyS');
            const initialZ = player.position.z;
            player.update(0.1, mockWorld, mockInputManager);
            expect(player.position.z).to.be.greaterThan(initialZ); // Moving in +Z direction (backward)
        });

        it('should jump with Space key when on ground', () => {
            player.onGround = true; // Ensure player is on ground
            mockInputManager.keysPressed.add('Space');
            player.update(0.1, mockWorld, mockInputManager);
            expect(player.velocity.y).to.be.closeTo(8, 0.001); // Jump velocity
            expect(player.onGround).to.be.false;
        });

        it('should not jump with Space key when not on ground', () => {
            player.onGround = false;
            player.velocity.y = 0;
            mockInputManager.keysPressed.add('Space');
            player.update(0.1, mockWorld, mockInputManager);
            expect(player.velocity.y).to.be.lessThan(0); // Only gravity applied
            expect(player.onGround).to.be.false;
        });

        it('should rotate camera with mouse movement', () => {
            mockInputManager.mouseDeltaX = 100;
            mockInputManager.mouseDeltaY = 50;
            const initialYaw = player.euler.y;
            const initialPitch = player.euler.x;
            player.update(0.1, mockWorld, mockInputManager);
            expect(player.euler.y).to.be.lessThan(initialYaw);
            expect(player.euler.x).to.be.lessThan(initialPitch);
            expect(player.camera.rotation.y).to.equal(player.euler.y);
            expect(player.camera.rotation.x).to.equal(player.euler.x);
        });

        it('should clamp camera pitch', () => {
            player.euler.x = Math.PI / 2; // Set to max possible
            mockInputManager.mouseDeltaY = -10; // Try to look further up
            player.update(0.1, mockWorld, mockInputManager);
            expect(player.euler.x).to.be.closeTo(Math.PI / 2 - 0.05, 0.001); // Should be clamped
        });
    });

    describe('raycastBlock', () => {
        it('should return null if no block is hit within maxDistance', () => {
            player.position.set(0.5, 70, 0.5); // High above ground
            player.camera.lookAt(new THREE.Vector3(0.5, 69, 0.5)); // Look slightly down
            player.euler.x = -0.1; player.euler.y = 0; // Update euler to match lookAt
            player.camera.rotation.copy(player.euler);

            const hit = player.raycastBlock(mockWorld, 1); // Max distance 1
            expect(hit).to.be.null;
        });

        it('should hit the ground block directly below', () => {
            player.position.set(0.5, 60.62, 0.5); // Player at eye level above block at y=59
            player.camera.lookAt(new THREE.Vector3(0.5, 59.62, 0.5)); // Look directly down (no rotation)
            player.euler.x = -Math.PI / 2; player.euler.y = 0; // Update euler to match lookAt
            player.camera.rotation.copy(player.euler);

            const hit = player.raycastBlock(mockWorld, 2);
            expect(hit).to.not.be.null;
            expect(hit.blockPosition.x).to.equal(0);
            expect(hit.blockPosition.y).to.equal(59);
            expect(hit.blockPosition.z).to.equal(0);
            expect(hit.blockId).to.equal(BLOCK_TYPES.DIRT);
            expect(hit.faceNormal.x).to.equal(0);
            expect(hit.faceNormal.y).to.equal(1); // Hit top face
            expect(hit.faceNormal.z).to.equal(0);
        });

        it('should hit a block in front of the player', () => {
            // Place a block in front of the player
            mockWorld.setBlock(0, 60, -2, BLOCK_TYPES.STONE);
            mockWorld.update();

            player.position.set(0.5, 60.62, 0.5);
            player.camera.lookAt(new THREE.Vector3(0.5, 60.62, -1)); // Look directly forward
            player.euler.x = 0; player.euler.y = 0; // Update euler to match lookAt
            player.camera.rotation.copy(player.euler);

            const hit = player.raycastBlock(mockWorld, 5);
            expect(hit).to.not.be.null;
            expect(hit.blockPosition.x).to.equal(0);
            expect(hit.blockPosition.y).to.equal(60);
            expect(hit.blockPosition.z).to.equal(-2);
            expect(hit.blockId).to.equal(BLOCK_TYPES.STONE);
            expect(hit.faceNormal.x).to.equal(0);
            expect(hit.faceNormal.y).to.equal(0);
            expect(hit.faceNormal.z).to.equal(1); // Hit front face (+Z direction)
        });

        it('should return the correct block type', () => {
            mockWorld.setBlock(0, 60, -2, BLOCK_TYPES.GRASS);
            mockWorld.update();

            player.position.set(0.5, 60.62, 0.5);
            player.camera.lookAt(new THREE.Vector3(0.5, 60.62, -1));
            player.euler.x = 0; player.euler.y = 0;
            player.camera.rotation.copy(player.euler);

            const hit = player.raycastBlock(mockWorld, 5);
            expect(hit).to.not.be.null;
            expect(hit.blockId).to.equal(BLOCK_TYPES.GRASS);
        });
    });
});
