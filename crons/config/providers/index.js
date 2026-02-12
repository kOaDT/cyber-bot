const AI_PROVIDER = (process.env.AI_PROVIDER || 'mistral').toLowerCase();

const FALLBACK_MAP = {
  mistral: 'claude',
  claude: 'mistral',
};

let providerInstance = null;
let fallbackProviderInstance = null;

const createProvider = (name) => {
  switch (name) {
    case 'mistral': {
      const { MistralProvider } = require('./mistral');
      return new MistralProvider();
    }
    case 'claude': {
      const { ClaudeProvider } = require('./claude');
      return new ClaudeProvider();
    }
    default:
      throw new Error(`Invalid AI_PROVIDER: "${name}". Supported providers: mistral, claude`);
  }
};

const getProvider = () => {
  if (!providerInstance) {
    providerInstance = createProvider(AI_PROVIDER);
  }
  return providerInstance;
};

const getFallbackProvider = () => {
  if (fallbackProviderInstance) {
    return fallbackProviderInstance;
  }

  const fallbackName = FALLBACK_MAP[AI_PROVIDER];
  if (!fallbackName) {
    return null;
  }

  try {
    fallbackProviderInstance = createProvider(fallbackName);
  } catch {
    return null;
  }

  return fallbackProviderInstance;
};

const resetProvider = () => {
  providerInstance = null;
};

const resetFallbackProvider = () => {
  fallbackProviderInstance = null;
};

module.exports = { getProvider, getFallbackProvider, resetProvider, resetFallbackProvider, AI_PROVIDER };
