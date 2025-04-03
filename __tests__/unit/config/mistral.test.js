// We need to mock the Mistral library and process.env before requiring the module
jest.mock('@mistralai/mistralai', () => ({
  Mistral: jest.fn(() => ({
    // Mock any methods used by mistralClient
  })),
}));

describe('Mistral configuration', () => {
  let originalEnv;

  beforeEach(() => {
    // Store original process.env
    originalEnv = { ...process.env };

    // Set required env vars for module to load
    process.env.MISTRAL_API_KEY = 'test-api-key';

    // Clear module cache to ensure fresh require
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original process.env
    process.env = originalEnv;
  });

  test('should initialize mistralClient with API key', () => {
    const { Mistral } = require('@mistralai/mistralai');
    const { mistralClient } = require('../../../crons/config/mistral');

    expect(Mistral).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
    });

    expect(mistralClient).toBeDefined();
  });

  test('should have DEFAULT_PARAMS with expected properties', () => {
    const { DEFAULT_PARAMS } = require('../../../crons/config/mistral');

    expect(DEFAULT_PARAMS).toHaveProperty('model');
    expect(DEFAULT_PARAMS).toHaveProperty('temperature');
    expect(DEFAULT_PARAMS).toHaveProperty('max_tokens');
    expect(DEFAULT_PARAMS).toHaveProperty('top_p');
  });

  test('should use environment variables for DEFAULT_PARAMS if available', () => {
    process.env.MISTRAL_MODEL = 'custom-model';
    process.env.MISTRAL_TEMPERATURE = '0.5';

    // Re-require to get fresh config with new env vars
    const { DEFAULT_PARAMS } = require('../../../crons/config/mistral');

    expect(DEFAULT_PARAMS.model).toBe('custom-model');
    expect(DEFAULT_PARAMS.temperature).toBe('0.5');
  });

  test('should throw error if MISTRAL_API_KEY is not set', () => {
    delete process.env.MISTRAL_API_KEY;

    expect(() => {
      require('../../../crons/config/mistral');
    }).toThrow('MISTRAL_API_KEY is not set');
  });
});
