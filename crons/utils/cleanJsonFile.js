const fs = require('fs').promises;
const logger = require('../config/logger');
const { withFileLock, atomicWriteFile } = require('./fileUtils');
const { resolveStatePath } = require('./processedItems');

const cleanProcessedData = async (daysToKeep, filePath) => {
  filePath = resolveStatePath(filePath);
  try {
    await withFileLock(filePath, async () => {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const processedData = JSON.parse(fileContent);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const filteredData = processedData.filter((data) => {
        const processedAt = new Date(data.processedAt);
        return processedAt >= cutoffDate;
      });

      await atomicWriteFile(filePath, JSON.stringify(filteredData, null, 2));
      logger.info(`Cleaned processed data file. Kept ${filteredData.length} recent entries.`);
    });
  } catch (error) {
    logger.error('Error cleaning processed data file', { error: error.message });
  }
};

module.exports = {
  cleanProcessedData,
};
