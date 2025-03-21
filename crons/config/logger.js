const { createLogger, format, transports } = require('winston');
const { combine, timestamp, colorize, printf, errors } = format;

const myFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let formattedMessage = message;

  if (typeof message === 'object' && message !== null) {
    if (message instanceof Error) {
      formattedMessage = `${message.message} - ${message.stack || ''}`;
    } else {
      try {
        formattedMessage = JSON.stringify(message, null, 2);
      } catch (e) {
        console.error(e);
        formattedMessage = '[Objet non sérialisable]';
      }
    }
  }

  let metadataStr = '';
  if (Object.keys(metadata).length > 0 && metadata.stack === undefined) {
    try {
      metadataStr = ` | ${JSON.stringify(metadata, null, 2)}`;
    } catch (e) {
      metadataStr = ' | [Métadonnées non sérialisables]';
    }
  }

  return `${timestamp} ${level}: ${formattedMessage}${metadataStr}`;
});

const loggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    errors({ stack: true }),
    myFormat
  ),
  transports: [
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  exitOnError: false,
};

const logger = createLogger(loggerOptions);

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: combine(
        timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        colorize(),
        myFormat
      ),
    })
  );
}

logger.object = (obj, level = 'info', message = '') => {
  logger.log(level, message, obj);
};

logger.error = (message, meta = null) => {
  if (message instanceof Error) {
    const { message: msg, stack, ...rest } = message;
    logger.log('error', msg, { ...rest, stack });
  } else if (meta !== null) {
    logger.log('error', message, meta);
  } else {
    logger.log('error', message);
  }
};

module.exports = logger;
