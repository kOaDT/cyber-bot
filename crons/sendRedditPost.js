 
const { onError } = require('./config/errors');
const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const { generate } = require('./utils/generate');
const { createRedditPrompt } = require('./utils/prompts');
const fs = require('fs').promises;
const { cleanProcessedData } = require('./utils/cleanJsonFile');

const PROCESSED_FILE = './assets/processedReddit.json';
const DAYS = process.env.REDDIT_DAYS_LOOKBACK || 3;
const SUBREDDITS = process.env.REDDIT_SUBREDDITS.split(',') || [
  'netsec',
  'cybersecurity',
  'securityCTF',
  'blackhat',
  'HowToHack',
];

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
    logger.warn('Could not read processed posts file:', error.message);
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
      logger.warn('Could not read existing data, starting fresh:', error.message);
    }

    processedPosts.push({
      id: postId,
      processedAt: new Date().toISOString(),
    });

    await fs.writeFile(PROCESSED_FILE, JSON.stringify(processedPosts, null, 2));
  } catch (error) {
    onError(error, 'saveProcessedPost');
  }
};

/**
 * Fetches posts from a subreddit within the specified timeframe.
 *
 * @param {string} subreddit - The subreddit name to fetch from
 * @param {number} daysLookBack - Number of days to look back
 * @returns {Promise<Array>} Array of filtered posts
 */
const fetchSubredditPosts = async (subreddit, daysLookBack) => {
  try {
    const response = await fetch(`https://www.reddit.com/r/${subreddit}/top.json?t=week&limit=100`);
    if (!response.ok) {
      throw new Error(`Failed to fetch from r/${subreddit}: ${response.statusText}`);
    }

    const data = await response.json();
    const cutoffTime = Date.now() / 1000 - daysLookBack * 24 * 60 * 60;

    return data.data.children
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
    onError(error, `fetchSubredditPosts ${subreddit}`);
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
  try {
    await cleanProcessedData(DAYS, PROCESSED_FILE);

    logger.info(`Fetching posts from ${SUBREDDITS.length} subreddits...`);

    let allPosts = [];
    for (const subreddit of SUBREDDITS) {
      const posts = await fetchSubredditPosts(subreddit, DAYS);
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

    const bestPost = unprocessedPosts[0];
    const prompt = createRedditPrompt(bestPost.title, bestPost.content, bestPost.url, lang);
    const summary = await generate(prompt);

    if (dryMode) {
      logger.info(summary);
      await saveProcessedPost(bestPost.id);
      return;
    }

    await sendMessage(summary, process.env.TELEGRAM_TOPIC_REDDIT);
    await saveProcessedPost(bestPost.id);

    logger.info(`Successfully sent Reddit post: ${bestPost.id}`);
  } catch (error) {
    onError(error, 'run');
  }
};

module.exports = { run };
