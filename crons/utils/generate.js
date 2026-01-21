const { mistralClient, DEFAULT_PARAMS } = require('../config/mistral');
const logger = require('../config/logger');
const { validateLLMOutput } = require('./sanitize');

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

const generate = async (prompt, overrideParams = {}) => {
  if (!MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY is not set');
  }

  try {
    const response = await mistralClient.chat.complete({
      ...DEFAULT_PARAMS,
      ...overrideParams,
      messages: [{ role: 'user', content: prompt }],
    });

    const output = response.choices[0].message.content;

    const validation = validateLLMOutput(output);
    if (!validation.valid) {
      logger.warn(`Suspicious LLM output detected: ${validation.warnings.join(', ')}`);
      return null;
    }

    return output;
  } catch (err) {
    if (err.statusCode === 429) {
      logger.error('Mistral API rate limit exceeded - exiting');
      process.exit(1);
    }
    return null;
  }
};

module.exports = { generate };
