/* eslint-disable max-len */
const { onError } = require('./config/errors');
const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const { generate } = require('./utils/generate');
const fs = require('fs').promises;
const { translatePrompt } = require('./utils/prompts');

/**
 * Get the last processed CTFs
 * @returns {Array} Array of processed CTF codes
 */
const getProcessedCTFs = async () => {
  try {
    const data = await fs.readFile('assets/processedCTF.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.warn('No processed CTFs found, creating new file:', error.message);
    await fs.writeFile('assets/processedCTF.json', JSON.stringify([]));
    return [];
  }
};

/**
 * Save processed CTF
 * @param {string} ctfCode - The CTF code to save
 */
const saveProcessedCTF = async (ctfCode) => {
  const processed = await getProcessedCTFs();
  processed.push(ctfCode);
  await fs.writeFile('assets/processedCTF.json', JSON.stringify(processed));
};

/**
 * Get the first unprocessed CTF from TryHackMe
 * @returns {Object} The first unprocessed CTF or null if none found
 */
const getLastCTF = async () => {
  try {
    const processedCTFs = await getProcessedCTFs();
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

      const newChallenge = data.data.docs.find((room) => !processedCTFs.includes(room.code));

      if (newChallenge) {
        await saveProcessedCTF(newChallenge.code);
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
    logger.error('Error fetching challenges:', error);
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

    logger.info(`New challenge found: ${newChallenge.title}`);

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

    if (!dryMode) {
      if (lang !== 'french') {
        const translatedMessage = translatePrompt(message, lang);
        message = await generate(translatedMessage);
      }

      await sendMessage(message, process.env.TELEGRAM_TOPIC_THM);
    } else {
      logger.info('Dry mode: No message sent');
      logger.info(message);
    }
  } catch (error) {
    onError(error, 'Error processing CTF');
  }
};

module.exports = { run };
