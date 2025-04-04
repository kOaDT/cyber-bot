const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const { translatePrompt } = require('./utils/prompts');
const { generate } = require('./utils/generate');

const run = async ({ dryMode, lang }) => {
  try {
    let message = "🎯 Hey ! Il est temps de s'entraîner sur TryHackMe !";

    if (lang !== 'french') {
      const translatedMessage = translatePrompt(message, lang);
      message = await generate(translatedMessage);
    }

    if (dryMode) {
      logger.info(`Would send Telegram message`, { message });
      return;
    }

    await sendMessage(message, process.env.TELEGRAM_TOPIC_THM);
    logger.info('Message sent successfully');
  } catch (err) {
    logger.error('Error sending THM', { error: err.message });
  }
};

module.exports = { run };
