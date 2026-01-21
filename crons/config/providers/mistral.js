const { Mistral } = require('@mistralai/mistralai');

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

const DEFAULT_PARAMS = {
  model: process.env.MISTRAL_MODEL || 'mistral-large-2411',
  temperature: parseFloat(process.env.MISTRAL_TEMPERATURE) || 0.1,
  max_tokens: parseInt(process.env.MISTRAL_MAX_TOKENS, 10) || 2000,
  top_p: parseFloat(process.env.MISTRAL_TOP_P) || 0.85,
  random_seed: parseInt(process.env.MISTRAL_RANDOM_SEED, 10) || 42,
  presence_penalty: parseFloat(process.env.MISTRAL_PRESENCE_PENALTY) || 0.1,
  frequency_penalty: parseFloat(process.env.MISTRAL_FREQUENCY_PENALTY) || 0.1,
};

class MistralProvider {
  constructor() {
    if (!MISTRAL_API_KEY) {
      throw new Error('MISTRAL_API_KEY is not set');
    }
    this.client = new Mistral({ apiKey: MISTRAL_API_KEY });
    this.name = 'Mistral';
  }

  async generate(prompt, overrideParams = {}) {
    const response = await this.client.chat.complete({
      ...DEFAULT_PARAMS,
      ...overrideParams,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0].message.content;
  }
}

module.exports = { MistralProvider, DEFAULT_PARAMS };
