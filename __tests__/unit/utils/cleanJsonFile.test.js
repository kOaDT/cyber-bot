const { cleanProcessedData } = require('../../../crons/utils/cleanJsonFile');
const fs = require('fs').promises;

// Mock the fs.promises module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock the logger
jest.mock('../../../crons/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe('cleanJsonFile utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should filter out old entries', async () => {
    // Mock data with dates
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

    // Execute function
    await cleanProcessedData(10, 'test.json');

    // Verify file was written with filtered data
    expect(fs.writeFile).toHaveBeenCalled();

    // Extract the second argument (data) from the first call
    const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);

    // Should only contain entries newer than 10 days
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
