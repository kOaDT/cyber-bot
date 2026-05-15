const dotenv = require('dotenv');
dotenv.config();

const { Command } = require('commander');
const program = new Command();
const { AUTHORIZED_LANGUAGES } = require('./crons/utils/langs');

const ALLOWED_CRONS = [
  'sendNewsResume',
  'sendCve',
  'sendTHMCTF',
  'sendRedditPost',
  'sendYoutubeResume',
  'sendGithubNotes',
  'sendDarknetDiariesResume',
  'sendSnykResume',
  'sendSecurityNowResume',
  'sendCyberShowResume',
];

program
  .version('1.1.0', '-v, --version')
  .description('A script help you to launch CRON Job')
  .usage('[OPTIONS]...')
  .requiredOption('-c, --cron <script.js>', 'Use a cron script name from crons directory')
  .option('-p, --param <param>', 'Option to pass extra param')
  .option('-l --lang <lang>', 'Option to pass language')
  .option('-y --youtube <youtube>', 'Option to pass youtube channel')
  .option('--dry-mode', 'Option to run the script without sending messages to telegram');

program.parse(process.argv);
const options = program.opts();
const cron = options.cron;
const dryMode = options.dryMode ? options.dryMode : false;
const param = options.param;
const lang = options.lang || 'english';
const youtube = options.youtube;

process.env.CRON_NAME = cron;
const logger = require('./crons/config/logger');

if (!ALLOWED_CRONS.includes(cron)) {
  logger.error('Invalid cron name', { cron, allowed: ALLOWED_CRONS });
  process.exit(1);
}

if (lang && !AUTHORIZED_LANGUAGES.includes(lang)) {
  logger.error('Invalid language', { lang, available: AUTHORIZED_LANGUAGES });
  process.exit(1);
}

if (youtube && !youtube.includes('https://www.youtube.com/')) {
  logger.error('Invalid youtube channel', { youtube });
  process.exit(1);
}

const waitForLoggerFlush = () =>
  new Promise((resolve) => {
    logger.on('finish', resolve);
    logger.end();
  });

(async () => {
  logger.info('Cron starting', { mode: dryMode ? 'dry-run' : 'production' });

  try {
    const cronJob = require(`./crons/${cron}.js`);
    await cronJob.run({ dryMode, param, lang, youtube });
    logger.info('Cron completed', { status: 'success' });
    await waitForLoggerFlush();
    process.exit(0);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error(err);
    }
    logger.error('Cron failed', { status: 'error', error: err.message, stack: err.stack });
    await waitForLoggerFlush();
    process.exit(1);
  }
})();
