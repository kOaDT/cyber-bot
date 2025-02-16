const { Mistral } = require('@mistralai/mistralai');

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

if (!MISTRAL_API_KEY) {
  throw new Error('MISTRAL_API_KEY is not set');
}

const mistralClient = new Mistral({
  apiKey: MISTRAL_API_KEY,
});

const DEFAULT_PARAMS = {
  model: 'mistral-large-2411',
  temperature: 0.1,
  max_tokens: 2000,
  top_p: 0.85,
  random_seed: 42,
  presence_penalty: 0.1,
  frequency_penalty: 0.1,
};

module.exports = {
  mistralClient,
  DEFAULT_PARAMS,
};
