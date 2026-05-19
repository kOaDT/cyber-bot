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

  const store = createObjectStore(config.assetFile);
  const lastEpisode = await config.getLastEpisode();
  const lastProcessed = await store.load();

  const usingId = lastEpisode.id != null;
  const alreadyProcessed = usingId
    ? lastEpisode.id === lastProcessed.id
    : lastEpisode.episodeNumber <= (lastProcessed.episodeNumber || 0);
  const identifier = usingId ? { id: lastEpisode.id } : { episodeNumber: lastEpisode.episodeNumber };

  if (alreadyProcessed) {
    logger.info('No new episode to process');
    return;
  }

  logger.info('New episode found', identifier);

  const relevancePayload = { title: lastEpisode.title, source: 'podcast episode' };
  if (lastEpisode.transcript) {
    relevancePayload.content = lastEpisode.transcript;
  }

  const { relevant } = await evaluateRelevance(relevancePayload);

  if (!relevant) {
    await store.save(identifier);
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

  await store.save(identifier);
  await sendMessage(summary, process.env.TELEGRAM_TOPIC_PODCAST);
}

module.exports = { runPodcast };
