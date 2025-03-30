const fs = require('fs').promises;
const logger = require('../config/logger');

/**
 * Cleans the processed data file to keep only the data from the last X days.
 *
 * @param {number} daysToKeep - The number of days to keep.
 * @param {string} filePath - The path to the file to clean.
 */
const cleanProcessedData = async (daysToKeep, filePath) => {
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    let processedData = JSON.parse(fileContent);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const filteredData = processedData.filter((data) => {
      const processedAt = new Date(data.processedAt);
      return processedAt >= cutoffDate;
    });

    await fs.writeFile(filePath, JSON.stringify(filteredData, null, 2));
    logger.info(`Cleaned processed data file. Kept ${filteredData.length} recent entries.`);
  } catch (error) {
    logger.error('Error cleaning processed data file', { error: error.message });
  }
};

module.exports = {
  cleanProcessedData,
};
