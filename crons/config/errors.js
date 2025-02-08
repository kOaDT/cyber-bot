const logger = require('./logger');

/**
 * This function logs errors.
 * @param {Object} err
 * @param {String} func
 * @param {String} type
 */
const onError = (err, func, type = 'error') => {
  if (err.message) {
    return logger[type](`${func}: ${err.message}`);
  }
  logger[type](func);
  return logger[type](err);
};

module.exports = { onError };