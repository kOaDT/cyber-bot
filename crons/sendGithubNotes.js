 
const { onError } = require('./config/errors');
const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const crypto = require('crypto');
const { mistralClient, DEFAULT_PARAMS } = require('./config/mistral');
const { createRevisionCardPrompt } = require('./utils/prompts');

const GITHUB_TOKEN = process.env.GITHUB_SECRET;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'kOaDT';
const GITHUB_REPO = process.env.GITHUB_REPO || 'Cyber';
const EXCLUDED_FILES = process.env.EXCLUDED_FILES?.split(',') || ['root-me-challenges.md'];
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

const run = async (dryMode) => {
  try {
    if (!GITHUB_TOKEN || !GITHUB_USERNAME || !GITHUB_REPO || !MISTRAL_API_KEY) {
      logger.error('GITHUB_TOKEN, GITHUB_USERNAME, GITHUB_REPO, or MISTRAL_API_KEY is not set');
      return;
    }

    const { title, content } = await getGithubFile();
    const revisionCard = await generateRevisionCard(title, content);

    if (!dryMode) {
      return await sendMessage(revisionCard);
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
      (file) => file.name.endsWith('.md') && file.type === 'blob' && !EXCLUDED_FILES.includes(file.name)
    );

    logger.info(`${markdownFiles.length} markdown files found`);

    const randomIndex = crypto.randomInt(markdownFiles.length);
    const randomFile = markdownFiles[randomIndex];

    return { title: randomFile.name, content: randomFile.object.text };
  } catch (err) {
    onError(err, 'getGithubFile');
  }
};

const generateRevisionCard = async (title, content) => {
  try {
    const prompt = createRevisionCardPrompt(title, content);

    const response = await mistralClient.chat.complete({
      ...DEFAULT_PARAMS,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.choices[0].message.content;
  } catch (err) {
    onError(err, 'generateRevisionCard');
  }
};

module.exports = { run };
