const { mistralClient, DEFAULT_PARAMS } = require('../config/mistral');
const logger = require('../config/logger');

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

    return response.choices[0].message.content;
  } catch (err) {
    if (err.statusCode === 429) {
      logger.error('Mistral API rate limit exceeded - exiting');
      process.exit(1);
    }
    return null;
  }
};

module.exports = { generate };
