const fs = require('fs').promises;
const logger = require('../config/logger');

function createArrayStore(filePath) {
  async function load() {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.warn(`Could not read ${filePath}, starting fresh`, { error: error.message });
      return [];
    }
  }

  async function save(entry) {
    try {
      const items = await load();
      items.push({ ...entry, processedAt: new Date().toISOString() });
      await fs.writeFile(filePath, JSON.stringify(items, null, 2));
    } catch (error) {
      logger.error(`Error saving to ${filePath}`, { error: error.message });
    }
  }

  return { load, save };
}

function createObjectStore(filePath, defaults = { episodeNumber: 0 }) {
  async function load() {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.warn(`Could not read ${filePath}, using defaults`, { error: error.message });
      return { ...defaults };
    }
  }

  async function save(data) {
    await fs.writeFile(filePath, JSON.stringify({ ...data, processedAt: new Date().toISOString() }));
  }

  return { load, save };
}

function createKeyedStore(filePath) {
  async function _readAll() {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.warn(`Could not read ${filePath}, starting fresh`, { error: error.message });
      return {};
    }
  }

  async function load(key) {
    const content = await _readAll();
    return content[key] || { videoId: null };
  }

  async function save(key, data) {
    try {
      const content = await _readAll();
      content[key] = { ...data, processedAt: new Date().toISOString() };
      await fs.writeFile(filePath, JSON.stringify(content, null, 2));
    } catch (error) {
      throw new Error(`Failed to save to ${filePath}: ${error.message}`);
    }
  }

  return { load, save };
}

module.exports = { createArrayStore, createObjectStore, createKeyedStore };
