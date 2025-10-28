import { expect } from 'chai';
import { BLOCK_TYPES, BLOCK_DATA } from '../src/blocks.js';

describe('blocks.js', () => {
    describe('BLOCK_TYPES', () => {
        it('should define GRASS, DIRT, STONE, and AIR with correct numeric values', () => {
            expect(BLOCK_TYPES).to.exist;
            expect(BLOCK_TYPES.AIR).to.equal(0);
            expect(BLOCK_TYPES.GRASS).to.equal(1);
            expect(BLOCK_TYPES.DIRT).to.equal(2);
            expect(BLOCK_TYPES.STONE).to.equal(3);
        });
    });

    describe('BLOCK_DATA', () => {
        it('should be an object', () => {
            expect(BLOCK_DATA).to.be.an('object');
        });

        it('should contain data for all defined BLOCK_TYPES', () => {
            for (const key in BLOCK_TYPES) {
                const blockId = BLOCK_TYPES[key];
                expect(BLOCK_DATA).to.have.property(blockId.toString());
            }
        });

        it('should have correct structure for each block type', () => {
            for (const key in BLOCK_TYPES) {
                const blockId = BLOCK_TYPES[key];
                const data = BLOCK_DATA[blockId];

                expect(data).to.be.an('object');
                expect(data).to.have.property('id').that.equals(blockId);
                expect(data).to.have.property('name').that.is.a('string');
                expect(data).to.have.property('solid').that.is.a('boolean');
                expect(data).to.have.property('textures').that.is.an('object');

                if (blockId !== BLOCK_TYPES.AIR) {
                    expect(data.textures).to.have.property('top').that.is.a('string');
                    expect(data.textures).to.have.property('side').that.is.a('string');
                    expect(data.textures).to.have.property('bottom').that.is.a('string');
                    // Basic check for CDN URL pattern
                    expect(data.textures.top).to.match(/^https?:\/\//);
                } else {
                    expect(data.textures.top).to.equal('');
                    expect(data.textures.side).to.equal('');
                    expect(data.textures.bottom).to.equal('');
                }
            }
        });

        it('should correctly mark AIR as non-solid and others as solid', () => {
            expect(BLOCK_DATA[BLOCK_TYPES.AIR].solid).to.be.false;
            expect(BLOCK_DATA[BLOCK_TYPES.GRASS].solid).to.be.true;
            expect(BLOCK_DATA[BLOCK_TYPES.DIRT].solid).to.be.true;
            expect(BLOCK_DATA[BLOCK_TYPES.STONE].solid).to.be.true;
        });
    });
});
