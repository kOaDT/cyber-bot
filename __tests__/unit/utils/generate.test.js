const mockProvider = {
  name: 'MockProvider',
  generate: jest.fn(),
};

jest.mock('../../../crons/config/providers', () => ({
  getProvider: jest.fn(() => mockProvider),
}));

jest.mock('../../../crons/config/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../../../crons/utils/sanitize', () => ({
  validateLLMOutput: jest.fn((output) => ({ valid: true, output, warnings: [] })),
}));

describe('generate utility', () => {
  let generate;
  let logger;
  let validateLLMOutput;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    mockProvider.generate.mockReset();

    logger = require('../../../crons/config/logger');
    validateLLMOutput = require('../../../crons/utils/sanitize').validateLLMOutput;
    generate = require('../../../crons/utils/generate').generate;
  });

  test('should call provider.generate with correct parameters', async () => {
    mockProvider.generate.mockResolvedValue('Generated content');

    const result = await generate('Test prompt');

    expect(mockProvider.generate).toHaveBeenCalledWith('Test prompt', {});
    expect(result).toBe('Generated content');
  });

  test('should pass override parameters to provider', async () => {
    mockProvider.generate.mockResolvedValue('Custom content');

    const customParams = { temperature: 0.8, max_tokens: 500 };
    await generate('Test prompt', customParams);

    expect(mockProvider.generate).toHaveBeenCalledWith('Test prompt', customParams);
  });

  test('should validate LLM output', async () => {
    mockProvider.generate.mockResolvedValue('Safe content');

    await generate('Test prompt');

    expect(validateLLMOutput).toHaveBeenCalledWith('Safe content');
  });

  test('should return null for suspicious output', async () => {
    mockProvider.generate.mockResolvedValue('Suspicious content');
    validateLLMOutput.mockReturnValue({
      valid: false,
      output: 'Suspicious content',
      warnings: ['Suspicious pattern detected'],
    });

    const result = await generate('Test prompt');

    expect(logger.warn).toHaveBeenCalledWith('Suspicious LLM output detected: Suspicious pattern detected');
    expect(result).toBeNull();
  });

  test('should handle API errors gracefully', async () => {
    mockProvider.generate.mockRejectedValue(new Error('API error'));

    const result = await generate('Test prompt');

    expect(logger.error).toHaveBeenCalledWith('MockProvider API error: API error');
    expect(result).toBeNull();
  });

  test('should exit on rate limit error (statusCode 429)', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const error = new Error('Rate limit');
    error.statusCode = 429;
    mockProvider.generate.mockRejectedValue(error);

    await generate('Test prompt');

    expect(logger.error).toHaveBeenCalledWith('MockProvider API rate limit exceeded - exiting');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  test('should exit on rate limit error (status 429)', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const error = new Error('Rate limit');
    error.status = 429;
    mockProvider.generate.mockRejectedValue(error);

    await generate('Test prompt');

    expect(logger.error).toHaveBeenCalledWith('MockProvider API rate limit exceeded - exiting');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });
});
