const logger = require('./config/logger');
const { createRedditPrompt } = require('./utils/prompts');
const { createArrayStore } = require('./utils/processedItems');
const { cleanProcessedData } = require('./utils/cleanJsonFile');
const { runContentJob } = require('./utils/contentRunner');

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
  await runContentJob(
    {
      name: 'Reddit post',
      source: 'Reddit post',
      topicId: process.env.TELEGRAM_TOPIC_REDDIT,
      maxItems: 1,
      maxCandidates: MAX_RELEVANCE_CHECKS,

      cleanup: () => cleanProcessedData(DAYS, PROCESSED_FILE),

      async fetchItems() {
        let allPosts = [];
        for (const subreddit of SUBREDDITS) {
          const posts = await fetchSubredditPosts(subreddit, DAYS);
          allPosts = allPosts.concat(posts);
        }
        logger.info(`Fetched ${allPosts.length} total posts`);
        return allPosts;
      },

      async filterNew(items) {
        const processedPosts = await store.load();
        const processedIds = new Set(processedPosts.map((post) => post.id));
        return items.filter((post) => !processedIds.has(post.id)).sort((a, b) => b.score - a.score);
      },

      createPrompt(item, lng) {
        return createRedditPrompt(item.title, item.content, item.url, lng);
      },

      async saveProcessed(item) {
        await store.save({ id: item.id });
      },
    },
    { dryMode, lang }
  );
};

module.exports = { run };
