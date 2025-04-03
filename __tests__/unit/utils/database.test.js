const logger = require('../../../crons/config/logger');

jest.mock('mysql2');
jest.mock('../../../crons/config/logger');

describe('Database utility', () => {
  let mockPool;
  let mockConnection;
  let mysql;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Mock the mysql2 module
    mockConnection = { release: jest.fn() };
    mockPool = {
      getConnection: jest.fn((cb) => cb(null, mockConnection)),
      promise: jest.fn(() => ({})),
    };

    mysql = require('mysql2');
    mysql.createPool = jest.fn().mockReturnValue(mockPool);

    // Mock the dbConfig
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
    jest.restoreAllMocks();
  });

  test('should create a connection pool with the correct config', () => {
    // Require the module under test
    require('../../../crons/utils/database');

    // Check that createPool was called with correct config
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
});
