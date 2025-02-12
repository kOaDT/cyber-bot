const { onError } = require('./config/errors');
const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const crypto = require('crypto');
const { generate } = require('./utils/generate');
const { createNewsResumePrompt } = require('./utils/prompts');
const fs = require('fs');
const xml2js = require('xml2js');
const RSSParser = require('rss-parser');

const NB_DAYS_TO_FETCH = 3;
const NB_ARTICLES_TO_SEND = 1;
const DELAY_BETWEEN_ARTICLES = 10000;

/**
 * Parses the OPML file to extract RSS feed URLs.
 *
 * @param {string} filePath - Path to the OPML file.
 * @returns {Promise<string[]>} - A promise that resolves to an array of RSS feed URLs.
 */
const parseOPML = async (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(data);
    const feeds = [];

    const outline = result.opml.body[0].outline;
    const extractFeeds = (items) => {
      items.forEach((item) => {
        if (item.$.xmlUrl) {
          feeds.push(item.$.xmlUrl);
        }
        if (item.outline) {
          extractFeeds(item.outline);
        }
      });
    };

    extractFeeds(outline);
    return feeds;
  } catch (error) {
    onError(error, 'parseOPML');
  }
};

/**
 * Fetches articles from the provided RSS feed URLs.
 *
 * @param {string[]} feeds - Array of RSS feed URLs.
 * @returns {Promise<Object[]>} - A promise that resolves to an array of articles.
 */
const fetchArticles = async (feeds) => {
  const parser = new RSSParser();
  const allArticles = [];

  for (const feed of feeds) {
    try {
      const parsedFeed = await parser.parseURL(feed);
      allArticles.push(...parsedFeed.items);
    } catch (error) {
      onError(error, `fetchArticles ${feed}`);
    }
  }

  return allArticles;
};

/**
 * Filters articles to include only those published within the last NB_DAYS_TO_FETCH days.
 *
 * @param {Object[]} articles - Array of articles.
 * @returns {Object[]} - Array of filtered articles.
 */
const filterRecentArticles = (articles) => {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - NB_DAYS_TO_FETCH);

  return articles.filter((article) => {
    const pubDate = new Date(article.pubDate);
    return pubDate >= daysAgo;
  });
};

/**
 * Selects 3 random article from the provided list.
 *
 * @param {Object[]} articles - Array of articles.
 * @returns {Object[]} - The selected articles.
 */
const selectRandomArticles = (articles) => {
  if (articles.length === 0) return null;
  const randomIndexes = Array.from({ length: NB_ARTICLES_TO_SEND }, () => crypto.randomInt(articles.length));
  return randomIndexes.map((index) => articles[index]);
};

const run = async ({ dryMode, lang }) => {
  try {
    const feeds = await parseOPML('./assets/CyberSecurityRSS.opml');
    logger.info(`Fetched ${feeds.length} feeds from OPML.`);

    const articles = await fetchArticles(feeds);
    logger.info(`Fetched a total of ${articles.length} articles.`);

    const recentArticles = filterRecentArticles(articles);
    logger.info(`Found ${recentArticles.length} recent articles from the past week.`);

    const selectedArticles = selectRandomArticles(recentArticles);

    if (!selectedArticles) {
      logger.info('No recent articles found to display.');
      return;
    }

    logger.info(`Preparing news resume for ${selectedArticles.length} articles...`);

    for (const article of selectedArticles) {
      const prompt = createNewsResumePrompt(article.title, article.categories, article.link, article.content, lang);
      const newsResume = await generate(prompt);

      if (dryMode) {
        logger.info(newsResume);
        continue;
      }
      await sendMessage(newsResume);
      await delay(DELAY_BETWEEN_ARTICLES);
    }
    return logger.info('News resume sent successfully.');
  } catch (error) {
    onError(error, 'run');
  }
};

module.exports = { run };
