jest.mock('@mistralai/mistralai', () => ({
  Mistral: jest.fn(() => ({
    chat: {
      complete: jest.fn(),
    },
  })),
}));

describe('MistralProvider', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.MISTRAL_API_KEY = 'test-api-key';
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should initialize with API key', () => {
    const { Mistral } = require('@mistralai/mistralai');
    const { MistralProvider } = require('../../../../crons/config/providers/mistral');

    const provider = new MistralProvider();

    expect(Mistral).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    expect(provider.name).toBe('Mistral');
  });

  test('should throw error if MISTRAL_API_KEY is not set', () => {
    delete process.env.MISTRAL_API_KEY;

    expect(() => {
      const { MistralProvider } = require('../../../../crons/config/providers/mistral');
      new MistralProvider();
    }).toThrow('MISTRAL_API_KEY is not set');
  });

  test('should have DEFAULT_PARAMS with expected properties', () => {
    const { DEFAULT_PARAMS } = require('../../../../crons/config/providers/mistral');

    expect(DEFAULT_PARAMS).toHaveProperty('model');
    expect(DEFAULT_PARAMS).toHaveProperty('temperature');
    expect(DEFAULT_PARAMS).toHaveProperty('max_tokens');
    expect(DEFAULT_PARAMS).toHaveProperty('top_p');
    expect(DEFAULT_PARAMS).toHaveProperty('random_seed');
    expect(DEFAULT_PARAMS).toHaveProperty('presence_penalty');
    expect(DEFAULT_PARAMS).toHaveProperty('frequency_penalty');
  });

  test('should use environment variables for DEFAULT_PARAMS', () => {
    process.env.MISTRAL_MODEL = 'custom-model';
    process.env.MISTRAL_TEMPERATURE = '0.5';
    process.env.MISTRAL_MAX_TOKENS = '1000';

    const { DEFAULT_PARAMS } = require('../../../../crons/config/providers/mistral');

    expect(DEFAULT_PARAMS.model).toBe('custom-model');
    expect(DEFAULT_PARAMS.temperature).toBe(0.5);
    expect(DEFAULT_PARAMS.max_tokens).toBe(1000);
  });

  test('should generate content using Mistral API', async () => {
    const { Mistral } = require('@mistralai/mistralai');
    const mockComplete = jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'Generated content' } }],
    });
    Mistral.mockImplementation(() => ({
      chat: { complete: mockComplete },
    }));

    const { MistralProvider } = require('../../../../crons/config/providers/mistral');
    const provider = new MistralProvider();

    const result = await provider.generate('Test prompt');

    expect(mockComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Test prompt' }],
      })
    );
    expect(result).toBe('Generated content');
  });

  test('should override default parameters', async () => {
    const { Mistral } = require('@mistralai/mistralai');
    const mockComplete = jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'Custom content' } }],
    });
    Mistral.mockImplementation(() => ({
      chat: { complete: mockComplete },
    }));

    const { MistralProvider } = require('../../../../crons/config/providers/mistral');
    const provider = new MistralProvider();

    await provider.generate('Test prompt', { temperature: 0.8 });

    expect(mockComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.8,
      })
    );
  });
});
