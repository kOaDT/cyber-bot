const dotenv = require('dotenv');
dotenv.config();

const { Command } = require('commander');
const program = new Command();
const logger = require('./crons/config/logger');
const { AUTHORIZED_LANGUAGES } = require('./crons/utils/langs');

program
  .version('1.1.0', '-v, --version')
  .description('A script help you to launch CRON Job')
  .usage('[OPTIONS]...')
  .requiredOption('-c, --cron <script.js>', 'Use a cron script name from crons directory')
  .option('-p, --param <param>', 'Option to pass extra param')
  .option('-l --lang <lang>', 'Option to pass language')
  .option('-y --youtube <youtube>', 'Option to pass youtube channel')
  .option('--dry-mode', 'Option to run the script without SQL query execution');

program.parse(process.argv);
const options = program.opts();
const cron = options.cron;
const dryMode = options.dryMode ? options.dryMode : false;
const param = options.param;
const lang = options.lang || 'english';
const youtube = options.youtube;

if (lang && !AUTHORIZED_LANGUAGES.includes(lang)) {
  logger.error('Invalid language');
  process.exit(1);
}

(async () => {
  logger.info(`
  🤖 ===============================
   Launching CRON: ${cron}
   Mode: ${dryMode ? '🧪 DRY-RUN' : '🚀 PRODUCTION'}
  =============================== `);

  try {
    const cronJob = require(`./crons/${cron}.js`);
    await cronJob.run({ dryMode, param, lang, youtube });
    logger.info(`
  ✨ ===============================
   Job terminated: ${cron}
   Status: 🎉 SUCCESS
  =============================== `);
    process.exit(0);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error(err);
    }
    logger.error(`
  ❌ ===============================
   Job failed: ${cron}
   Status: 💥 ERROR
   Details: ${err}
  =============================== `);
    process.exit(1);
  }
})();
