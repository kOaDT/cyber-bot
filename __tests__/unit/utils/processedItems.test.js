const fs = require('fs').promises;

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../crons/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { createArrayStore, createObjectStore, createKeyedStore } = require('../../../crons/utils/processedItems');

describe('processedItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-01-01T00:00:00.000Z');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createArrayStore', () => {
    const store = createArrayStore('assets/test.json');

    describe('load', () => {
      it('should return parsed array from file', async () => {
        fs.readFile.mockResolvedValue(JSON.stringify([{ id: '1' }]));
        const result = await store.load();
        expect(result).toEqual([{ id: '1' }]);
        expect(fs.readFile).toHaveBeenCalledWith('assets/test.json', 'utf8');
      });

      it('should return empty array when file does not exist', async () => {
        fs.readFile.mockRejectedValue(new Error('ENOENT'));
        const result = await store.load();
        expect(result).toEqual([]);
      });
    });

    describe('save', () => {
      it('should append entry with processedAt to existing data', async () => {
        fs.readFile.mockResolvedValue(JSON.stringify([{ id: '1', processedAt: '2025-01-01T00:00:00.000Z' }]));
        await store.save({ id: '2' });
        expect(fs.writeFile).toHaveBeenCalledWith(
          'assets/test.json',
          JSON.stringify(
            [
              { id: '1', processedAt: '2025-01-01T00:00:00.000Z' },
              { id: '2', processedAt: '2026-01-01T00:00:00.000Z' },
            ],
            null,
            2
          )
        );
      });

      it('should create new array when file does not exist', async () => {
        fs.readFile.mockRejectedValue(new Error('ENOENT'));
        await store.save({ url: 'https://example.com' });
        expect(fs.writeFile).toHaveBeenCalledWith(
          'assets/test.json',
          JSON.stringify([{ url: 'https://example.com', processedAt: '2026-01-01T00:00:00.000Z' }], null, 2)
        );
      });

      it('should log error when write fails', async () => {
        const logger = require('../../../crons/config/logger');
        fs.readFile.mockResolvedValue('[]');
        fs.writeFile.mockRejectedValueOnce(new Error('write error'));
        await store.save({ id: '1' });
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error saving'),
          expect.objectContaining({ error: 'write error' })
        );
      });
    });
  });

  describe('createObjectStore', () => {
    const store = createObjectStore('assets/test.json');

    describe('load', () => {
      it('should return parsed object from file', async () => {
        fs.readFile.mockResolvedValue(JSON.stringify({ episodeNumber: 42 }));
        const result = await store.load();
        expect(result).toEqual({ episodeNumber: 42 });
      });

      it('should return defaults when file does not exist', async () => {
        fs.readFile.mockRejectedValue(new Error('ENOENT'));
        const result = await store.load();
        expect(result).toEqual({ episodeNumber: 0 });
      });

      it('should use custom defaults', async () => {
        const customStore = createObjectStore('assets/custom.json', { count: -1 });
        fs.readFile.mockRejectedValue(new Error('ENOENT'));
        const result = await customStore.load();
        expect(result).toEqual({ count: -1 });
      });
    });

    describe('save', () => {
      it('should write data with processedAt', async () => {
        await store.save({ episodeNumber: 43 });
        expect(fs.writeFile).toHaveBeenCalledWith(
          'assets/test.json',
          JSON.stringify({ episodeNumber: 43, processedAt: '2026-01-01T00:00:00.000Z' })
        );
      });
    });
  });

  describe('createKeyedStore', () => {
    const store = createKeyedStore('assets/test.json');

    describe('load', () => {
      it('should return data for a specific key', async () => {
        fs.readFile.mockResolvedValue(JSON.stringify({ channel1: { videoId: 'abc' } }));
        const result = await store.load('channel1');
        expect(result).toEqual({ videoId: 'abc' });
      });

      it('should return default when key does not exist', async () => {
        fs.readFile.mockResolvedValue(JSON.stringify({ channel1: { videoId: 'abc' } }));
        const result = await store.load('unknown');
        expect(result).toEqual({ videoId: null });
      });

      it('should return default when file does not exist', async () => {
        fs.readFile.mockRejectedValue(new Error('ENOENT'));
        const result = await store.load('channel1');
        expect(result).toEqual({ videoId: null });
      });
    });

    describe('save', () => {
      it('should save data under the specified key', async () => {
        fs.readFile.mockResolvedValue(JSON.stringify({ existing: { videoId: 'old' } }));
        await store.save('newChannel', { videoId: 'xyz' });
        expect(fs.writeFile).toHaveBeenCalledWith(
          'assets/test.json',
          JSON.stringify(
            {
              existing: { videoId: 'old' },
              newChannel: { videoId: 'xyz', processedAt: '2026-01-01T00:00:00.000Z' },
            },
            null,
            2
          )
        );
      });

      it('should throw when write fails', async () => {
        fs.readFile.mockResolvedValue('{}');
        fs.writeFile.mockRejectedValueOnce(new Error('disk full'));
        await expect(store.save('ch', { videoId: '1' })).rejects.toThrow('Failed to save');
      });
    });
  });
});
