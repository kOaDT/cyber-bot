/* eslint-disable security-node/detect-crlf -- local bootstrap script logging hardcoded, developer-controlled paths */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const STATE_DIR = process.env.CRON_STATE_DIR;
const resolveStatePath = (filePath) =>
  STATE_DIR ? path.join(STATE_DIR, filePath.replace(/^\.?\/?assets\//, '')) : filePath;

const EMPTY_ARRAY = '[]\n';
const EMPTY_OBJECT = '{}\n';

const stateFiles = {
  'assets/processedNotes.json': EMPTY_ARRAY,
  'assets/processedArticles.json': EMPTY_ARRAY,
  'assets/processedReddit.json': EMPTY_ARRAY,
  'assets/processedCTF.json': EMPTY_ARRAY,
  'assets/processedDD.json': EMPTY_OBJECT,
  'assets/processedSnyk.json': EMPTY_OBJECT,
  'assets/processedSecurityNow.json': EMPTY_OBJECT,
  'assets/processedCyberShow.json': EMPTY_OBJECT,
  'assets/processedYT.json': EMPTY_OBJECT,
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory ${dir}`);
  }
};

ensureDir('logs');

let created = 0;
for (const [file, content] of Object.entries(stateFiles)) {
  const target = resolveStatePath(file);
  ensureDir(path.dirname(target));

  if (fs.existsSync(target)) {
    console.log(`Skipped ${target} (already exists)`);
    continue;
  }

  fs.writeFileSync(target, content);
  console.log(`Created ${target}`);
  created += 1;
}

const untouched = Object.keys(stateFiles).length - created;
console.log(`\nSetup complete: ${created} tracking file(s) created, ${untouched} left untouched.`);
