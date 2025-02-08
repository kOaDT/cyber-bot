const { onError } = require('../config/errors');
const logger = require('../config/logger');
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

/**
 * Sends a message to Telegram and logs it to the database
 * @param {string} message - The message to send
 * @returns {Promise<void>} - A promise that resolves when the message is sent and logged
 */
const sendMessage = async (message) => {
  try {
    await bot.sendMessage(process.env.CHAT_ID, message);
    logger.info('Message sent successfully');
  } catch (err) {
    onError(err, 'run');
  }
};

module.exports = { sendMessage };
