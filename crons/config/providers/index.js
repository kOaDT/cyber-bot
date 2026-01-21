const AI_PROVIDER = (process.env.AI_PROVIDER || 'mistral').toLowerCase();

let providerInstance = null;

const getProvider = () => {
  if (providerInstance) {
    return providerInstance;
  }

  switch (AI_PROVIDER) {
    case 'mistral': {
      const { MistralProvider } = require('./mistral');
      providerInstance = new MistralProvider();
      break;
    }
    case 'claude': {
      const { ClaudeProvider } = require('./claude');
      providerInstance = new ClaudeProvider();
      break;
    }
    default:
      throw new Error(`Invalid AI_PROVIDER: "${AI_PROVIDER}". Supported providers: mistral, claude`);
  }

  return providerInstance;
};

const resetProvider = () => {
  providerInstance = null;
};

module.exports = { getProvider, resetProvider, AI_PROVIDER };
