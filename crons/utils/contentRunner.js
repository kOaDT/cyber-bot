const { evaluateRelevance } = require('./relevance');
const { generate } = require('./generate');
const { sendMessage } = require('./sendMessage');
const { delay } = require('./delay');
const logger = require('../config/logger');

async function runContentJob(config, { dryMode, lang }) {
  try {
    await config.cleanup?.();

    const items = await config.fetchItems();
    const unprocessed = await config.filterNew(items);

    if (unprocessed.length === 0) {
      logger.info(`No new ${config.name} to process`);
      return;
    }

    const maxItems = config.maxItems ?? 1;
    const candidates = unprocessed.slice(0, config.maxCandidates ?? 5);
    let itemsSent = 0;

    for (let i = 0; i < candidates.length; i++) {
      const item = candidates[i];
      if (itemsSent >= maxItems) break;

      const { relevant } = await evaluateRelevance({
        title: item.title,
        content: item.content || item.title,
        source: config.source,
      });

      if (!relevant) {
        await config.saveProcessed(item);
        continue;
      }

      const enriched = config.enrichItem ? await config.enrichItem(item) : item;
      const prompt = config.createPrompt(enriched, lang);
      const summary = await generate(prompt);

      if (dryMode) {
        logger.info('Dry mode: No message sent', { summary });
      } else {
        await (config.send ? config.send(summary, enriched) : sendMessage(summary, config.topicId));
      }

      await config.saveProcessed(item);
      itemsSent++;

      const hasMoreCandidates = i < candidates.length - 1;
      if (itemsSent < maxItems && hasMoreCandidates && config.delayBetweenItems) {
        await delay(config.delayBetweenItems);
      }
    }

    if (itemsSent === 0) {
      logger.info(`No relevant ${config.name} found after relevance checks`);
    }
  } catch (error) {
    logger.error(`Error processing ${config.name}`, { error: error.message });
  }
}

module.exports = { runContentJob };
