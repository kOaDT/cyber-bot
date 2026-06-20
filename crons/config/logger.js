const path = require('path');
const fs = require('fs');
const { createLogger, format, transports } = require('winston');
const Transport = require('winston-transport');
const https = require('https');
const { URL } = require('url');
const { combine, timestamp, colorize, printf, errors } = format;

const resolveProjectName = () => {
  let dir = __dirname;
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) {
      try {
        return require(candidate).name || 'unknown';
      } catch {
        return 'unknown';
      }
    }
    dir = path.dirname(dir);
  }
  return 'unknown';
};

const PROJECT_NAME = resolveProjectName();
const getCronName = () => process.env.CRON_NAME || 'unknown';

const SECRET_PATTERNS = [
  /key=[A-Za-z0-9_-]{20,}/gi,
  /token=[A-Za-z0-9_-]{20,}/gi,
  /Bearer\s+[A-Za-z0-9\-_.~+/]{20,}=*/gi,
];

const redactSecrets = (str) => {
  if (typeof str !== 'string') return str;
  return SECRET_PATTERNS.reduce(
    (acc, pattern) =>
      acc.replace(pattern, (match) => {
        const eqIndex = match.indexOf('=');
        const spaceIndex = match.indexOf(' ');
        if (eqIndex !== -1) return match.slice(0, eqIndex + 1) + '[REDACTED]';
        if (spaceIndex !== -1) return match.slice(0, spaceIndex + 1) + '[REDACTED]';
        return '[REDACTED]';
      }),
    str
  );
};

const sanitizeSecrets = format((info) => {
  if (typeof info.message === 'string') info.message = redactSecrets(info.message);
  if (typeof info.stack === 'string') info.stack = redactSecrets(info.stack);
  return info;
});

const stringifyMessage = (message) => {
  if (message === null || message === undefined) return '';
  if (typeof message === 'string') return message;
  if (message instanceof Error) {
    return `${message.message}${message.stack ? ` - ${message.stack}` : ''}`;
  }
  if (typeof message === 'object') {
    try {
      return JSON.stringify(message);
    } catch {
      return '[Non-serializable object]';
    }
  }
  return String(message);
};

const RESERVED_INFO_KEYS = new Set(['level', 'message', 'timestamp']);

const extractMeta = (info) => {
  const result = {};
  for (const key of Object.keys(info)) {
    if (RESERVED_INFO_KEYS.has(key)) continue;
    result[key] = info[key];
  }
  return result;
};

const stringifyMeta = (meta) => {
  if (Object.keys(meta).length === 0) return '';
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return ' [Non-serializable metadata]';
  }
};

const unifiedFormat = printf((info) => {
  const prefix = `[project=${PROJECT_NAME} cron=${getCronName()}]`;
  const message = stringifyMessage(info.message);
  const meta = extractMeta(info);
  return `${info.timestamp} ${prefix} ${info.level}: ${message}${stringifyMeta(meta)}`;
});

const LEVEL_DECORATION = {
  info: { emoji: ':information_source:', label: 'INFO' },
  warn: { emoji: ':warning:', label: 'WARN' },
  error: { emoji: ':rotating_light:', label: 'ERROR' },
};

const buildSlackPayload = (info) => {
  const decoration = LEVEL_DECORATION[info.level] || { emoji: '', label: String(info.level).toUpperCase() };
  const cron = getCronName();
  const message = stringifyMessage(info.message);
  const meta = extractMeta(info);
  const headerText = `${decoration.label} — ${PROJECT_NAME} / ${cron}`;

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: headerText, emoji: false },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `${decoration.emoji} ${info.timestamp || ''}`.trim() }],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '```' + message + '```' },
    },
  ];

  if (Object.keys(meta).length > 0) {
    let metaText;
    try {
      metaText = JSON.stringify(meta, null, 2);
    } catch {
      metaText = '[Non-serializable metadata]';
    }
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '```' + metaText + '```' },
    });
  }

  return {
    text: `${headerText}: ${message}`,
    blocks,
  };
};

class SlackTransport extends Transport {
  constructor(options) {
    super(options);
    this.webhookUrl = options.webhookUrl;
    this.targetLevel = options.targetLevel;
  }

  log(info, callback) {
    setImmediate(() => this.emit('logged', info));
    if (!this.webhookUrl || info.level !== this.targetLevel) {
      callback();
      return;
    }
    this.postToWebhook(buildSlackPayload(info))
      .catch(() => {})
      .finally(() => callback());
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

const buildFormat = (extraFormats = []) =>
  combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    sanitizeSecrets(),
    ...extraFormats,
    unifiedFormat
  );

const stdoutOnly = process.env.LOG_STDOUT_ONLY === 'true';
const isProd = process.env.NODE_ENV === 'production';

const consoleTransport = new transports.Console({
  format: buildFormat(isProd ? [] : [colorize()]),
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: buildFormat(),
  transports: stdoutOnly
    ? [consoleTransport]
    : [
        new transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880,
          maxFiles: 5,
        }),
        new transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880,
          maxFiles: 5,
        }),
      ],
  exitOnError: false,
});

if (!stdoutOnly && !isProd) {
  logger.add(consoleTransport);
}

if (process.env.SLACK_LOGGING_ENABLED === 'true') {
  const slackChannels = [
    { level: 'info', envVar: 'SLACK_WEBHOOK_URL_INFO' },
    { level: 'warn', envVar: 'SLACK_WEBHOOK_URL_WARN' },
    { level: 'error', envVar: 'SLACK_WEBHOOK_URL_ERROR' },
  ];
  for (const { level, envVar } of slackChannels) {
    const webhookUrl = process.env[envVar];
    if (webhookUrl) {
      logger.add(new SlackTransport({ level: 'silly', targetLevel: level, webhookUrl }));
    }
  }
}

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

logger.logWithMeta = (level, message, metadata = {}) => {
  logger.log(level, message, metadata);
};

module.exports = logger;
module.exports.redactSecrets = redactSecrets;
module.exports.PROJECT_NAME = PROJECT_NAME;
