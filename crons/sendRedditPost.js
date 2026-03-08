const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const { generate } = require('./utils/generate');
const { createRedditPrompt } = require('./utils/prompts');
const { evaluateRelevance } = require('./utils/relevance');
const fs = require('fs').promises;
const { cleanProcessedData } = require('./utils/cleanJsonFile');
const { BrowserManager } = require('./utils/puppeteerUtils');

const PROCESSED_FILE = './assets/processedReddit.json';
const DAYS = process.env.REDDIT_DAYS_LOOKBACK || 3;
const MAX_RELEVANCE_CHECKS = 5;
const DEFAULT_SUBREDDITS = ['netsec', 'cybersecurity', 'securityCTF', 'blackhat', 'HowToHack'];
const SUBREDDITS = process.env.REDDIT_SUBREDDITS ? process.env.REDDIT_SUBREDDITS.split(',') : DEFAULT_SUBREDDITS;

/**
 * Loads the list of processed Reddit posts from the JSON file.
 *
 * @returns {Promise<string[]>} Array of processed post IDs
 */
const loadProcessedPosts = async () => {
  try {
    const data = await fs.readFile(PROCESSED_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.warn('Could not read processed posts file', { error: error.message });
    return [];
  }
};

/**
 * Saves a processed post ID to the JSON file.
 *
 * @param {string} postId - The Reddit post ID to save
 */
const saveProcessedPost = async (postId) => {
  try {
    let processedPosts = [];
    try {
      const fileContent = await fs.readFile(PROCESSED_FILE, 'utf8');
      processedPosts = JSON.parse(fileContent);
    } catch (error) {
      logger.warn('Could not read existing data, starting fresh', { error: error.message });
    }

    processedPosts.push({
      id: postId,
      processedAt: new Date().toISOString(),
    });

    await fs.writeFile(PROCESSED_FILE, JSON.stringify(processedPosts, null, 2));
  } catch (error) {
    logger.error('Error saving processed post', { error: error.message });
  }
};

/**
 * Fetches posts from a subreddit using in-browser fetch via Puppeteer.
 *
 * @param {import('puppeteer').Page} page - Puppeteer page instance (on reddit.com origin)
 * @param {string} subreddit - The subreddit name to fetch from
 * @param {number} daysLookBack - Number of days to look back
 * @returns {Promise<Array>} Array of filtered posts
 */
const fetchSubredditPosts = async (page, subreddit, daysLookBack) => {
  try {
    const result = await page.evaluate(async (sub) => {
      const resp = await fetch(`/r/${sub}/top.json?t=week&limit=100`);
      if (!resp.ok) return { error: resp.status };
      return { data: await resp.json() };
    }, subreddit);

    if (result.error) {
      throw new Error(`HTTP error! status: ${result.error}`);
    }

    const cutoffTime = Date.now() / 1000 - daysLookBack * 24 * 60 * 60;

    return result.data.data.children
      .filter((post) => post.data.created_utc > cutoffTime)
      .map((post) => ({
        id: post.data.id,
        title: post.data.title,
        url: `https://reddit.com${post.data.permalink}`,
        score: post.data.score,
        content: post.data.selftext || post.data.url,
        created: post.data.created_utc,
      }));
  } catch (error) {
    logger.error(`Error fetching r/${subreddit}`, { error: error.message });
    return [];
  }
};

/**
 * Main execution function for the Reddit post cron job.
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.dryMode - Whether to run in dry mode
 * @param {string} options.lang - Language for the summary
 */
const run = async ({ dryMode, lang } = {}) => {
  const browser = new BrowserManager();
  try {
    await cleanProcessedData(DAYS, PROCESSED_FILE);
    await browser.init();

    // Navigate to reddit.com to establish origin and cookies for same-origin fetches
    await browser.page.goto('https://www.reddit.com', { waitUntil: 'domcontentloaded' });

    let allPosts = [];
    for (const subreddit of SUBREDDITS) {
      const posts = await fetchSubredditPosts(browser.page, subreddit, DAYS);
      allPosts = allPosts.concat(posts);
    }

    logger.info(`Fetched ${allPosts.length} total posts`);

    const processedPosts = await loadProcessedPosts();
    const processedIds = new Set(processedPosts.map((post) => post.id));

    // Filter out processed posts and sort by score
    const unprocessedPosts = allPosts.filter((post) => !processedIds.has(post.id)).sort((a, b) => b.score - a.score);

    if (unprocessedPosts.length === 0) {
      return logger.info('No new posts to process');
    }

    const candidates = unprocessedPosts.slice(0, MAX_RELEVANCE_CHECKS);
    let selectedPost = null;

    for (const post of candidates) {
      const { relevant } = await evaluateRelevance({
        title: post.title,
        content: post.content,
        source: 'Reddit post',
      });

      if (relevant) {
        selectedPost = post;
        break;
      }

      await saveProcessedPost(post.id);
    }

    if (!selectedPost) {
      return logger.info('No relevant Reddit posts found after relevance checks');
    }

    const prompt = createRedditPrompt(selectedPost.title, selectedPost.content, selectedPost.url, lang);
    const summary = await generate(prompt);

    if (dryMode) {
      logger.info(`Would send Telegram message`, { summary });
      await saveProcessedPost(selectedPost.id);
      return;
    }

    await sendMessage(summary, process.env.TELEGRAM_TOPIC_REDDIT);
    await saveProcessedPost(selectedPost.id);

    logger.info(`Successfully sent Reddit post`, { id: selectedPost.id });
  } catch (error) {
    logger.error('Error sending Reddit post', { error: error.message });
  } finally {
    await browser.close();
  }
};

module.exports = { run };
