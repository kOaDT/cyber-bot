const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const { generate } = require('./utils/generate');
const { createRedditPrompt } = require('./utils/prompts');
const { evaluateRelevance } = require('./utils/relevance');
const fs = require('fs').promises;
const { cleanProcessedData } = require('./utils/cleanJsonFile');

const PROCESSED_FILE = './assets/processedReddit.json';
const DAYS = process.env.REDDIT_DAYS_LOOKBACK || 3;
const MAX_RELEVANCE_CHECKS = 5;
const DEFAULT_SUBREDDITS = ['netsec', 'cybersecurity', 'securityCTF', 'blackhat', 'HowToHack'];
const SUBREDDITS = process.env.REDDIT_SUBREDDITS ? process.env.REDDIT_SUBREDDITS.split(',') : DEFAULT_SUBREDDITS;
const ARCTIC_SHIFT_BASE = 'https://arctic-shift.photon-reddit.com/api/posts/search';

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
 * Fetches posts from a subreddit via the Arctic Shift API.
 *
 * @param {string} subreddit - The subreddit name to fetch from
 * @param {number} daysLookBack - Number of days to look back
 * @returns {Promise<Array>} Array of posts
 */
const fetchSubredditPosts = async (subreddit, daysLookBack) => {
  try {
    const url = `${ARCTIC_SHIFT_BASE}?subreddit=${subreddit}&after=${daysLookBack}d&limit=100&sort=desc`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const { data } = await response.json();

    return data
      .filter((post) => !post.removed_by_category && post.selftext !== '[removed]')
      .map((post) => ({
        id: post.id,
        title: post.title,
        url: `https://reddit.com${post.permalink}`,
        score: post.score,
        content: post.selftext || post.url,
        created: post.created_utc,
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
  try {
    await cleanProcessedData(DAYS, PROCESSED_FILE);

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
  }
};

module.exports = { run };
