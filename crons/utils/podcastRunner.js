const { createObjectStore } = require('./processedItems');
const { evaluateRelevance } = require('./relevance');
const { createPodcastResumePrompt } = require('./prompts');
const { generate } = require('./generate');
const { sendMessage } = require('./sendMessage');
const logger = require('../config/logger');

async function runPodcast(config, { dryMode, lang }) {
  if (config.preCheck && !config.preCheck()) {
    return;
  }

  try {
    const store = createObjectStore(config.assetFile);
    const lastEpisode = await config.getLastEpisode();
    const lastProcessed = await store.load();

    if (lastEpisode.episodeNumber <= lastProcessed.episodeNumber) {
      logger.info('No new episode to process');
      return;
    }

    logger.info('New episode found', { episodeNumber: lastEpisode.episodeNumber });

    const relevancePayload = { title: lastEpisode.title, source: 'podcast episode' };
    if (lastEpisode.transcript) {
      relevancePayload.content = lastEpisode.transcript;
    }

    const { relevant } = await evaluateRelevance(relevancePayload);

    if (!relevant) {
      await store.save({ episodeNumber: lastEpisode.episodeNumber });
      return;
    }

    const transcript = lastEpisode.transcript || (await config.getTranscription(lastEpisode));
    const url = config.getEpisodeUrl ? config.getEpisodeUrl(lastEpisode) : lastEpisode.url;
    const prompt = createPodcastResumePrompt(config.name, lastEpisode.title, transcript, url, lang);
    const summary = await generate(prompt);

    if (dryMode) {
      logger.info('Dry mode: No message sent', { summary });
      return;
    }

    await store.save({ episodeNumber: lastEpisode.episodeNumber });
    await sendMessage(summary, process.env.TELEGRAM_TOPIC_PODCAST);
  } catch (error) {
    logger.error(`Error sending ${config.name} resume`, { error: error.message });
  }
}

module.exports = { runPodcast };
