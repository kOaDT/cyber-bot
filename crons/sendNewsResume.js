const { onError } = require('./config/errors');
const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const crypto = require('crypto');
const { generate } = require('./utils/generate');
const { createNewsResumePrompt } = require('./utils/prompts');
const fs = require('fs').promises;
const xml2js = require('xml2js');
const RSSParser = require('rss-parser');
const { delay } = require('./utils/delay');
const { cleanProcessedData } = require('./utils/cleanJsonFile');
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
    const data = await fs.readFile(filePath, 'utf8');
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
 * Filters articles to include only those published within the last NB_DAYS_TO_FETCH days
 * and excludes already processed articles.
 *
 * @param {Object[]} articles - Array of articles.
 * @returns {Object[]} - Array of filtered articles.
 */
const filterRecentArticles = async (articles) => {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - NB_DAYS_TO_FETCH);

  let processedArticles = [];
  try {
    const fileContent = await fs.readFile('./assets/processedArticles.json', 'utf8');
    processedArticles = JSON.parse(fileContent);
  } catch (error) {
    logger.warn('Could not read processed articles file:', error.message);
  }

  const processedUrls = new Set(processedArticles.map((article) => article.url));

  return articles.filter((article) => {
    const pubDate = new Date(article.pubDate);
    return pubDate >= daysAgo && !processedUrls.has(article.link);
  });
};

/**
 * Selects random articles from the provided list.
 *
 * @param {Object[]} articles - Array of articles.
 * @returns {Object[]} - The selected articles.
 */
const selectRandomArticles = (articles) => {
  if (articles.length === 0) return null;
  const randomIndexes = Array.from({ length: NB_ARTICLES_TO_SEND }, () => crypto.randomInt(articles.length));
  return randomIndexes.map((index) => articles[index]);
};

/**
 * Saves the processed article to a JSON file.
 *
 * @param {string} articleUrl - The URL of the processed article.
 */
const saveProcessedArticle = async (articleUrl) => {
  const filePath = './assets/processedArticles.json';
  try {
    let processedArticles = [];
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      processedArticles = JSON.parse(fileContent);
    } catch (error) {
      // If the file doesn't exist or is empty, continue with an empty array
      logger.warn('Could not read existing data, starting fresh:', error.message);
    }

    processedArticles.push({
      url: articleUrl,
      processedAt: new Date().toISOString(),
    });

    await fs.writeFile(filePath, JSON.stringify(processedArticles, null, 2));
  } catch (error) {
    onError(error, 'saveProcessedArticle');
  }
};

const run = async ({ dryMode, lang }) => {
  try {
    await cleanProcessedData(NB_DAYS_TO_FETCH, './assets/processedArticles.json');

    const feeds = await parseOPML('./assets/CyberSecurityRSS.opml');
    logger.info(`Fetched ${feeds.length} feeds from OPML.`);

    const articles = await fetchArticles(feeds);
    logger.info(`Fetched a total of ${articles.length} articles.`);

    const recentArticles = await filterRecentArticles(articles);
    logger.info(`Found ${recentArticles.length} recent articles from the past ${NB_DAYS_TO_FETCH} days.`);

    if (recentArticles.length === 0) {
      logger.info('No recent articles found to display.');
      return;
    }

    const selectedArticles = selectRandomArticles(recentArticles);

    if (!selectedArticles) {
      logger.info('No recent articles found to display.');
      return;
    }

    logger.info(`Preparing news resume for ${selectedArticles.length} articles...`);

    for (const article of selectedArticles) {
      const categories =
        article.categories && Array.isArray(article.categories)
          ? article.categories.map((cat) => (typeof cat === 'string' ? cat : String(cat)))
          : [];

      const prompt = createNewsResumePrompt(article.title, categories, article.link, article.content, lang);
      const newsResume = await generate(prompt);

      if (dryMode) {
        logger.info(newsResume);
        continue;
      }
      await sendMessage(newsResume, process.env.TELEGRAM_TOPIC_NEWS, categories);
      await saveProcessedArticle(article.link);
      await delay(DELAY_BETWEEN_ARTICLES);
    }
    return logger.info('News resume sent successfully.');
  } catch (error) {
    onError(error, 'run');
  }
};

module.exports = { run };
