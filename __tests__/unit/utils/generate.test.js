const mockProvider = {
  name: 'MockProvider',
  generate: jest.fn(),
};

const mockFallbackProvider = {
  name: 'MockFallback',
  generate: jest.fn(),
};

jest.mock('../../../crons/config/providers', () => ({
  getProvider: jest.fn(() => mockProvider),
  getFallbackProvider: jest.fn(() => null),
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
    mockFallbackProvider.generate.mockReset();

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

  test('should skip validation when skipValidation is true', async () => {
    mockProvider.generate.mockResolvedValue('Content with Bearer token123');
    validateLLMOutput.mockReturnValue({
      valid: false,
      output: 'Content with Bearer token123',
      warnings: ['Suspicious pattern detected'],
    });

    const result = await generate('Test prompt', { skipValidation: true });

    expect(mockProvider.generate).toHaveBeenCalledWith('Test prompt', {});
    expect(validateLLMOutput).not.toHaveBeenCalled();
    expect(result).toBe('Content with Bearer token123');
  });

  test('should not pass skipValidation to provider', async () => {
    mockProvider.generate.mockResolvedValue('Generated content');

    await generate('Test prompt', { skipValidation: true, temperature: 0.8 });

    expect(mockProvider.generate).toHaveBeenCalledWith('Test prompt', { temperature: 0.8 });
  });

  test('should handle API errors gracefully', async () => {
    mockProvider.generate.mockRejectedValue(new Error('API error'));

    const result = await generate('Test prompt');

    expect(logger.error).toHaveBeenCalledWith('MockProvider API error: API error');
    expect(result).toBeNull();
  });

  test('should exit on rate limit when no fallback available (statusCode 429)', async () => {
    const { getFallbackProvider } = require('../../../crons/config/providers');
    getFallbackProvider.mockReturnValue(null);

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const error = new Error('Rate limit');
    error.statusCode = 429;
    mockProvider.generate.mockRejectedValue(error);

    await generate('Test prompt');

    expect(logger.error).toHaveBeenCalledWith('All providers rate limited - exiting');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  test('should exit on rate limit when no fallback available (status 429)', async () => {
    const { getFallbackProvider } = require('../../../crons/config/providers');
    getFallbackProvider.mockReturnValue(null);

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const error = new Error('Rate limit');
    error.status = 429;
    mockProvider.generate.mockRejectedValue(error);

    await generate('Test prompt');

    expect(logger.error).toHaveBeenCalledWith('All providers rate limited - exiting');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  test('should fall back to secondary provider on primary 429', async () => {
    const { getFallbackProvider } = require('../../../crons/config/providers');
    getFallbackProvider.mockReturnValue(mockFallbackProvider);

    const error = new Error('Rate limit');
    error.statusCode = 429;
    mockProvider.generate.mockRejectedValue(error);
    mockFallbackProvider.generate.mockResolvedValue('Fallback content');

    const result = await generate('Test prompt');

    expect(logger.warn).toHaveBeenCalledWith('MockProvider API rate limit exceeded - falling back to MockFallback');
    expect(mockFallbackProvider.generate).toHaveBeenCalledWith('Test prompt', {});
    expect(result).toBe('Fallback content');
  });

  test('should exit when both providers hit rate limit', async () => {
    const { getFallbackProvider } = require('../../../crons/config/providers');
    getFallbackProvider.mockReturnValue(mockFallbackProvider);

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const primaryError = new Error('Rate limit');
    primaryError.statusCode = 429;
    const fallbackError = new Error('Rate limit');
    fallbackError.status = 429;

    mockProvider.generate.mockRejectedValue(primaryError);
    mockFallbackProvider.generate.mockRejectedValue(fallbackError);

    await generate('Test prompt');

    expect(logger.warn).toHaveBeenCalledWith('MockProvider API rate limit exceeded - falling back to MockFallback');
    expect(logger.error).toHaveBeenCalledWith('All providers rate limited - exiting');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  test('should return null when fallback provider has generic error', async () => {
    const { getFallbackProvider } = require('../../../crons/config/providers');
    getFallbackProvider.mockReturnValue(mockFallbackProvider);

    const error = new Error('Rate limit');
    error.statusCode = 429;
    mockProvider.generate.mockRejectedValue(error);
    mockFallbackProvider.generate.mockRejectedValue(new Error('Server error'));

    const result = await generate('Test prompt');

    expect(logger.error).toHaveBeenCalledWith('MockFallback API error: Server error');
    expect(result).toBeNull();
  });

  test('should validate fallback provider output', async () => {
    const { getFallbackProvider } = require('../../../crons/config/providers');
    getFallbackProvider.mockReturnValue(mockFallbackProvider);

    const error = new Error('Rate limit');
    error.statusCode = 429;
    mockProvider.generate.mockRejectedValue(error);
    mockFallbackProvider.generate.mockResolvedValue('Suspicious fallback');
    validateLLMOutput.mockReturnValue({
      valid: false,
      output: 'Suspicious fallback',
      warnings: ['Suspicious pattern detected'],
    });

    const result = await generate('Test prompt');

    expect(logger.warn).toHaveBeenCalledWith('Suspicious LLM output detected: Suspicious pattern detected');
    expect(result).toBeNull();
  });

  test('should not instantiate fallback on successful primary call', async () => {
    const { getFallbackProvider } = require('../../../crons/config/providers');
    mockProvider.generate.mockResolvedValue('Primary content');

    const result = await generate('Test prompt');

    expect(getFallbackProvider).not.toHaveBeenCalled();
    expect(result).toBe('Primary content');
  });

  test('should not fall back on non-429 primary error', async () => {
    const { getFallbackProvider } = require('../../../crons/config/providers');
    mockProvider.generate.mockRejectedValue(new Error('Internal error'));

    const result = await generate('Test prompt');

    expect(getFallbackProvider).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('MockProvider API error: Internal error');
    expect(result).toBeNull();
  });
});
