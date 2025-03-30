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
const getLastSecurityNowEpisode = async () => {
  const browser = await new BrowserManager().init();

  try {
    await browser.navigateTo('https://twit.tv/posts/transcripts');
    const episodeLink = await browser.page.evaluate(() => {
      const titles = Array.from(document.querySelectorAll('.title a'));
      const securityNowLink = titles.find((link) => link.textContent.includes('Security Now'));
      return securityNowLink ? securityNowLink.getAttribute('href') : null;
    });

    if (!episodeLink) {
      throw new Error('No Security Now episode found');
    }
    await browser.navigateTo(`https://twit.tv${episodeLink}`);
    const transcript = await browser.getText('.body.textual');
    const episodeNumber = parseInt(episodeLink.match(/\d+/)?.[0]);

    return {
      episodeNumber,
      title: `Security Now ${episodeNumber}`,
      transcript,
      url: `https://twit.tv${episodeLink}`,
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
    const data = await fs.readFile('assets/processedSecurityNow.json', 'utf8');
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
    'assets/processedSecurityNow.json',
    JSON.stringify({
      episodeNumber: episodeData.episodeNumber,
      processedAt: new Date().toISOString(),
    })
  );
};

const run = async ({ dryMode, lang }) => {
  try {
    const lastEpisode = await getLastSecurityNowEpisode();
    const lastProcessed = await getLastProcessedEpisode();

    if (lastEpisode.episodeNumber > lastProcessed.episodeNumber) {
      logger.info(`New episode found`, { episodeNumber: lastEpisode.episodeNumber });

      const prompt = createPodcastResumePrompt(
        'Security Now',
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
        logger.info('Dry mode: No message sent', { summary });
      }
    } else {
      logger.info('No new episode to process');
    }
  } catch (error) {
    logger.error('Error sending Security Now resume', { error: error.message });
  }
};

module.exports = { run };
