jest.mock('@mistralai/mistralai', () => ({
  Mistral: jest.fn(() => ({
    chat: { complete: jest.fn() },
  })),
}));

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn(() => ({
    messages: { create: jest.fn() },
  }));
});

describe('Provider factory', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.CLAUDE_API_KEY = 'test-claude-key';
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should return MistralProvider by default', () => {
    delete process.env.AI_PROVIDER;

    const { getProvider, resetProvider } = require('../../../../crons/config/providers');
    resetProvider();

    const provider = getProvider();

    expect(provider.name).toBe('Mistral');
  });

  test('should return MistralProvider when AI_PROVIDER is mistral', () => {
    process.env.AI_PROVIDER = 'mistral';

    const { getProvider, resetProvider } = require('../../../../crons/config/providers');
    resetProvider();

    const provider = getProvider();

    expect(provider.name).toBe('Mistral');
  });

  test('should return ClaudeProvider when AI_PROVIDER is claude', () => {
    process.env.AI_PROVIDER = 'claude';

    const { getProvider, resetProvider } = require('../../../../crons/config/providers');
    resetProvider();

    const provider = getProvider();

    expect(provider.name).toBe('Claude');
  });

  test('should be case-insensitive for AI_PROVIDER', () => {
    process.env.AI_PROVIDER = 'CLAUDE';

    const { getProvider, resetProvider } = require('../../../../crons/config/providers');
    resetProvider();

    const provider = getProvider();

    expect(provider.name).toBe('Claude');
  });

  test('should throw error for invalid AI_PROVIDER', () => {
    process.env.AI_PROVIDER = 'invalid-provider';

    const { getProvider, resetProvider } = require('../../../../crons/config/providers');
    resetProvider();

    expect(() => getProvider()).toThrow(
      'Invalid AI_PROVIDER: "invalid-provider". Supported providers: mistral, claude'
    );
  });

  test('should return singleton instance', () => {
    process.env.AI_PROVIDER = 'mistral';

    const { getProvider, resetProvider } = require('../../../../crons/config/providers');
    resetProvider();

    const provider1 = getProvider();
    const provider2 = getProvider();

    expect(provider1).toBe(provider2);
  });

  test('should reset provider instance', () => {
    process.env.AI_PROVIDER = 'mistral';

    const { getProvider, resetProvider } = require('../../../../crons/config/providers');
    resetProvider();

    const provider1 = getProvider();
    resetProvider();
    const provider2 = getProvider();

    expect(provider1).not.toBe(provider2);
  });
});

describe('Fallback provider factory', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.CLAUDE_API_KEY = 'test-claude-key';
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should return ClaudeProvider when primary is mistral', () => {
    process.env.AI_PROVIDER = 'mistral';

    const { getFallbackProvider, resetFallbackProvider } = require('../../../../crons/config/providers');
    resetFallbackProvider();

    const fallback = getFallbackProvider();

    expect(fallback.name).toBe('Claude');
  });

  test('should return MistralProvider when primary is claude', () => {
    process.env.AI_PROVIDER = 'claude';

    const { getFallbackProvider, resetFallbackProvider } = require('../../../../crons/config/providers');
    resetFallbackProvider();

    const fallback = getFallbackProvider();

    expect(fallback.name).toBe('Mistral');
  });

  test('should return null when fallback API key is not configured', () => {
    process.env.AI_PROVIDER = 'mistral';
    delete process.env.CLAUDE_API_KEY;

    const { getFallbackProvider, resetFallbackProvider } = require('../../../../crons/config/providers');
    resetFallbackProvider();

    const fallback = getFallbackProvider();

    expect(fallback).toBeNull();
  });

  test('should return singleton instance', () => {
    process.env.AI_PROVIDER = 'mistral';

    const { getFallbackProvider, resetFallbackProvider } = require('../../../../crons/config/providers');
    resetFallbackProvider();

    const fallback1 = getFallbackProvider();
    const fallback2 = getFallbackProvider();

    expect(fallback1).toBe(fallback2);
  });

  test('should reset fallback provider instance', () => {
    process.env.AI_PROVIDER = 'mistral';

    const { getFallbackProvider, resetFallbackProvider } = require('../../../../crons/config/providers');
    resetFallbackProvider();

    const fallback1 = getFallbackProvider();
    resetFallbackProvider();
    const fallback2 = getFallbackProvider();

    expect(fallback1).not.toBe(fallback2);
  });
});
