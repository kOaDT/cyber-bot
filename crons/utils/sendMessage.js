const logger = require('../config/logger');
const TelegramBot = require('node-telegram-bot-api');
const pool = require('../utils/database');

const db = pool.promise();

const MAX_MESSAGE_LENGTH = 4096;
const isDb = process.env.I_WANT_TO_SAVE_MESSAGES_IN_DB === 'true';

const ALLOWED_TAGS = new Set(['b', 'i', 'u', 's', 'code', 'pre', 'a', 'tg-spoiler', 'blockquote']);
const TAG_REGEX = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^>]*)?)\s*>/g;

const escapeTextForTelegram = (text) => {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const sanitizeTelegramHtml = (html) => {
  if (!html || typeof html !== 'string') return '';

  let result = html.replace(TAG_REGEX, (match, tag) => {
    return ALLOWED_TAGS.has(tag.toLowerCase()) ? match : '';
  });

  const stack = [];
  const output = [];
  const tokens = result.split(/(<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s+[^>]*)?\s*>)/g);

  for (const token of tokens) {
    const openMatch = token.match(/^<([a-zA-Z][a-zA-Z0-9-]*)(\s+[^>]*)?\s*>$/);
    const closeMatch = token.match(/^<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>$/);

    if (openMatch) {
      const tag = openMatch[1].toLowerCase();
      if (ALLOWED_TAGS.has(tag)) {
        stack.push(tag);
        output.push(token);
      }
    } else if (closeMatch) {
      const tag = closeMatch[1].toLowerCase();
      const idx = stack.lastIndexOf(tag);
      if (idx !== -1) {
        for (let i = stack.length - 1; i > idx; i--) {
          output.push(`</${stack[i]}>`);
        }
        output.push(`</${tag}>`);
        stack.splice(idx);
      }
    } else {
      output.push(escapeTextForTelegram(token));
    }
  }

  for (let i = stack.length - 1; i >= 0; i--) {
    output.push(`</${stack[i]}>`);
  }

  return output.join('');
};

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

/**
 * Sends a message to Telegram and logs it to the database
 * @param {string} message - The message to send
 * @param {number} topicId - The topic ID to send the message to
 * @param {string[]} categories - The categories of the message
 * @param {object} sendOptions - Additional options for sending the message
 * @param {string} sendOptions.parse_mode - The parse mode for the message (HTML, MarkdownV2)
 * @returns {Promise<void>} - A promise that resolves when the message is sent and logged
 */
const sendMessage = async (message, topicId = null, categories = null, sendOptions = {}) => {
  try {
    const options = {
      ...(topicId && { message_thread_id: topicId }),
      ...sendOptions,
    };

    const messageChunks = [];
    let currentChunk = '';
    const lines = message.split('\n');

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 <= MAX_MESSAGE_LENGTH) {
        currentChunk += (currentChunk ? '\n' : '') + line;
      } else {
        if (currentChunk) messageChunks.push(currentChunk);
        currentChunk = line;
      }
    }
    if (currentChunk) messageChunks.push(currentChunk);

    for (const chunk of messageChunks) {
      await bot.sendMessage(process.env.CHAT_ID, chunk, options);
    }
    logger.info('Message sent successfully');
  } catch (err) {
    logger.error('Error sending message', { error: err.message });
  }

  if (isDb) {
    try {
      await saveMessageInDb(message, topicId, categories);
    } catch (dbError) {
      logger.warn('Failed to save message in database', { error: dbError.message });
    }
  }
};

/**
 * Saves a message to the database
 * @param {string} message - The message to save
 * @param {number} topicId - The topic ID to save the message to
 * @param {string[]} categories - The categories of the message
 * @returns {Promise<void>} - A promise that resolves when the message is saved
 */
const saveMessageInDb = async (message, topicId = null, categories = null) => {
  const categoriesString = categories ? categories.join(',') : null;
  const [result] = await db.execute(
    'INSERT INTO TelegramLogs (message, categories, topicId, dateAdd) VALUES (?, ?, ?, NOW())',
    [message, categoriesString, topicId]
  );
  return result;
};

module.exports = { sendMessage, sanitizeTelegramHtml };
