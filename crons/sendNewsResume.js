const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const { randomInt } = require('node:crypto');
const { createNewsResumePrompt } = require('./utils/prompts');
const { createArrayStore } = require('./utils/processedItems');
const { cleanProcessedData } = require('./utils/cleanJsonFile');
const { runContentJob } = require('./utils/contentRunner');
const fs = require('fs').promises;
const xml2js = require('xml2js');
const RSSParser = require('rss-parser');

const NB_DAYS_TO_FETCH = parseInt(process.env.NEWS_DAYS_TO_FETCH, 10) || 3;
const NB_ARTICLES_TO_SEND = parseInt(process.env.NEWS_ARTICLES_TO_SEND, 10) || 1;
const DELAY_BETWEEN_ARTICLES = parseInt(process.env.NEWS_DELAY_BETWEEN_ARTICLES, 10) || 10000;
const MAX_RELEVANCE_CHECKS = parseInt(process.env.MAX_RELEVANCE_CHECKS, 10) || 5;
const PROCESSED_FILE = './assets/processedArticles.json';

const store = createArrayStore(PROCESSED_FILE);

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
    logger.error('Error parsing OPML', { error: error.message });
  }
};

const fetchArticles = async (feeds) => {
  const parser = new RSSParser();
  const allArticles = [];

  for (const feed of feeds) {
    try {
      const parsedFeed = await parser.parseURL(feed);
      allArticles.push(...parsedFeed.items);
    } catch (error) {
      logger.warn(`Error fetching articles from ${feed}`, { error: error.message });
    }
  }

  return allArticles;
};

const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const run = async ({ dryMode, lang }) => {
  await runContentJob(
    {
      name: 'news article',
      source: 'news article',
      topicId: process.env.TELEGRAM_TOPIC_NEWS,
      maxItems: NB_ARTICLES_TO_SEND,
      maxCandidates: MAX_RELEVANCE_CHECKS,
      delayBetweenItems: DELAY_BETWEEN_ARTICLES,

      cleanup: () => cleanProcessedData(NB_DAYS_TO_FETCH, PROCESSED_FILE),

      async fetchItems() {
        const feeds = await parseOPML('./assets/CyberSecurityRSS.opml');
        const articles = await fetchArticles(feeds);
        logger.info(`Fetched a total of ${articles.length} articles.`);

        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - NB_DAYS_TO_FETCH);

        return articles
          .filter((article) => new Date(article.pubDate) >= daysAgo)
          .map((article) => ({
            title: article.title,
            content: article.content,
            link: article.link,
            categories: article.categories,
          }));
      },

      async filterNew(items) {
        const processedArticles = await store.load();
        const processedUrls = new Set(processedArticles.map((a) => a.url));
        const unprocessed = items.filter((item) => !processedUrls.has(item.link));
        logger.info(`Found ${unprocessed.length} recent articles from the past ${NB_DAYS_TO_FETCH} days.`);
        return shuffleArray(unprocessed);
      },

      createPrompt(item, lng) {
        const categories =
          item.categories && Array.isArray(item.categories)
            ? item.categories.map((cat) => cat?.toString?.() || '').filter(Boolean)
            : [];
        return createNewsResumePrompt(item.title, categories, item.link, item.content, lng);
      },

      async saveProcessed(item) {
        await store.save({ url: item.link });
      },

      async send(summary, item) {
        const categories =
          item.categories && Array.isArray(item.categories)
            ? item.categories.map((cat) => cat?.toString?.() || '').filter(Boolean)
            : [];
        await sendMessage(summary, process.env.TELEGRAM_TOPIC_NEWS, categories);
      },
    },
    { dryMode, lang }
  );
};

module.exports = { run };
