const logger = require('./config/logger');
const { sendMessage, sanitizeTelegramHtml } = require('./utils/sendMessage');
const { randomInt } = require('node:crypto');
const { createRevisionCardPrompt } = require('./utils/prompts');
const { generate } = require('./utils/generate');
const { evaluateRelevance } = require('./utils/relevance');
const { createArrayStore } = require('./utils/processedItems');

const GITHUB_TOKEN = process.env.GITHUB_SECRET;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const GITHUB_REPO = process.env.GITHUB_REPO;
const EXCLUDED_GITHUB_FILES = process.env.EXCLUDED_GITHUB_FILES?.split(',') || [];
const PROCESSED_NOTES_PATH = 'assets/processedNotes.json';

const store = createArrayStore(PROCESSED_NOTES_PATH);

const getGithubFile = async () => {
  try {
    const query = `
      query($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          object(expression: "HEAD:") {
            ... on Tree {
              entries {
                name
                type
                object {
                  ... on Blob {
                    text
                    oid
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables = { owner: GITHUB_USERNAME, name: GITHUB_REPO };

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    const { data } = await response.json();
    const files = data.repository.object.entries;
    const markdownFiles = files.filter(
      (file) => file.name.endsWith('.md') && file.type === 'blob' && !EXCLUDED_GITHUB_FILES.includes(file.name)
    );

    const randomIndex = randomInt(markdownFiles.length);
    const randomFile = markdownFiles[randomIndex];

    return { title: randomFile.name, content: randomFile.object.text };
  } catch (error) {
    logger.error('Error getting Github file', { error: error.message });
  }
};

const run = async ({ dryMode, lang }) => {
  try {
    if (!GITHUB_TOKEN || !GITHUB_USERNAME || !GITHUB_REPO) {
      logger.error('GITHUB_TOKEN, GITHUB_USERNAME, GITHUB_REPO is not set');
      return;
    }

    const { title, content } = await getGithubFile();

    const processedNotes = await store.load();
    let revisionCard;

    const existingNote = processedNotes.find((note) => note.title === title);

    if (existingNote) {
      logger.info('Note already processed, using existing content', { title });
      revisionCard = existingNote.content;
    } else {
      const { relevant } = await evaluateRelevance({
        title,
        content,
        source: 'GitHub note',
      });

      if (!relevant) {
        return;
      }

      logger.info(`Generating a new revision card for "${title}"`);
      const prompt = createRevisionCardPrompt(title, content, lang);
      const rawCard = await generate(prompt, { skipValidation: true });
      revisionCard = sanitizeTelegramHtml(rawCard);
      await store.save({ title, content: revisionCard });
    }

    if (dryMode) {
      logger.info('Dry mode: No message sent', { revisionCard });
      return;
    }

    const sanitized = sanitizeTelegramHtml(revisionCard);
    await sendMessage(sanitized, process.env.TELEGRAM_TOPIC_GITHUB, null, { parse_mode: 'HTML' });
  } catch (error) {
    logger.error('Error sending Github notes', { error: error.message });
  }
};

module.exports = { run, _getGithubFile: getGithubFile };
