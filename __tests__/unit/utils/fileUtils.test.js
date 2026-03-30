const fs = require('fs').promises;

jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    rename: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    rmdir: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn(),
  },
}));

const { withFileLock, atomicWriteFile } = require('../../../crons/utils/fileUtils');

describe('fileUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('atomicWriteFile', () => {
    it('should write to a tmp file then rename', async () => {
      await atomicWriteFile('/data/test.json', '{"a":1}');

      expect(fs.writeFile).toHaveBeenCalledWith(expect.stringMatching(/\/data\/test\.json\.\d+\.\d+\.tmp$/), '{"a":1}');
      expect(fs.rename).toHaveBeenCalledWith(expect.stringMatching(/\.tmp$/), '/data/test.json');
    });
  });

  describe('withFileLock', () => {
    it('should acquire lock, run fn, then release lock', async () => {
      const order = [];
      fs.mkdir.mockImplementation(() => {
        order.push('mkdir');
        return Promise.resolve();
      });
      fs.rmdir.mockImplementation(() => {
        order.push('rmdir');
        return Promise.resolve();
      });

      const result = await withFileLock('/data/test.json', async () => {
        order.push('fn');
        return 42;
      });

      expect(result).toBe(42);
      expect(order).toEqual(['mkdir', 'fn', 'rmdir']);
      expect(fs.mkdir).toHaveBeenCalledWith('/data/test.json.lock');
      expect(fs.rmdir).toHaveBeenCalledWith('/data/test.json.lock');
    });

    it('should release lock even if fn throws', async () => {
      await expect(
        withFileLock('/data/test.json', async () => {
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');

      expect(fs.rmdir).toHaveBeenCalledWith('/data/test.json.lock');
    });

    it('should retry when lock is held and eventually acquire', async () => {
      let attempts = 0;
      fs.mkdir.mockImplementation(() => {
        attempts++;
        if (attempts <= 2) {
          const err = new Error('EEXIST');
          err.code = 'EEXIST';
          return Promise.reject(err);
        }
        return Promise.resolve();
      });
      fs.stat.mockResolvedValue({ mtimeMs: Date.now() });

      const result = await withFileLock('/data/test.json', async () => 'ok');
      expect(result).toBe('ok');
      expect(attempts).toBe(3);
    });

    it('should remove stale lock and retry', async () => {
      let attempts = 0;
      fs.mkdir.mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          const err = new Error('EEXIST');
          err.code = 'EEXIST';
          return Promise.reject(err);
        }
        return Promise.resolve();
      });
      fs.stat.mockResolvedValue({ mtimeMs: Date.now() - 20_000 });

      const result = await withFileLock('/data/test.json', async () => 'recovered');
      expect(result).toBe('recovered');
      expect(fs.rmdir).toHaveBeenCalled();
    });

    it('should throw on non-EEXIST mkdir errors', async () => {
      fs.mkdir.mockRejectedValue(new Error('EACCES'));

      await expect(withFileLock('/data/test.json', async () => {})).rejects.toThrow('EACCES');
    });
  });
});
