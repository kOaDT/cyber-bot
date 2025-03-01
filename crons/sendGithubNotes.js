const { onError } = require('./config/errors');
const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const crypto = require('crypto');
const { createRevisionCardPrompt } = require('./utils/prompts');
const { generate } = require('./utils/generate');
const fs = require('fs').promises;

const GITHUB_TOKEN = process.env.GITHUB_SECRET;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const GITHUB_REPO = process.env.GITHUB_REPO;
const EXCLUDED_GITHUB_FILES = process.env.EXCLUDED_GITHUB_FILES?.split(',') || [];
const PROCESSED_NOTES_PATH = 'assets/processedNotes.json';

/**
 * Get the processed notes
 * @returns {Array} The processed notes
 */
const getProcessedNotes = async () => {
  try {
    const data = await fs.readFile(PROCESSED_NOTES_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT' || err instanceof SyntaxError) {
      return [];
    }
    throw err;
  }
};

/**
 * Save the processed note
 * @param {string} title - The title of the note
 * @param {string} content - The content of the note
 */
const saveProcessedNote = async (title, content) => {
  try {
    const processedNotes = await getProcessedNotes();

    processedNotes.push({
      title,
      content,
      processedAt: new Date().toISOString(),
    });

    await fs.writeFile(PROCESSED_NOTES_PATH, JSON.stringify(processedNotes, null, 2), 'utf8');
  } catch (err) {
    onError(err, 'saveProcessedNote');
  }
};

const run = async ({ dryMode, lang }) => {
  try {
    if (!GITHUB_TOKEN || !GITHUB_USERNAME || !GITHUB_REPO) {
      logger.error('GITHUB_TOKEN, GITHUB_USERNAME, GITHUB_REPO is not set');
      return;
    }

    const { title, content } = await getGithubFile();

    const processedNotes = await getProcessedNotes();
    let revisionCard;

    const existingNote = processedNotes.find((note) => note.title === title);

    if (existingNote) {
      logger.info(`Note "${title}" already processed, using existing content`);
      revisionCard = existingNote.content;
    } else {
      logger.info(`Generating a new revision card for "${title}"`);
      const prompt = createRevisionCardPrompt(title, content, lang);
      revisionCard = await generate(prompt);
      await saveProcessedNote(title, revisionCard);
    }

    if (!dryMode) {
      return await sendMessage(revisionCard, process.env.TELEGRAM_TOPIC_GITHUB);
    }
    return logger.info(revisionCard);
  } catch (err) {
    onError(err, 'run');
  }
};

const getGithubFile = async () => {
  try {
    const query = `
      query {
        repository(owner: "${GITHUB_USERNAME}", name: "${GITHUB_REPO}") {
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

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const { data } = await response.json();
    const files = data.repository.object.entries;
    const markdownFiles = files.filter(
      (file) => file.name.endsWith('.md') && file.type === 'blob' && !EXCLUDED_GITHUB_FILES.includes(file.name)
    );

    logger.info(`${markdownFiles.length} markdown files found`);

    const randomIndex = crypto.randomInt(markdownFiles.length);
    const randomFile = markdownFiles[randomIndex];

    return { title: randomFile.name, content: randomFile.object.text };
  } catch (err) {
    onError(err, 'getGithubFile');
  }
};

module.exports = { run };
