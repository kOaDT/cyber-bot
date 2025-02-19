const { onError } = require('../config/errors');
const logger = require('../config/logger');
const TelegramBot = require('node-telegram-bot-api');
const pool = require('../utils/database');

const db = pool.promise();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

/**
 * Sends a message to Telegram and logs it to the database
 * @param {string} message - The message to send
 * @param {number} topicId - The topic ID to send the message to
 * @returns {Promise<void>} - A promise that resolves when the message is sent and logged
 */
const sendMessage = async (message, topicId = null) => {
  try {
    const options = topicId ? { message_thread_id: topicId } : {};
    await bot.sendMessage(process.env.CHAT_ID, message, options);
    logger.info('Message sent successfully');
  } catch (err) {
    onError(err, 'run');
  }

  try {
    await saveMessageInDb(message, topicId);
  } catch (dbError) {
    logger.warn('Failed to save message in database:', dbError.message);
  }
};

/**
 * Saves a message to the database
 * @param {string} message - The message to save
 * @param {number} topicId - The topic ID to save the message to
 * @returns {Promise<void>} - A promise that resolves when the message is saved
 */
const saveMessageInDb = async (message, topicId = null) => {
  const [result] = await db.execute('INSERT INTO TelegramLogs (message, topicId, dateAdd) VALUES (?, ?, NOW())', [
    message,
    topicId,
  ]);
  return result;
};

module.exports = { sendMessage };
