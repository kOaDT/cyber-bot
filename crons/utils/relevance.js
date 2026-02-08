const { generate } = require('./generate');
const { createRelevancePrompt } = require('./prompts');
const logger = require('../config/logger');

const DEFAULT_THRESHOLD = 6;
const EXCERPT_MAX_LENGTH = 500;

/**
 * Evaluate the relevance of content before full AI generation.
 * Uses a lightweight AI call (~100-200 input tokens) to score content 1-10.
 * Fails open: returns relevant on any error to avoid silently blocking content.
 *
 * @param {Object} params
 * @param {string} params.title - The content title
 * @param {string} [params.content] - The content body (will be truncated to excerpt)
 * @param {string} params.source - The source type for logging (e.g., 'news article', 'podcast')
 * @returns {Promise<{relevant: boolean, score: number|null}>}
 */
const evaluateRelevance = async ({ title, content, source }) => {
  const threshold = parseInt(process.env.RELEVANCE_THRESHOLD, 10) || DEFAULT_THRESHOLD;

  try {
    const excerpt = content ? content.substring(0, EXCERPT_MAX_LENGTH) : '';
    const prompt = createRelevancePrompt(title, excerpt, source);

    const result = await generate(prompt, {
      max_tokens: 10,
      temperature: 0,
      skipValidation: true,
    });

    if (!result) {
      logger.warn('Relevance check returned no result, defaulting to relevant', { title, source });
      return { relevant: true, score: null };
    }

    const score = parseInt(result.trim(), 10);

    if (isNaN(score) || score < 1 || score > 10) {
      logger.warn('Relevance check returned invalid score, defaulting to relevant', {
        title,
        source,
        rawResult: result.trim(),
      });
      return { relevant: true, score: null };
    }

    const relevant = score >= threshold;

    logger.info(`Relevance check: ${relevant ? 'relevant' : 'skipped'}`, {
      title,
      source,
      score,
      threshold,
    });

    return { relevant, score };
  } catch (error) {
    logger.warn('Relevance check failed, defaulting to relevant', {
      title,
      source,
      error: error.message,
    });
    return { relevant: true, score: null };
  }
};

module.exports = { evaluateRelevance, DEFAULT_THRESHOLD, EXCERPT_MAX_LENGTH };
