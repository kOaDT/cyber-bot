describe('Database configuration', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };

    // Setup test environment variables
    process.env.MYSQL_HOST = 'localhost';
    process.env.MYSQL_USER = 'testuser';
    process.env.MYSQL_PASSWORD = 'testpassword';
    process.env.MYSQL_DATABASE = 'testdb';
    process.env.MYSQL_PORT = '3306';

    // Reset module cache
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  test('should load configuration from environment variables', () => {
    const { config } = require('../../../crons/config/dbConfig');

    expect(config).toEqual({
      host: 'localhost',
      user: 'testuser',
      password: 'testpassword',
      database: 'testdb',
      port: '3306',
    });
  });

  test('should use default values when environment variables are not set', () => {
    delete process.env.MYSQL_HOST;
    delete process.env.MYSQL_USER;
    delete process.env.MYSQL_PASSWORD;
    delete process.env.MYSQL_DATABASE;
    delete process.env.MYSQL_PORT;

    const { config } = require('../../../crons/config/dbConfig');

    expect(config).toEqual({
      host: undefined,
      user: undefined,
      password: undefined,
      database: undefined,
      port: undefined,
    });
  });
});
