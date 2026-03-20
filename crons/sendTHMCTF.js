/* eslint-disable max-len */
const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const { generate } = require('./utils/generate');
const { createArrayStore } = require('./utils/processedItems');
const { translatePrompt } = require('./utils/prompts');

const store = createArrayStore('assets/processedCTF.json');

const getLastCTF = async () => {
  try {
    const processedCTFs = await store.load();
    const processedCodes = new Set(processedCTFs.map((item) => item.code || item));
    let page = 1;

    while (true) {
      const response = await fetch(
        `https://tryhackme.com/api/v2/hacktivities/extended-search?kind=rooms&difficulty=all&order=most-popular&roomType=challenge&povTagFilter=all&page=${page}`
      );
      const data = await response.json();

      if (data.status !== 'success' || !data.data.docs.length) {
        logger.info(`No more challenges found on page ${page}`);
        return null;
      }

      const newChallenge = data.data.docs.find((room) => !processedCodes.has(room.code));

      if (newChallenge) {
        await store.save({ code: newChallenge.code });
        return {
          title: newChallenge.title,
          description: newChallenge.description,
          url: `https://tryhackme.com/room/${newChallenge.code}`,
          difficulty: newChallenge.difficulty,
          tags: newChallenge.tagDocs.map((tag) => tag.label).join(', '),
        };
      }

      page++;
      logger.info(`Moving to page ${page}`);
    }
  } catch (error) {
    logger.error('Error fetching challenges', { error: error.message });
    throw error;
  }
};

const run = async ({ dryMode, lang }) => {
  try {
    const newChallenge = await getLastCTF();

    if (!newChallenge) {
      logger.info('No new challenges found');
      return;
    }

    logger.info('New challenge found', { title: newChallenge.title });

    const difficultyEmoji = {
      easy: '🟢',
      medium: '🟡',
      hard: '🔴',
    };

    let message =
      `🎯 Nouveau challenge TryHackMe !\n\n` +
      `${newChallenge.title}\n` +
      `${difficultyEmoji[newChallenge.difficulty]} Difficulté: ${newChallenge.difficulty}\n\n` +
      `📝 Description\n${newChallenge.description}\n\n` +
      `🏷️ Tags\n${newChallenge.tags || 'Aucun tag'}\n\n` +
      `🔗 Commencer le challenge : ${newChallenge.url}`;

    if (lang !== 'french') {
      const translatedMessage = translatePrompt(message, lang);
      message = await generate(translatedMessage);
    }

    if (dryMode) {
      logger.info('Dry mode: No message sent', { message });
      return;
    }

    await sendMessage(message, process.env.TELEGRAM_TOPIC_THM);
  } catch (error) {
    logger.error('Error sending THM CTF', { error: error.message });
  }
};

module.exports = { run };
