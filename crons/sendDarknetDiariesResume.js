const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const { generate } = require('./utils/generate');
const { createPodcastResumePrompt } = require('./utils/prompts');
const fs = require('fs').promises;
const cheerio = require('cheerio');

/**
 * Get the last episode of the podcast
 * @returns {Object} The last episode of the podcast
 */
const getLastDDEpisode = async () => {
  const response = await fetch('https://darknetdiaries.com/episode/');
  const html = await response.text();
  const $ = cheerio.load(html);
  const episodeElement = $('h2').first();
  const title = episodeElement.text();
  const episodeNumber = title.match(/\d+/)[0];

  return {
    title,
    episodeNumber: parseInt(episodeNumber),
    url: `https://darknetdiaries.com/episode/${episodeNumber}/`,
  };
};

/**
 * Get the last processed episode
 * @returns {Object} The last processed episode
 */
const getLastProcessedEpisode = async () => {
  try {
    const data = await fs.readFile('assets/processedDD.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.warn('No last processed episode found, creating a new one', { error: error.message });
    return { episodeNumber: 0 };
  }
};

/**
 * Save the last processed episode
 * @param {Object} episodeData - The episode data
 */
const saveLastProcessedEpisode = async (episodeData) => {
  await fs.writeFile(
    'assets/processedDD.json',
    JSON.stringify({
      episodeNumber: episodeData.episodeNumber,
      processedAt: new Date().toISOString(),
    })
  );
};

/**
 * Get the transcription of the episode
 * @param {number} episode - The episode number
 * @returns {string} The transcription of the episode
 */
const getTranscription = async (episode) => {
  const response = await fetch(`https://darknetdiaries.com/transcript/${episode}/`);
  const html = await response.text();
  const $ = cheerio.load(html);
  const transcription = $('pre').first().text();
  return transcription;
};

const run = async ({ dryMode, lang }) => {
  try {
    const lastEpisode = await getLastDDEpisode();
    const lastProcessed = await getLastProcessedEpisode();

    if (lastEpisode.episodeNumber > lastProcessed.episodeNumber) {
      logger.info(`New episode found`, { episodeNumber: lastEpisode.episodeNumber });

      const transcription = await getTranscription(lastEpisode.episodeNumber);
      const prompt = createPodcastResumePrompt(
        'Darknet Diaries',
        lastEpisode.title,
        transcription,
        lastEpisode.url,
        lang
      );
      const summary = await generate(prompt);

      if (!dryMode) {
        await saveLastProcessedEpisode(lastEpisode);
        await sendMessage(summary, process.env.TELEGRAM_TOPIC_PODCAST);
      } else {
        logger.info('Dry mode: No message sent', { summary });
      }
    } else {
      logger.info('No new episode to process');
    }
  } catch (error) {
    logger.error('Error sending Darknet Diaries resume', { error: error.message });
  }
};

module.exports = { run };
