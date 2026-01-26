const { getProvider } = require('../config/providers');
const logger = require('../config/logger');
const { validateLLMOutput } = require('./sanitize');

const generate = async (prompt, overrideParams = {}) => {
  const { skipValidation = false, ...providerParams } = overrideParams;
  const provider = getProvider();

  try {
    const output = await provider.generate(prompt, providerParams);

    if (!skipValidation) {
      const validation = validateLLMOutput(output);
      if (!validation.valid) {
        logger.warn(`Suspicious LLM output detected: ${validation.warnings.join(', ')}`);
        return null;
      }
    }

    return output;
  } catch (err) {
    if (err.statusCode === 429 || err.status === 429) {
      logger.error(`${provider.name} API rate limit exceeded - exiting`);
      process.exit(1);
    }
    logger.error(`${provider.name} API error: ${err.message}`);
    return null;
  }
};

module.exports = { generate };
