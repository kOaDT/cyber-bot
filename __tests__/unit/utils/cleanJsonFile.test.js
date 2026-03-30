const { cleanProcessedData } = require('../../../crons/utils/cleanJsonFile');
const fs = require('fs').promises;

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
    rename: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    rmdir: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../crons/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe('cleanJsonFile utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should filter out old entries using atomic write', async () => {
    const now = new Date();
    const sixDaysAgo = new Date(now);
    sixDaysAgo.setDate(now.getDate() - 6);
    const elevenDaysAgo = new Date(now);
    elevenDaysAgo.setDate(now.getDate() - 11);

    const mockData = [
      { id: 1, processedAt: now.toISOString() },
      { id: 2, processedAt: sixDaysAgo.toISOString() },
      { id: 3, processedAt: elevenDaysAgo.toISOString() },
    ];

    fs.readFile.mockResolvedValue(JSON.stringify(mockData));

    await cleanProcessedData(10, 'test.json');

    expect(fs.writeFile).toHaveBeenCalled();
    expect(fs.rename).toHaveBeenCalledWith(expect.stringContaining('.tmp'), 'test.json');
    expect(fs.mkdir).toHaveBeenCalledWith('test.json.lock');
    expect(fs.rmdir).toHaveBeenCalledWith('test.json.lock');

    const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);
    expect(savedData.length).toBe(2);
    expect(savedData.some((item) => item.id === 3)).toBe(false);
    expect(savedData.some((item) => item.id === 1)).toBe(true);
    expect(savedData.some((item) => item.id === 2)).toBe(true);
  });

  test('should handle file read errors', async () => {
    const logger = require('../../../crons/config/logger');

    fs.readFile.mockRejectedValue(new Error('File not found'));

    await cleanProcessedData(10, 'nonexistent.json');

    expect(logger.error).toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
});
