const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const { generate } = require('./utils/generate');
const { createRedditPrompt } = require('./utils/prompts');
const { evaluateRelevance } = require('./utils/relevance');
const { createArrayStore } = require('./utils/processedItems');
const { cleanProcessedData } = require('./utils/cleanJsonFile');

const PROCESSED_FILE = './assets/processedReddit.json';
const DAYS = process.env.REDDIT_DAYS_LOOKBACK || 3;
const MAX_RELEVANCE_CHECKS = 5;
const DEFAULT_SUBREDDITS = ['netsec', 'cybersecurity', 'securityCTF', 'blackhat', 'HowToHack'];
const SUBREDDITS = process.env.REDDIT_SUBREDDITS ? process.env.REDDIT_SUBREDDITS.split(',') : DEFAULT_SUBREDDITS;
const ARCTIC_SHIFT_BASE = 'https://arctic-shift.photon-reddit.com/api/posts/search';

const store = createArrayStore(PROCESSED_FILE);

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

const run = async ({ dryMode, lang } = {}) => {
  try {
    await cleanProcessedData(DAYS, PROCESSED_FILE);

    let allPosts = [];
    for (const subreddit of SUBREDDITS) {
      const posts = await fetchSubredditPosts(subreddit, DAYS);
      allPosts = allPosts.concat(posts);
    }

    logger.info(`Fetched ${allPosts.length} total posts`);

    const processedPosts = await store.load();
    const processedIds = new Set(processedPosts.map((post) => post.id));

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

      await store.save({ id: post.id });
    }

    if (!selectedPost) {
      return logger.info('No relevant Reddit posts found after relevance checks');
    }

    const prompt = createRedditPrompt(selectedPost.title, selectedPost.content, selectedPost.url, lang);
    const summary = await generate(prompt);

    await store.save({ id: selectedPost.id });

    if (dryMode) {
      logger.info('Dry mode: No message sent', { summary });
      return;
    }

    await sendMessage(summary, process.env.TELEGRAM_TOPIC_REDDIT);
    logger.info('Successfully sent Reddit post', { id: selectedPost.id });
  } catch (error) {
    logger.error('Error sending Reddit post', { error: error.message });
  }
};

module.exports = { run };
