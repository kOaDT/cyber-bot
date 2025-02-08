const { onError } = require('./config/errors');
const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');

const run = async (dryMode) => {
  try {
    const message = "🎯 Hey ! Il est temps de s'entraîner sur TryHackMe !";

    if (dryMode) {
      logger.info(`Would send Telegram message: ${message}`);
      return;
    }

    await sendMessage(message);
    logger.info('Message sent successfully');
  } catch (err) {
    onError(err, 'run');
  }
};

module.exports = { run };
