jest.mock('mysql2');
jest.mock('../../../crons/config/logger');

describe('Database utility', () => {
  let mockPool;
  let mockConnection;
  let mysql;

  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env = { ...originalEnv };

    mockConnection = { release: jest.fn() };
    mockPool = {
      getConnection: jest.fn((cb) => cb(null, mockConnection)),
      promise: jest.fn(() => ({})),
    };

    mysql = require('mysql2');
    mysql.createPool = jest.fn().mockReturnValue(mockPool);

    jest.doMock('../../../crons/config/dbConfig.js', () => ({
      config: {
        host: 'test-host',
        user: 'test-user',
        password: 'test-password',
        database: 'test-db',
        multipleStatements: true,
      },
    }));
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  test('should not create a pool when I_WANT_TO_SAVE_MESSAGES_IN_DB is not true', () => {
    process.env.I_WANT_TO_SAVE_MESSAGES_IN_DB = 'false';
    const { getPool } = require('../../../crons/utils/database');

    const pool = getPool();

    expect(pool).toBeNull();
    expect(mysql.createPool).not.toHaveBeenCalled();
  });

  test('should not create a pool when I_WANT_TO_SAVE_MESSAGES_IN_DB is not set', () => {
    delete process.env.I_WANT_TO_SAVE_MESSAGES_IN_DB;
    const { getPool } = require('../../../crons/utils/database');

    const pool = getPool();

    expect(pool).toBeNull();
    expect(mysql.createPool).not.toHaveBeenCalled();
  });

  test('should create a pool when I_WANT_TO_SAVE_MESSAGES_IN_DB is true', () => {
    process.env.I_WANT_TO_SAVE_MESSAGES_IN_DB = 'true';
    const { getPool } = require('../../../crons/utils/database');

    const pool = getPool();

    expect(pool).toBe(mockPool);
    expect(mysql.createPool).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'test-host',
        user: 'test-user',
        password: 'test-password',
        database: 'test-db',
        multipleStatements: true,
      })
    );
  });

  test('should reuse the same pool on subsequent calls', () => {
    process.env.I_WANT_TO_SAVE_MESSAGES_IN_DB = 'true';
    const { getPool } = require('../../../crons/utils/database');

    const pool1 = getPool();
    const pool2 = getPool();

    expect(pool1).toBe(pool2);
    expect(mysql.createPool).toHaveBeenCalledTimes(1);
  });

  test('should return null and log error when createPool throws', () => {
    process.env.I_WANT_TO_SAVE_MESSAGES_IN_DB = 'true';
    const logger = require('../../../crons/config/logger');
    mysql.createPool = jest.fn(() => {
      throw new Error('connection failed');
    });

    const { getPool } = require('../../../crons/utils/database');
    const pool = getPool();

    expect(pool).toBeNull();
    expect(logger.error).toHaveBeenCalledWith('Error connecting to database', { error: 'connection failed' });
  });

  test('should log error on ECONNREFUSED', () => {
    process.env.I_WANT_TO_SAVE_MESSAGES_IN_DB = 'true';
    const logger = require('../../../crons/config/logger');
    mockPool.getConnection = jest.fn((cb) => cb({ code: 'ECONNREFUSED' }));

    const { getPool } = require('../../../crons/utils/database');
    getPool();

    expect(logger.error).toHaveBeenCalledWith('Database connection was refused.');
  });
});
