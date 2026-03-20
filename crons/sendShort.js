/* eslint-disable max-len */
const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const { randomInt } = require('node:crypto');
const { createArrayStore } = require('./utils/processedItems');
const { cleanProcessedData } = require('./utils/cleanJsonFile');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const DAYS_AGO = 30;
const PROCESSED_FILE = './assets/processedShorts.json';

const QUERY =
  'cybersecurity OR "information security" OR "network security" OR "web security" OR "application security" OR "security research"';
const RELEVANCE_PARAMS = `&relevanceLanguage=en&order=rating&maxResults=50`;

const DO_YOU_WANT_EMOJI = false;
const BLACKLISTED_TERMS = [
  'hack fortnite',
  'hack minecraft',
  'hack roblox',
  'free robux',
  'free vbucks',
  'crypto',
  'make money',
  'get rich',
  'giveaway',
  '100%',
  'hack instagram',
  'hack facebook',
  'hack whatsapp',
];
const TECHNICAL_TERMS = [
  'tutorial',
  'analysis',
  'explanation',
  'guide',
  'walkthrough',
  'demonstration',
  'security',
  'vulnerability',
  'exploit',
  'protection',
  'defense',
  'prevention',
  'CVE',
  'cybersecurity',
  'information security',
  'network security',
  'web security',
  'application security',
  'security research',
  'RCE',
];

const store = createArrayStore(PROCESSED_FILE);

const run = async ({ dryMode }) => {
  try {
    await cleanProcessedData(DAYS_AGO, PROCESSED_FILE);

    const now = new Date();
    const publishedAfter = new Date(now.getTime() - DAYS_AGO * 24 * 60 * 60 * 1000).toISOString();

    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&q=${encodeURIComponent(QUERY)}${RELEVANCE_PARAMS}&publishedAfter=${publishedAfter}&key=${YOUTUBE_API_KEY}`;

    let response = await fetch(url);
    let data = await response.json();

    if (!data || !data.items) {
      logger.info('Error fetching YouTube data');
      return;
    }

    const processedShorts = await store.load();
    const processedIds = new Set(processedShorts.map((short) => short.id));

    const filteredShorts = data.items.filter((video) => {
      const title = video.snippet.title.toLowerCase();
      const description = video.snippet.description.toLowerCase();

      if (!DO_YOU_WANT_EMOJI) {
        const emojiCount = (title + description).match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27FF]/g)?.length || 0;
        if (emojiCount > 2) return false;
      }

      const hasBlacklistedTerm = BLACKLISTED_TERMS.some((term) => title.includes(term) || description.includes(term));
      if (hasBlacklistedTerm) return false;

      if (processedIds.has(video.id)) return false;

      return TECHNICAL_TERMS.some((term) => title.includes(term) || description.includes(term));
    });

    if (!filteredShorts.length) {
      logger.info('No relevant shorts found');
      return;
    }

    const randomShort = filteredShorts[randomInt(filteredShorts.length)];
    const videoId = randomShort.id.videoId;
    const title = randomShort.snippet.title;
    const description = randomShort.snippet.description;
    const message = `https://www.youtube.com/watch?v=${videoId}\n\n${title}\n\n${description}`;

    if (dryMode) {
      logger.info('Dry mode: No message sent', { message });
      return;
    }

    await sendMessage(message, process.env.TELEGRAM_TOPIC_YOUTUBE);
    await store.save({ id: videoId });
    logger.info('Message sent successfully');
  } catch (error) {
    logger.error('Error sending short', { error: error.message });
  }
};

module.exports = { run };
