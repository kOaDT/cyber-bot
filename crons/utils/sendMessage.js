const { onError } = require('../config/errors');
const logger = require('../config/logger');
const TelegramBot = require('node-telegram-bot-api');

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
};

module.exports = { sendMessage };
