const dotenv = require('dotenv');
dotenv.config();

const { Command } = require('commander');
const program = new Command();
const logger = require('./crons/config/logger');

program
  .version('1.0.0', '-v, --version')
  .description('A script help you to launch CRON Job')
  .usage('[OPTIONS]...')
  .requiredOption('-c, --cron <script.js>', 'Use a cron script name from crons directory')
  .option('-p, --param <param>', 'Option to pass extra param')
  .option('-l --lang <lang>', 'Option to pass language')
  .option('--dry-mode', 'Option to run the script without SQL query execution');

program.parse(process.argv);
const options = program.opts();
const cron = options.cron;
const dryRunMode = options.dryMode ? options.dryMode : false;
const extraParam = {
  param: options.param,
  lang: options.lang,
};

(async () => {
  logger.info(`
🤖 ===============================
   Launching CRON: ${cron}
   Mode: ${dryRunMode ? '🧪 DRY-RUN' : '🚀 PRODUCTION'}
=============================== `);

  try {
    const cronJob = require(`./crons/${cron}.js`);
    await cronJob.run(dryRunMode, extraParam);
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
