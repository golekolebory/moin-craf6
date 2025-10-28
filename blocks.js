/**
 * @typedef {Object} BlockTexturePaths
 * @property {string} top - URL to the top face texture.
 * @property {string} side - URL to the side faces texture.
 * @property {string} bottom - URL to the bottom face texture.
 */

/**
 * @typedef {Object} BlockData
 * @property {number} id - Unique identifier for the block.
 * @property {string} name - Human-readable name of the block.
 * @property {boolean} solid - True if the block is solid and blocks movement/rays.
 * @property {BlockTexturePaths} textures - URLs for the block's textures.
 */

/**
 * Enum for block types.
 * @readonly
 * @enum {number}
 */
export const BLOCK_TYPES = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3
};

/**
 * Data map for all block types, indexed by their ID.
 * @type {Object.<number, BlockData>}
 */
export const BLOCK_DATA = {
    [BLOCK_TYPES.AIR]: {
        id: BLOCK_TYPES.AIR,
        name: 'Air',
        solid: false,
        textures: {
            top: '', side: '', bottom: '' // Air has no textures
        }
    },
    [BLOCK_TYPES.GRASS]: {
        id: BLOCK_TYPES.GRASS,
        name: 'Grass Block',
        solid: true,
        textures: {
            top: 'https://via.placeholder.com/64x64/00FF00/000000?text=GRASS_TOP', // Green
            side: 'https://via.placeholder.com/64x64/6B4D2C/000000?text=GRASS_SIDE', // Brownish-green
            bottom: 'https://via.placeholder.com/64x64/6B4D2C/000000?text=DIRT' // Brown
        }
    },
    [BLOCK_TYPES.DIRT]: {
        id: BLOCK_TYPES.DIRT,
        name: 'Dirt Block',
        solid: true,
        textures: {
            top: 'https://via.placeholder.com/64x64/6B4D2C/000000?text=DIRT', // Brown
            side: 'https://via.placeholder.com/64x64/6B4D2C/000000?text=DIRT',
            bottom: 'https://via.placeholder.com/64x64/6B4D2C/000000?text=DIRT'
        }
    },
    [BLOCK_TYPES.STONE]: {
        id: BLOCK_TYPES.STONE,
        name: 'Stone Block',
        solid: true,
        textures: {
            top: 'https://via.placeholder.com/64x64/808080/000000?text=STONE', // Grey
            side: 'https://via.placeholder.com/64x64/808080/000000?text=STONE',
            bottom: 'https://via.placeholder.com/64x64/808080/000000?text=STONE'
        }
    }
};

/**
 * Loads all textures required for the blocks.
 * @param {THREE.TextureLoader} textureLoader - The Three.js TextureLoader instance.
 * @returns {Object.<number, THREE.Material[]>} An object mapping block IDs to an array of Three.js materials (one for each face).
 */
export async function loadBlockMaterials(textureLoader) {
    const materials = {};
    const promises = [];

    for (const blockId in BLOCK_DATA) {
        if (BLOCK_DATA[blockId].id === BLOCK_TYPES.AIR) {
            materials[blockId] = []; // Air has no materials
            continue;
        }

        const block = BLOCK_DATA[blockId];
        const textureUrls = [
            block.textures.side, // Right
            block.textures.side, // Left
            block.textures.top,   // Top
            block.textures.bottom,// Bottom
            block.textures.side, // Front
            block.textures.side  // Back
        ];

        const blockMaterials = [];
        for (const url of textureUrls) {
            promises.push(
                new Promise((resolve, reject) => {
                    textureLoader.load(
                        url,
                        (texture) => {
                            texture.wrapS = THREE.RepeatWrapping;
                            texture.wrapT = THREE.RepeatWrapping;
                            texture.magFilter = THREE.LinearFilter;
                            texture.minFilter = THREE.LinearFilter;
                            blockMaterials.push(new THREE.MeshLambertMaterial({ map: texture }));
                            resolve();
                        },
                        undefined, // onProgress callback
                        (err) => {
                            console.error(`Error loading texture for block ${block.name} from ${url}:`, err);
                            // Provide a fallback material in case of error
                            blockMaterials.push(new THREE.MeshLambertMaterial({ color: 0xFF00FF })); // Magenta error color
                            resolve();
                        }
                    );
                })
            );
        }
        materials[blockId] = blockMaterials;
    }

    await Promise.all(promises);
    return materials;
}
