const dbConfig = require('../config/dbConfig.js').config;
const mysql = require('mysql2');
const logger = require('../config/logger.js');

try {
  const pool = mysql.createPool(dbConfig);
  pool.getConnection((err, connection) => {
    if (err) {
      if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        logger.error('Database connection was closed.');
      }
      if (err.code === 'ER_CON_COUNT_ERROR') {
        logger.error('Database has too many connections.');
      }
      if (err.code === 'ECONNREFUSED') {
        logger.error('Database connection was refused.');
      }
      logger.error(err);
    }
    if (connection) connection.release();
    return;
  });
  module.exports = pool;
} catch (err) {
  logger.error('Error connecting to database', { error: err.message });
  throw err;
}
