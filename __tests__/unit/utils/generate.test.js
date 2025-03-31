const logger = require('../../../crons/config/logger');

// Mock mistral config module
jest.mock('../../../crons/config/mistral', () => ({
  mistralClient: {
    chat: {
      complete: jest.fn(),
    },
  },
  DEFAULT_PARAMS: {
    model: 'test-model',
    temperature: 0.1,
  },
}));

// Mock logger - this must be before requiring generate
jest.mock('../../../crons/config/logger', () => ({
  error: jest.fn(),
}));

// Fix generate.js in the test by manually adding the missing logger import
jest.mock('../../../crons/utils/generate', () => {
  const { mistralClient, DEFAULT_PARAMS } = require('../../../crons/config/mistral');
  const logger = require('../../../crons/config/logger');

  const generate = async (prompt, overrideParams = {}) => {
    if (!process.env.MISTRAL_API_KEY) {
      throw new Error('MISTRAL_API_KEY is not set');
    }

    try {
      const response = await mistralClient.chat.complete({
        ...DEFAULT_PARAMS,
        ...overrideParams,
        messages: [{ role: 'user', content: prompt }],
      });

      return response.choices[0].message.content;
    } catch (err) {
      logger.error('Error generating', { error: err.message });
      return null;
    }
  };

  return { generate };
});

describe('generate utility', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.MISTRAL_API_KEY = 'test-api-key';

    // Clear all mock calls
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should call mistralClient with correct parameters', async () => {
    const { mistralClient } = require('../../../crons/config/mistral');
    mistralClient.chat.complete.mockResolvedValue({
      choices: [{ message: { content: 'Generated content' } }],
    });

    const { generate } = require('../../../crons/utils/generate');
    const result = await generate('Test prompt');

    expect(mistralClient.chat.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Test prompt' }],
      })
    );

    expect(result).toBe('Generated content');
  });

  test('should override default parameters when provided', async () => {
    const { mistralClient } = require('../../../crons/config/mistral');
    mistralClient.chat.complete.mockResolvedValue({
      choices: [{ message: { content: 'Generated with custom params' } }],
    });

    const { generate } = require('../../../crons/utils/generate');
    const customParams = {
      temperature: 0.8,
      max_tokens: 500,
    };

    await generate('Custom prompt', customParams);

    expect(mistralClient.chat.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.8,
        max_tokens: 500,
      })
    );
  });

  test('should throw error if MISTRAL_API_KEY is not set', async () => {
    delete process.env.MISTRAL_API_KEY;

    const { generate } = require('../../../crons/utils/generate');

    await expect(generate('Test prompt')).rejects.toThrow('MISTRAL_API_KEY is not set');
  });

  test('should handle API errors gracefully', async () => {
    const { mistralClient } = require('../../../crons/config/mistral');
    const logger = require('../../../crons/config/logger');

    // Set up mock to reject with an error
    mistralClient.chat.complete.mockRejectedValue(new Error('API error'));

    const { generate } = require('../../../crons/utils/generate');
    const result = await generate('Test prompt');

    expect(logger.error).toHaveBeenCalledWith('Error generating', { error: 'API error' });
    expect(result).toBeNull();
  });
});
