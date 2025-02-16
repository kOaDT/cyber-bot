const { Mistral } = require('@mistralai/mistralai');

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

if (!MISTRAL_API_KEY) {
  throw new Error('MISTRAL_API_KEY is not set');
}

const mistralClient = new Mistral({
  apiKey: MISTRAL_API_KEY,
});

const DEFAULT_PARAMS = {
  model: process.env.MISTRAL_MODEL || 'mistral-large-2411',
  temperature: process.env.MISTRAL_TEMPERATURE || 0.1,
  max_tokens: process.env.MISTRAL_MAX_TOKENS || 2000,
  top_p: process.env.MISTRAL_TOP_P || 0.85,
  random_seed: process.env.MISTRAL_RANDOM_SEED || 42,
  presence_penalty: process.env.MISTRAL_PRESENCE_PENALTY || 0.1,
  frequency_penalty: process.env.MISTRAL_FREQUENCY_PENALTY || 0.1,
};

module.exports = {
  mistralClient,
  DEFAULT_PARAMS,
};
