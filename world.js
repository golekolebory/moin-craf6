import { BLOCK_TYPES, BLOCK_DATA, loadBlockMaterials } from './blocks.js';

/**
 * @typedef {import("three")} THREE
 * @typedef {import("./blocks").BlockData} BlockData
 */

const CHUNK_SIZE = 16; // Chunks are 16x16x16 blocks
const WORLD_HEIGHT = 128; // Max height of the world
const SEA_LEVEL = 60; // Blocks below this are potentially dirt/stone, above is air/grass

/**
 * Represents a single chunk in the world.
 * Stores block data and its corresponding Three.js mesh.
 */
class Chunk {
    /**
     * @param {number} chunkX - The X coordinate of the chunk in chunk units.
     * @param {number} chunkZ - The Z coordinate of the chunk in chunk units.
     * @param {THREE.Scene} scene - The Three.js scene to add/remove chunk meshes.
     * @param {Object.<number, THREE.Material[]>} blockMaterials - Pre-loaded Three.js materials for blocks.
     */
    constructor(chunkX, chunkZ, scene, blockMaterials) {
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.scene = scene;
        this.blockMaterials = blockMaterials;

        /** @type {Uint8Array} */
        this.blocks = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
        /** @type {THREE.Group} */
        this.meshGroup = new THREE.Group();
        this.meshGroup.position.set(chunkX * CHUNK_SIZE, 0, chunkZ * CHUNK_SIZE);
        this.scene.add(this.meshGroup);

        this.isDirty = false;
        this.needsUpdate = false;
    }

    /**
     * Gets the block ID at local chunk coordinates.
     * @param {number} x - Local X coordinate (0 to CHUNK_SIZE-1).
     * @param {number} y - Local Y coordinate (0 to WORLD_HEIGHT-1).
     * @param {number} z - Local Z coordinate (0 to CHUNK_SIZE-1).
     * @returns {number} The ID of the block.
     */
    getBlock(x, y, z) {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
            return BLOCK_TYPES.AIR; // Outside chunk bounds
        }
        return this.blocks[x + y * CHUNK_SIZE + z * CHUNK_SIZE * WORLD_HEIGHT];
    }

    /**
     * Sets the block ID at local chunk coordinates.
     * @param {number} x - Local X coordinate (0 to CHUNK_SIZE-1).
     * @param {number} y - Local Y coordinate (0 to WORLD_HEIGHT-1).
     * @param {number} z - Local Z coordinate (0 to CHUNK_SIZE-1).
     * @param {number} blockId - The new block ID.
     * @returns {boolean} True if the block was set, false otherwise.
     */
    setBlock(x, y, z, blockId) {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
            return false;
        }
        const index = x + y * CHUNK_SIZE + z * CHUNK_SIZE * WORLD_HEIGHT;
        if (this.blocks[index] !== blockId) {
            this.blocks[index] = blockId;
            this.isDirty = true; // Mark chunk for mesh regeneration
            this.needsUpdate = true; // Indicate that a neighbor might also need update
            return true;
        }
        return false;
    }

    /**
     * Generates the mesh for the chunk based on its block data.
     * Applies basic greedy meshing principles for visible faces.
     *
     * @param {(x: number, y: number, z: number) => number} getNeighborBlock - Function to get a block ID at a given world coordinate, including neighbors outside this chunk.
     */
    generateMesh(getNeighborBlock) {
        // Clear existing meshes
        this.meshGroup.clear();

        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        let vertexCount = 0;

        const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
        const blockPositions = blockGeometry.attributes.position.array;
        const blockNormals = blockGeometry.attributes.normal.array;
        const blockUvs = blockGeometry.attributes.uv.array;
        const blockIndices = blockGeometry.index.array;

        const neighborOffsets = [
            [1, 0, 0], [-1, 0, 0], // X-axis
            [0, 1, 0], [0, -1, 0], // Y-axis
            [0, 0, 1], [0, 0, -1]  // Z-axis
        ];
        const faceMap = {
            '1,0,0': 0, // Right
            '-1,0,0': 1, // Left
            '0,1,0': 2, // Top
            '0,-1,0': 3, // Bottom
            '0,0,1': 4, // Front
            '0,0,-1': 5  // Back
        };

        const tempVector = new THREE.Vector3();

        for (let y = 0; y < WORLD_HEIGHT; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    const blockId = this.getBlock(x, y, z);
                    const blockData = BLOCK_DATA[blockId];

                    if (!blockData || !blockData.solid) {
                        continue; // Skip air or non-solid blocks
                    }

                    // Check all 6 faces
                    for (let i = 0; i < neighborOffsets.length; i++) {
                        const [ox, oy, oz] = neighborOffsets[i];
                        const neighborX = x + ox + this.chunkX * CHUNK_SIZE;
                        const neighborY = y + oy;
                        const neighborZ = z + oz + this.chunkZ * CHUNK_SIZE;

                        const neighborBlockId = getNeighborBlock(neighborX, neighborY, neighborZ);
                        const neighborBlockData = BLOCK_DATA[neighborBlockId];

                        if (!neighborBlockData || !neighborBlockData.solid) {
                            // Render this face if neighbor is air or non-solid
                            const faceIndex = faceMap[`${ox},${oy},${oz}`];
                            const material = this.blockMaterials[blockId][faceIndex];

                            if (!material.userData.group) {
                                material.userData.group = new THREE.Group();
                                this.meshGroup.add(material.userData.group);
                            }

                            const blockMesh = new THREE.Mesh(blockGeometry, material);
                            blockMesh.position.set(x + 0.5, y + 0.5, z + 0.5); // Center of the block
                            blockMesh.matrixAutoUpdate = false;
                            blockMesh.updateMatrix();
                            material.userData.group.add(blockMesh);
                        }
                    }
                }
            }
        }
        this.isDirty = false;
    }

    /**
     * Disposes of the chunk's Three.js resources.
     */
    dispose() {
        if (this.meshGroup) {
            this.scene.remove(this.meshGroup);
            this.meshGroup.children.forEach(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }
    }
}


/**
 * Manages the entire game world, including chunks and block data.
 */
export class World {
    /**
     * @param {THREE.Scene} scene - The Three.js scene to manage world objects.
     * @param {THREE.TextureLoader} textureLoader - The Three.js TextureLoader instance.
     * @param {THREE.AudioLoader} audioLoader - The Three.js AudioLoader instance.
     * @param {THREE.AudioListener} audioListener - The Three.js AudioListener instance.
     */
    constructor(scene, textureLoader, audioLoader, audioListener) {
        this.scene = scene;
        this.textureLoader = textureLoader;
        this.audioLoader = audioLoader;
        this.audioListener = audioListener;

        /** @type {Map<string, Chunk>} */
        this.chunks = new Map(); // Key: "chunkX,chunkZ"
        /** @type {Object.<number, THREE.Material[]>} */
        this.blockMaterials = {};

        /** @type {THREE.PositionalAudio | null} */
        this.blockPlaceSound = null;
        /** @type {THREE.PositionalAudio | null} */
        this.blockBreakSound = null;

        this.initSounds();
    }

    /**
     * Initializes audio effects for block interactions.
     */
    async initSounds() {
        try {
            const placeSoundBuffer = await new Promise((resolve, reject) => {
                this.audioLoader.load(
                    'https://freesound.org/data/previews/173/173679_3010174-lq.mp3', // block_place.mp3
                    (buffer) => resolve(buffer),
                    undefined,
                    (err) => reject(err)
                );
            });
            this.blockPlaceSound = new THREE.PositionalAudio(this.audioListener);
            this.blockPlaceSound.setBuffer(placeSoundBuffer);
            this.blockPlaceSound.setRefDistance(1);
            this.blockPlaceSound.setRolloffFactor(1);
            this.blockPlaceSound.setMaxDistance(10);
            this.scene.add(this.blockPlaceSound); // Add to scene, position will be set before playing

            const breakSoundBuffer = await new Promise((resolve, reject) => {
                this.audioLoader.load(
                    'https://freesound.org/data/previews/20/20993_3010174-lq.mp3', // block_break.mp3
                    (buffer) => resolve(buffer),
                    undefined,
                    (err) => reject(err)
                );
            });
            this.blockBreakSound = new THREE.PositionalAudio(this.audioListener);
            this.blockBreakSound.setBuffer(breakSoundBuffer);
            this.blockBreakSound.setRefDistance(1);
            this.blockBreakSound.setRolloffFactor(1);
            this.blockBreakSound.setMaxDistance(10);
            this.scene.add(this.blockBreakSound); // Add to scene, position will be set before playing

        } catch (error) {
            console.error('Error loading block sounds:', error);
        }
    }

    /**
     * Asynchronously loads all block materials.
     * @returns {Promise<void>}
     */
    async loadMaterials() {
        this.blockMaterials = await loadBlockMaterials(this.textureLoader);
        console.log('Block materials loaded.');
    }

    /**
     * Gets a chunk object by its chunk coordinates.
     * @param {number} chunkX
     * @param {number} chunkZ
     * @returns {Chunk | undefined} The chunk object, or undefined if not found.
     */
    getChunk(chunkX, chunkZ) {
        return this.chunks.get(`${chunkX},${chunkZ}`);
    }

    /**
     * Generates a new chunk and adds it to the world.
     * @param {number} chunkX - The X coordinate of the chunk in chunk units.
     * @param {number} chunkZ - The Z coordinate of the chunk in chunk units.
     * @returns {Chunk} The newly generated or existing chunk.
     */
    generateChunk(chunkX, chunkZ) {
        const chunkKey = `${chunkX},${chunkZ}`;
        if (this.chunks.has(chunkKey)) {
            return this.chunks.get(chunkKey);
        }

        const chunk = new Chunk(chunkX, chunkZ, this.scene, this.blockMaterials);
        this.chunks.set(chunkKey, chunk);

        // Simple terrain generation
        for (let z = 0; z < CHUNK_SIZE; z++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
                // Perlin noise or similar for heightmap would be here
                const worldX = chunkX * CHUNK_SIZE + x;
                const worldZ = chunkZ * CHUNK_SIZE + z;
                const height = Math.floor(
                    SEA_LEVEL +
                    5 * Math.sin(worldX * 0.1) +
                    5 * Math.cos(worldZ * 0.15) +
                    2 * Math.sin(worldX * 0.05 + worldZ * 0.08)
                );

                for (let y = 0; y < WORLD_HEIGHT; y++) {
                    let blockId = BLOCK_TYPES.AIR;
                    if (y < height - 3) {
                        blockId = BLOCK_TYPES.STONE;
                    } else if (y < height) {
                        blockId = BLOCK_TYPES.DIRT;
                    } else if (y === height) {
                        blockId = BLOCK_TYPES.GRASS;
                    }
                    chunk.setBlock(x, y, z, blockId);
                }
            }
        }
        chunk.isDirty = true; // Mark as dirty so mesh is generated on next update
        return chunk;
    }

    /**
     * Gets the block ID at global world coordinates.
     * @param {number} x - World X coordinate.
     * @param {number} y - World Y coordinate.
     * @param {number} z - World Z coordinate.
     * @returns {number} The ID of the block, or BLOCK_TYPES.AIR if outside world bounds or chunk not loaded.
     */
    getBlock(x, y, z) {
        if (y < 0 || y >= WORLD_HEIGHT) {
            return BLOCK_TYPES.AIR; // Out of vertical bounds
        }

        const chunkX = Math.floor(x / CHUNK_SIZE);
        const chunkZ = Math.floor(z / CHUNK_SIZE);
        const localX = x % CHUNK_SIZE < 0 ? x % CHUNK_SIZE + CHUNK_SIZE : x % CHUNK_SIZE;
        const localZ = z % CHUNK_SIZE < 0 ? z % CHUNK_SIZE + CHUNK_SIZE : z % CHUNK_SIZE;

        const chunk = this.getChunk(chunkX, chunkZ);
        if (!chunk) {
            return BLOCK_TYPES.AIR; // Chunk not loaded
        }
        return chunk.getBlock(localX, y, localZ);
    }

    /**
     * Sets the block ID at global world coordinates.
     * @param {number} x - World X coordinate.
     * @param {number} y - World Y coordinate.
     * @param {number} z - World Z coordinate.
     * @param {number} blockId - The new block ID.
     * @returns {boolean} True if the block was set, false otherwise.
     */
    setBlock(x, y, z, blockId) {
        if (y < 0 || y >= WORLD_HEIGHT) {
            return false; // Out of vertical bounds
        }

        const chunkX = Math.floor(x / CHUNK_SIZE);
        const chunkZ = Math.floor(z / CHUNK_SIZE);
        const localX = x % CHUNK_SIZE < 0 ? x % CHUNK_SIZE + CHUNK_SIZE : x % CHUNK_SIZE;
        const localZ = z % CHUNK_SIZE < 0 ? z % CHUNK_SIZE + CHUNK_SIZE : z % CHUNK_SIZE;

        const chunk = this.getChunk(chunkX, chunkZ);
        if (!chunk) {
            console.warn(`Attempted to set block at (${x},${y},${z}) but chunk (${chunkX},${chunkZ}) is not loaded.`);
            return false;
        }

        const changed = chunk.setBlock(localX, y, localZ, blockId);
        if (changed) {
            // Mark surrounding chunks as needing update if the block is on a chunk boundary
            const neighborsToUpdate = new Set();
            if (localX === 0) neighborsToUpdate.add(`${chunkX - 1},${chunkZ}`);
            if (localX === CHUNK_SIZE - 1) neighborsToUpdate.add(`${chunkX + 1},${chunkZ}`);
            if (localZ === 0) neighborsToUpdate.add(`${chunkX},${chunkZ - 1}`);
            if (localZ === CHUNK_SIZE - 1) neighborsToUpdate.add(`${chunkX},${chunkZ + 1}`);

            neighborsToUpdate.forEach(key => {
                const neighborChunk = this.chunks.get(key);
                if (neighborChunk) {
                    neighborChunk.isDirty = true;
                }
            });

            // Play sound effect
            if (blockId === BLOCK_TYPES.AIR && this.blockBreakSound) {
                this.blockBreakSound.position.set(x + 0.5, y + 0.5, z + 0.5);
                if (this.blockBreakSound.isPlaying) this.blockBreakSound.stop();
                this.blockBreakSound.play();
            } else if (blockId !== BLOCK_TYPES.AIR && this.blockPlaceSound) {
                this.blockPlaceSound.position.set(x + 0.5, y + 0.5, z + 0.5);
                if (this.blockPlaceSound.isPlaying) this.blockPlaceSound.stop();
                this.blockPlaceSound.play();
            }
        }
        return changed;
    }

    /**
     * Updates all chunks, regenerating meshes for dirty ones.
     */
    update() {
        if (Object.keys(this.blockMaterials).length === 0) {
            // Materials not yet loaded, skip update
            return;
        }

        const getNeighborBlockFn = (x, y, z) => this.getBlock(x, y, z);

        for (const chunk of this.chunks.values()) {
            if (chunk.isDirty) {
                chunk.generateMesh(getNeighborBlockFn);
            }
        }
    }

    /**
     * Disposes of all world resources.
     */
    dispose() {
        for (const chunk of this.chunks.values()) {
            chunk.dispose();
        }
        this.chunks.clear();
        if (this.blockPlaceSound) this.scene.remove(this.blockPlaceSound);
        if (this.blockBreakSound) this.scene.remove(this.blockBreakSound);
    }
}
