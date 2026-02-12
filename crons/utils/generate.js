const { getProvider, getFallbackProvider } = require('../config/providers');
const logger = require('../config/logger');
const { validateLLMOutput } = require('./sanitize');

const generate = async (prompt, overrideParams = {}) => {
  const { skipValidation = false, ...providerParams } = overrideParams;
  const providers = [getProvider()];

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
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
      const isRateLimit = err.statusCode === 429 || err.status === 429;

      if (isRateLimit && providers.length === 1) {
        const fallback = getFallbackProvider();
        if (fallback) {
          logger.warn(`${provider.name} API rate limit exceeded - falling back to ${fallback.name}`);
          providers.push(fallback);
          continue;
        }
      }

      if (isRateLimit) {
        logger.error('All providers rate limited - exiting');
        process.exit(1);
      }

      logger.error(`${provider.name} API error: ${err.message}`);
      return null;
    }
  }
};

module.exports = { generate };
