const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const { generate } = require('./utils/generate');
const { createRedditPrompt } = require('./utils/prompts');
const { evaluateRelevance } = require('./utils/relevance');
const fs = require('fs').promises;
const cheerio = require('cheerio');
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
 * Fetches posts from a subreddit by scraping old.reddit.com.
 *
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {string} subreddit - The subreddit name to fetch from
 * @param {number} daysLookBack - Number of days to look back
 * @returns {Promise<Array>} Array of filtered posts
 */
const fetchSubredditPosts = async (page, subreddit, daysLookBack) => {
  try {
    await page.goto(`https://old.reddit.com/r/${subreddit}/top/?t=week&limit=100`, {
      waitUntil: 'domcontentloaded',
    });
    const html = await page.content();
    const $ = cheerio.load(html);
    const cutoffTime = Date.now() - daysLookBack * 24 * 60 * 60 * 1000;

    const posts = [];
    $('#siteTable .thing.link').each((_, el) => {
      const $el = $(el);
      const timestamp = parseInt($el.attr('data-timestamp'), 10);
      if (!timestamp || timestamp < cutoffTime) return;

      const fullname = $el.attr('data-fullname') || '';
      const id = fullname.replace('t3_', '');
      const title = $el.find('a.title').first().text().trim();
      const commentLink = $el.find('a.comments').attr('href') || '';
      const scoreText = $el.find('.score.unvoted').text().trim();
      const score = parseInt(scoreText, 10) || 0;
      const dataUrl = $el.attr('data-url') || '';
      const domain = $el.attr('data-domain') || '';

      posts.push({
        id,
        title,
        url: commentLink.startsWith('http') ? commentLink : `https://reddit.com${commentLink}`,
        score,
        content: domain.startsWith('self.') ? title : dataUrl || title,
        created: timestamp / 1000,
      });
    });

    return posts;
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
