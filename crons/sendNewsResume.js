const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const { randomInt } = require('node:crypto');
const { generate } = require('./utils/generate');
const { createNewsResumePrompt } = require('./utils/prompts');
const { evaluateRelevance } = require('./utils/relevance');
const { createArrayStore } = require('./utils/processedItems');
const { cleanProcessedData } = require('./utils/cleanJsonFile');
const fs = require('fs').promises;
const xml2js = require('xml2js');
const RSSParser = require('rss-parser');
const { delay } = require('./utils/delay');

const NB_DAYS_TO_FETCH = 3;
const NB_ARTICLES_TO_SEND = 1;
const DELAY_BETWEEN_ARTICLES = 10000;
const MAX_RELEVANCE_CHECKS = 5;
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

const filterRecentArticles = async (articles) => {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - NB_DAYS_TO_FETCH);

  const processedArticles = await store.load();
  const processedUrls = new Set(processedArticles.map((article) => article.url));

  return articles.filter((article) => {
    const pubDate = new Date(article.pubDate);
    return pubDate >= daysAgo && !processedUrls.has(article.link);
  });
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
  try {
    await cleanProcessedData(NB_DAYS_TO_FETCH, PROCESSED_FILE);

    const feeds = await parseOPML('./assets/CyberSecurityRSS.opml');
    const articles = await fetchArticles(feeds);
    logger.info(`Fetched a total of ${articles.length} articles.`);

    const recentArticles = await filterRecentArticles(articles);
    logger.info(`Found ${recentArticles.length} recent articles from the past ${NB_DAYS_TO_FETCH} days.`);

    if (recentArticles.length === 0) {
      logger.info('No recent articles found to display.');
      return;
    }

    const shuffledArticles = shuffleArray(recentArticles);
    let articlesSent = 0;
    let relevanceChecks = 0;

    for (const article of shuffledArticles) {
      if (articlesSent >= NB_ARTICLES_TO_SEND) break;
      if (relevanceChecks >= MAX_RELEVANCE_CHECKS) {
        logger.info('Max relevance checks reached, stopping');
        break;
      }

      const { relevant } = await evaluateRelevance({
        title: article.title,
        content: article.content,
        source: 'news article',
      });
      relevanceChecks++;

      if (!relevant) {
        await store.save({ url: article.link });
        continue;
      }

      const categories =
        article.categories && Array.isArray(article.categories)
          ? article.categories.map((cat) => cat?.toString?.() || '').filter(Boolean)
          : [];

      const prompt = createNewsResumePrompt(article.title, categories, article.link, article.content, lang);
      const newsResume = await generate(prompt);

      await store.save({ url: article.link });

      if (dryMode) {
        logger.info('Dry mode: No message sent', { newsResume });
      } else {
        await sendMessage(newsResume, process.env.TELEGRAM_TOPIC_NEWS, categories);
      }
      articlesSent++;

      if (articlesSent < NB_ARTICLES_TO_SEND) {
        await delay(DELAY_BETWEEN_ARTICLES);
      }
    }

    if (articlesSent === 0) {
      return logger.info('No relevant articles found after relevance checks.');
    }
    return logger.info('News resume sent successfully.');
  } catch (error) {
    logger.error('Error sending news resume', { error: error.message });
  }
};

module.exports = { run };
