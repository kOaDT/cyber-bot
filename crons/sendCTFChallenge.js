const logger = require('./config/logger');
const { sendMessage, sanitizeTelegramHtml } = require('./utils/sendMessage');
const { generate } = require('./utils/generate');
const { createObjectStore } = require('./utils/processedItems');
const { translatePrompt } = require('./utils/prompts');

const FEED_URL = process.env.OSS_STORE_FEED_URL || 'https://koadt.github.io/oss-oopssec-store/challenges.json';
const SUPPORTED_FEED_VERSION = 1;
const REPO_URL = 'https://github.com/kOaDT/oss-oopssec-store';
const INSTALL_COMMAND = 'npx create-oss-store my-ctf-lab';
const STATE_PATH = 'assets/ctfChallenge.json';

const store = createObjectStore(STATE_PATH, { lastChallengeNumber: 0 });

const DIFFICULTIES = {
  EASY: { emoji: '🟢', label: 'Easy' },
  MEDIUM: { emoji: '🟡', label: 'Medium' },
  HARD: { emoji: '🔴', label: 'Hard' },
};

const fetchFeed = async () => {
  const response = await fetch(FEED_URL);

  if (!response.ok) {
    throw new Error(`Challenge feed responded with ${response.status}`);
  }

  const feed = await response.json();

  if (feed.version !== SUPPORTED_FEED_VERSION) {
    throw new Error(`Unsupported challenge feed version ${feed.version}, expected ${SUPPORTED_FEED_VERSION}`);
  }

  if (!Array.isArray(feed.challenges) || feed.challenges.length === 0) {
    throw new Error('Challenge feed contains no challenge');
  }

  return feed;
};

/**
 * Next challenge in curriculum order, wrapping back to the first one once the
 * curriculum has been posted in full.
 * @param {object[]} challenges - The challenges from the feed
 * @param {number} lastChallengeNumber - Number of the challenge posted last
 * @returns {object} The challenge to post
 */
const selectChallenge = (challenges, lastChallengeNumber) => {
  const ordered = [...challenges].sort((a, b) => a.number - b.number);
  return ordered.find((challenge) => challenge.number > lastChallengeNumber) || ordered[0];
};

const formatCategory = (category) =>
  category
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const formatDuration = ({ min, max }) => (max ? `${min}–${max} min` : `${min}+ min`);

const formatPrerequisites = (prerequisites, challenges) =>
  prerequisites
    .map((number) => {
      const prerequisite = challenges.find((challenge) => challenge.number === number);
      return prerequisite ? `${prerequisite.title} (#${number})` : `#${number}`;
    })
    .join(', ');

const buildMessage = (challenge, feed) => {
  const difficulty = DIFFICULTIES[challenge.difficulty] || { emoji: '⚪', label: challenge.difficulty };
  const summary = challenge.walkthrough ? challenge.walkthrough.description : challenge.chapter.tagline;
  const metadata = [
    `${difficulty.emoji} ${difficulty.label}`,
    formatCategory(challenge.category),
    formatDuration(challenge.estimatedMinutes),
  ].join(' · ');

  const lines = [
    `🎯 <b>Challenge ${challenge.number}/${feed.totalChallenges}</b> · ${challenge.chapter.title}`,
    '',
    `<b>${challenge.title}</b>`,
    metadata,
    '',
    summary,
  ];

  if (challenge.prerequisites.length > 0) {
    lines.push('', `🧩 Builds on ${formatPrerequisites(challenge.prerequisites, feed.challenges)}`);
  }

  lines.push('', '<b>Spin up the lab</b>', `<code>${INSTALL_COMMAND}</code>`, '');
  lines.push(`🗺 <a href="${challenge.url}">See it on the roadmap</a>`);

  if (challenge.walkthrough) {
    lines.push(`📖 <a href="${challenge.walkthrough.url}">Walkthrough</a> — spoilers, read it once you are stuck`);
  }

  lines.push(`⭐ <a href="${REPO_URL}">Star OopsSec Store on GitHub</a>`);

  return lines.join('\n');
};

const run = async ({ dryMode, lang }) => {
  const feed = await fetchFeed();
  const { lastChallengeNumber } = await store.load();
  const challenge = selectChallenge(feed.challenges, lastChallengeNumber);

  logger.info('Challenge selected', { number: challenge.number, title: challenge.title });

  let message = buildMessage(challenge, feed);

  if (lang !== 'english') {
    const translated = await generate(translatePrompt(message, lang, { preserveTelegramHtml: true }));
    if (translated) {
      message = translated;
    } else {
      logger.warn('Translation failed, falling back to the English message', { lang });
    }
  }

  message = sanitizeTelegramHtml(message);

  if (dryMode) {
    logger.info('Dry mode: No message sent', { message });
    return;
  }

  await sendMessage(message, process.env.TELEGRAM_TOPIC_CTF, ['ctf'], { parse_mode: 'HTML' });
  await store.save({ lastChallengeNumber: challenge.number });
};

module.exports = { run, _selectChallenge: selectChallenge, _buildMessage: buildMessage };
