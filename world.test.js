import { expect } from 'chai';
import * as THREE from 'three'; // Import Three.js for mocking
import { World } from '../src/world.js';
import { BLOCK_TYPES, BLOCK_DATA } from '../src/blocks.js';

// Mock Three.js components for testing World class
class MockScene extends THREE.Scene {
    constructor() {
        super();
        this.added = [];
        this.removed = [];
    }
    add(object) { this.added.push(object); super.add(object); }
    remove(object) { this.removed.push(object); super.remove(object); }
}

class MockTextureLoader {
    load(url, onLoad, onProgress, onError) {
        // Simulate immediate texture loading
        const mockTexture = {
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.RepeatWrapping,
            magFilter: THREE.LinearFilter,
            minFilter: THREE.LinearFilter,
            dispose: () => {}
        };
        onLoad(mockTexture);
    }
}

class MockAudioLoader {
    load(url, onLoad, onProgress, onError) {
        // Simulate immediate audio buffer loading
        onLoad(new AudioBuffer()); // Pass a dummy AudioBuffer
    }
}

class MockAudioListener extends THREE.AudioListener {
    constructor() { super(); }
}

describe('World', () => {
    let mockScene;
    let mockTextureLoader;
    let mockAudioLoader;
    let mockAudioListener;
    let world;

    beforeEach(async () => {
        mockScene = new MockScene();
        mockTextureLoader = new MockTextureLoader();
        mockAudioLoader = new MockAudioLoader();
        mockAudioListener = new MockAudioListener();
        world = new World(mockScene, mockTextureLoader, mockAudioLoader, mockAudioListener);
        await world.loadMaterials(); // Ensure materials are loaded
        await world.initSounds(); // Ensure sounds are loaded
    });

    afterEach(() => {
        world.dispose();
    });

    describe('Initialization', () => {
        it('should initialize with an empty chunks map', () => {
            expect(world.chunks.size).to.equal(0);
        });

        it('should load block materials', () => {
            expect(Object.keys(world.blockMaterials).length).to.be.greaterThan(0);
            expect(world.blockMaterials[BLOCK_TYPES.GRASS]).to.be.an('array').with.lengthOf(6);
            expect(world.blockMaterials[BLOCK_TYPES.GRASS][0]).to.be.an.instanceOf(THREE.MeshLambertMaterial);
        });

        it('should load block sounds', () => {
            expect(world.blockPlaceSound).to.be.an.instanceOf(THREE.PositionalAudio);
            expect(world.blockBreakSound).to.be.an.instanceOf(THREE.PositionalAudio);
            expect(mockScene.added).to.include(world.blockPlaceSound);
            expect(mockScene.added).to.include(world.blockBreakSound);
        });
    });

    describe('generateChunk', () => {
        it('should create a new chunk if it does not exist', () => {
            const chunk = world.generateChunk(0, 0);
            expect(chunk).to.exist;
            expect(world.chunks.size).to.equal(1);
            expect(world.getChunk(0, 0)).to.equal(chunk);
            expect(chunk.meshGroup).to.be.an.instanceOf(THREE.Group);
            expect(mockScene.added).to.include(chunk.meshGroup);
        });

        it('should return an existing chunk if already generated', () => {
            const chunk1 = world.generateChunk(0, 0);
            const chunk2 = world.generateChunk(0, 0);
            expect(chunk1).to.equal(chunk2);
            expect(world.chunks.size).to.equal(1);
        });

        it('should populate the chunk with terrain data', () => {
            const chunk = world.generateChunk(0, 0);
            let hasSolidBlock = false;
            let hasAirBlock = false;
            for (let y = 0; y < 128; y++) {
                for (let z = 0; z < 16; z++) {
                    for (let x = 0; x < 16; x++) {
                        const blockId = chunk.getBlock(x, y, z);
                        if (blockId !== BLOCK_TYPES.AIR) hasSolidBlock = true;
                        if (blockId === BLOCK_TYPES.AIR) hasAirBlock = true;
                    }
                }
            }
            expect(hasSolidBlock).to.be.true;
            expect(hasAirBlock).to.be.true;
            expect(chunk.isDirty).to.be.true; // Should be marked dirty for mesh generation
        });
    });

    describe('getBlock', () => {
        it('should return BLOCK_TYPES.AIR for coordinates outside world height', () => {
            world.generateChunk(0, 0);
            expect(world.getBlock(0, -1, 0)).to.equal(BLOCK_TYPES.AIR);
            expect(world.getBlock(0, 128, 0)).to.equal(BLOCK_TYPES.AIR);
        });

        it('should return BLOCK_TYPES.AIR for blocks in unloaded chunks', () => {
            expect(world.getBlock(100, 50, 100)).to.equal(BLOCK_TYPES.AIR); // Chunk (6,6) not loaded
        });

        it('should return the correct block ID for a loaded chunk', () => {
            const chunk = world.generateChunk(0, 0);
            chunk.setBlock(5, 50, 5, BLOCK_TYPES.DIRT);
            expect(world.getBlock(5, 50, 5)).to.equal(BLOCK_TYPES.DIRT);
        });

        it('should handle negative world coordinates correctly', () => {
            const chunk = world.generateChunk(-1, -1); // Chunk from -16,-16 to -1,-1
            chunk.setBlock(0, 50, 0, BLOCK_TYPES.STONE); // Local (0,0,0) in chunk -1,-1 is world (-16,50,-16)
            expect(world.getBlock(-16, 50, -16)).to.equal(BLOCK_TYPES.STONE);
        });
    });

    describe('setBlock', () => {
        it('should set a block and mark the chunk as dirty', () => {
            const chunk = world.generateChunk(0, 0);
            chunk.isDirty = false; // Reset dirty flag
            const initialBlock = world.getBlock(0, 60, 0);
            expect(world.setBlock(0, 60, 0, BLOCK_TYPES.STONE)).to.be.true;
            expect(world.getBlock(0, 60, 0)).to.equal(BLOCK_TYPES.STONE);
            expect(chunk.isDirty).to.be.true;
        });

        it('should not set a block if coordinates are out of bounds', () => {
            world.generateChunk(0, 0);
            expect(world.setBlock(0, -1, 0, BLOCK_TYPES.STONE)).to.be.false;
            expect(world.setBlock(0, 128, 0, BLOCK_TYPES.STONE)).to.be.false;
        });

        it('should not set a block if the chunk is not loaded', () => {
            expect(world.setBlock(100, 50, 100, BLOCK_TYPES.STONE)).to.be.false;
        });

        it('should not mark dirty if block ID is unchanged', () => {
            const chunk = world.generateChunk(0, 0);
            world.setBlock(0, 60, 0, BLOCK_TYPES.DIRT);
            chunk.isDirty = false; // Reset dirty flag after initial set
            expect(world.setBlock(0, 60, 0, BLOCK_TYPES.DIRT)).to.be.false;
            expect(chunk.isDirty).to.be.false;
        });

        it('should mark neighboring chunks dirty if block is on a boundary', () => {
            const chunk00 = world.generateChunk(0, 0);
            const chunk10 = world.generateChunk(1, 0);
            chunk00.isDirty = false;
            chunk10.isDirty = false;

            // Set block at x=15 in chunk (0,0), which is a boundary to chunk (1,0)
            expect(world.setBlock(15, 60, 0, BLOCK_TYPES.AIR)).to.be.true;
            expect(chunk00.isDirty).to.be.true;
            expect(chunk10.isDirty).to.be.true; // Neighbor should also be marked
        });

        it('should play block break sound when setting to air', () => {
            world.generateChunk(0, 0);
            world.setBlock(0, 60, 0, BLOCK_TYPES.GRASS); // Make sure there's a block to break
            const playSpy = chai.spy.on(world.blockBreakSound, 'play');
            world.setBlock(0, 60, 0, BLOCK_TYPES.AIR);
            expect(playSpy).to.have.been.called.once;
        });

        it('should play block place sound when setting from air to solid', () => {
            world.generateChunk(0, 0);
            world.setBlock(0, 60, 0, BLOCK_TYPES.AIR); // Make sure it's air initially
            const playSpy = chai.spy.on(world.blockPlaceSound, 'play');
            world.setBlock(0, 60, 0, BLOCK_TYPES.STONE);
            expect(playSpy).to.have.been.called.once;
        });
    });

    describe('update', () => {
        it('should call generateMesh for dirty chunks', () => {
            const chunk = world.generateChunk(0, 0);
            chunk.isDirty = true;
            const generateMeshSpy = chai.spy.on(chunk, 'generateMesh');
            world.update();
            expect(generateMeshSpy).to.have.been.called.once;
            expect(chunk.isDirty).to.be.false; // Should reset dirty flag
        });

        it('should not call generateMesh for clean chunks', () => {
            const chunk = world.generateChunk(0, 0);
            chunk.isDirty = false;
            const generateMeshSpy = chai.spy.on(chunk, 'generateMesh');
            world.update();
            expect(generateMeshSpy).to.not.have.been.called();
        });
    });

    describe('dispose', () => {
        it('should remove chunk mesh groups from the scene', () => {
            const chunk = world.generateChunk(0, 0);
            world.update(); // Generate mesh
            world.dispose();
            expect(mockScene.removed).to.include(chunk.meshGroup);
        });

        it('should clear the chunks map', () => {
            world.generateChunk(0, 0);
            world.dispose();
            expect(world.chunks.size).to.equal(0);
        });
    });
});
