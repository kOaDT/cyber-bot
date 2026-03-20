const dbConfig = require('../config/dbConfig.js').config;
const mysql = require('mysql2');
const logger = require('../config/logger.js');

let pool = null;

const getPool = () => {
  if (pool) return pool;

  if (process.env.I_WANT_TO_SAVE_MESSAGES_IN_DB !== 'true') {
    return null;
  }

  try {
    pool = mysql.createPool(dbConfig);
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
        return;
      }
      if (connection) connection.release();
    });
  } catch (err) {
    logger.error('Error connecting to database', { error: err.message });
    pool = null;
    return null;
  }

  return pool;
};

module.exports = { getPool };
