jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn(() => ({
    messages: {
      create: jest.fn(),
    },
  }));
});

describe('ClaudeProvider', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.CLAUDE_API_KEY = 'test-api-key';
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should initialize with API key', () => {
    const Anthropic = require('@anthropic-ai/sdk');
    const { ClaudeProvider } = require('../../../../crons/config/providers/claude');

    const provider = new ClaudeProvider();

    expect(Anthropic).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    expect(provider.name).toBe('Claude');
  });

  test('should throw error if CLAUDE_API_KEY is not set', () => {
    delete process.env.CLAUDE_API_KEY;

    expect(() => {
      const { ClaudeProvider } = require('../../../../crons/config/providers/claude');
      new ClaudeProvider();
    }).toThrow('CLAUDE_API_KEY is not set');
  });

  test('should have DEFAULT_PARAMS with expected properties', () => {
    const { DEFAULT_PARAMS } = require('../../../../crons/config/providers/claude');

    expect(DEFAULT_PARAMS).toHaveProperty('model');
    expect(DEFAULT_PARAMS).toHaveProperty('max_tokens');
    expect(DEFAULT_PARAMS).toHaveProperty('temperature');
  });

  test('should use environment variables for DEFAULT_PARAMS', () => {
    process.env.CLAUDE_MODEL = 'claude-3-opus-20240229';
    process.env.CLAUDE_TEMPERATURE = '0.5';
    process.env.CLAUDE_MAX_TOKENS = '1000';

    const { DEFAULT_PARAMS } = require('../../../../crons/config/providers/claude');

    expect(DEFAULT_PARAMS.model).toBe('claude-3-opus-20240229');
    expect(DEFAULT_PARAMS.temperature).toBe(0.5);
    expect(DEFAULT_PARAMS.max_tokens).toBe(1000);
  });

  test('should generate content using Claude API', async () => {
    const Anthropic = require('@anthropic-ai/sdk');
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ text: 'Generated content' }],
    });
    Anthropic.mockImplementation(() => ({
      messages: { create: mockCreate },
    }));

    const { ClaudeProvider } = require('../../../../crons/config/providers/claude');
    const provider = new ClaudeProvider();

    const result = await provider.generate('Test prompt');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Test prompt' }],
      })
    );
    expect(result).toBe('Generated content');
  });

  test('should filter out Mistral-specific parameters', async () => {
    const Anthropic = require('@anthropic-ai/sdk');
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ text: 'Content' }],
    });
    Anthropic.mockImplementation(() => ({
      messages: { create: mockCreate },
    }));

    const { ClaudeProvider } = require('../../../../crons/config/providers/claude');
    const provider = new ClaudeProvider();

    await provider.generate('Test', {
      top_p: 0.9,
      random_seed: 42,
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
      temperature: 0.5,
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('top_p');
    expect(callArgs).not.toHaveProperty('random_seed');
    expect(callArgs).not.toHaveProperty('presence_penalty');
    expect(callArgs).not.toHaveProperty('frequency_penalty');
    expect(callArgs.temperature).toBe(0.5);
  });
});
