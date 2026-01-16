const { createLogger, format, transports } = require('winston');
const Transport = require('winston-transport');
const https = require('https');
const { URL } = require('url');
const { combine, timestamp, colorize, printf, errors } = format;

// Custom format for log messages
const myFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let formattedMessage = message;

  // Handle different message types
  if (typeof message === 'object' && message !== null) {
    if (message instanceof Error) {
      formattedMessage = `${message.message} - ${message.stack || ''}`;
    } else {
      try {
        formattedMessage = JSON.stringify(message, null, 2);
      } catch {
        formattedMessage = '[Non-serializable object]';
      }
    }
  }

  // Format metadata
  let metadataStr = '';
  if (Object.keys(metadata).length > 0 && metadata.stack === undefined) {
    try {
      metadataStr = ` | ${JSON.stringify(metadata, null, 2)}`;
    } catch {
      metadataStr = ' | [Non-serializable metadata]';
    }
  }

  return `${timestamp} ${level}: ${formattedMessage}${metadataStr}`;
});

class SlackTransport extends Transport {
  constructor(options) {
    super(options);
    this.webhookUrl = options.webhookUrl;
    this.targetLevel = options.targetLevel;
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    if (!this.webhookUrl || info.level !== this.targetLevel) {
      callback();
      return;
    }

    this.sendToSlack(info)
      .then(() => {
        callback();
      })
      .catch(() => {
        callback();
      });
  }

  async sendToSlack(info) {
    const { message } = info;

    let formattedMessage = message;
    if (typeof message === 'object' && message !== null) {
      if (message instanceof Error) {
        formattedMessage = `${message.message}${message.stack ? `\n\`\`\`${message.stack}\`\`\`` : ''}`;
      } else {
        try {
          formattedMessage = JSON.stringify(message, null, 2);
        } catch {
          formattedMessage = '[Non-serializable object]';
        }
      }
    }

    const slackMessage = {
      text: formattedMessage,
    };

    return this.postToWebhook(slackMessage);
  }

  postToWebhook(payload) {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(this.webhookUrl);
        const postData = JSON.stringify(payload);

        const options = {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        };

        const req = https.request(options, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Slack webhook returned status ${res.statusCode}`));
          }
        });

        req.on('error', reject);
        req.setTimeout(5000, () => {
          req.destroy();
          reject(new Error('Slack webhook request timeout'));
        });

        req.write(postData);
        req.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

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

if (process.env.SLACK_LOGGING_ENABLED === 'true') {
  const slackTransports = [
    { level: 'info', envVar: 'SLACK_WEBHOOK_URL_INFO' },
    { level: 'warn', envVar: 'SLACK_WEBHOOK_URL_WARN' },
    { level: 'error', envVar: 'SLACK_WEBHOOK_URL_ERROR' },
  ];

  slackTransports.forEach(({ level, envVar }) => {
    const webhookUrl = process.env[envVar];
    if (webhookUrl) {
      logger.add(
        new SlackTransport({
          level: 'silly',
          targetLevel: level,
          webhookUrl,
          format: combine(
            timestamp({
              format: 'YYYY-MM-DD HH:mm:ss',
            }),
            errors({ stack: true }),
            myFormat
          ),
        })
      );
    }
  });
}

// Enhanced logging methods
logger.object = (obj, level = 'info', message = '', metadata = {}) => {
  logger.log(level, message, { ...metadata, object: obj });
};

logger.error = (message, metadata = null) => {
  if (message instanceof Error) {
    const { message: msg, stack, ...rest } = message;
    logger.log('error', msg, { ...rest, stack, ...(metadata || {}) });
  } else if (metadata !== null) {
    logger.log('error', message, metadata);
  } else {
    logger.log('error', message);
  }
};

// General purpose logging with metadata
logger.logWithMeta = (level, message, metadata = {}) => {
  logger.log(level, message, metadata);
};

module.exports = logger;
