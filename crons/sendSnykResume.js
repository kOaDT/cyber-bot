const { onError } = require('./config/errors');
const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const { generate } = require('./utils/generate');
const { createPodcastResumePrompt } = require('./utils/prompts');
const fs = require('fs').promises;
const { BrowserManager } = require('./utils/puppeteerUtils');

/**
 * Get the last episode of the podcast
 * @returns {Object} The last episode of the podcast
 */
const getLastSnykEpisode = async () => {
  const browser = await new BrowserManager().init();

  try {
    await browser.navigateTo('https://snyk.io/podcasts/the-secure-developer/');
    const episodeLink = await browser.getAttributeValue('article a[title="View episode"]', 'href');
    await browser.navigateTo(`https://snyk.io${episodeLink}`);
    await browser.clickAndWait('button[title="View transcript"]', { waitForSelector: '.marg-t-extra-large .txt-rich' });
    const transcriptContent = await browser.getText('.marg-t-extra-large .txt-rich');
    const pageTitle = await browser.getPageTitle();
    const episodeNb = pageTitle.match(/\d+/)?.[0];
    const title = await browser.getText('h1');

    return {
      episodeNumber: parseInt(episodeNb),
      title,
      transcript: transcriptContent,
      url: `https://snyk.io${episodeLink}`,
    };
  } finally {
    await browser.close();
  }
};

/**
 * Get the last processed episode
 * @returns {Object} The last processed episode
 */
const getLastProcessedEpisode = async () => {
  try {
    const data = await fs.readFile('assets/processedSnyk.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.warn('No last processed episode found, creating a new one:' + error.message);
    return { episodeNumber: 0 };
  }
};

/**
 * Save the last processed episode
 * @param {Object} episodeData - The episode data
 */
const saveLastProcessedEpisode = async (episodeData) => {
  await fs.writeFile(
    'assets/processedSnyk.json',
    JSON.stringify({
      episodeNumber: episodeData.episodeNumber,
      processedAt: new Date().toISOString(),
    })
  );
};

const run = async ({ dryMode, lang }) => {
  try {
    const lastEpisode = await getLastSnykEpisode();
    const lastProcessed = await getLastProcessedEpisode();

    if (lastEpisode.episodeNumber > lastProcessed.episodeNumber) {
      logger.info(`New episode found: ${lastEpisode.episodeNumber}`);

      const prompt = createPodcastResumePrompt(
        'Snyk',
        lastEpisode.title,
        lastEpisode.transcript,
        lastEpisode.url,
        lang
      );
      let summary = await generate(prompt);

      if (!dryMode) {
        await saveLastProcessedEpisode(lastEpisode);
        await sendMessage(summary, process.env.TELEGRAM_TOPIC_PODCAST);
      } else {
        logger.info('Dry mode: No message sent');
        logger.info(summary);
      }
    } else {
      logger.info('No new episode to process');
    }
  } catch (error) {
    onError(error, 'Error processing the podcast');
  }
};

module.exports = { run };
