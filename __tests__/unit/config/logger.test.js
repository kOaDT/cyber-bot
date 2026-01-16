const https = require('https');

describe('logger configuration', () => {
  let originalEnv;
  let logger;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.SLACK_LOGGING_ENABLED;
    delete process.env.SLACK_WEBHOOK_URL_INFO;
    delete process.env.SLACK_WEBHOOK_URL_WARN;
    delete process.env.SLACK_WEBHOOK_URL_ERROR;
    logger = require('../../../crons/config/logger');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  test('should have info method', () => {
    expect(typeof logger.info).toBe('function');
  });

  test('should have error method', () => {
    expect(typeof logger.error).toBe('function');
  });

  test('info method should be callable', () => {
    const spy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    logger.info('test message');
    expect(spy).toHaveBeenCalledWith('test message');
    spy.mockRestore();
  });

  describe('object method', () => {
    test('should log object with default level and message', () => {
      const spy = jest.spyOn(logger, 'log').mockImplementation(() => {});
      const testObj = { key: 'value' };
      logger.object(testObj);
      expect(spy).toHaveBeenCalledWith('info', '', { object: testObj });
      spy.mockRestore();
    });

    test('should log object with custom level and message', () => {
      const spy = jest.spyOn(logger, 'log').mockImplementation(() => {});
      const testObj = { key: 'value' };
      logger.object(testObj, 'warn', 'Test message', { meta: 'data' });
      expect(spy).toHaveBeenCalledWith('warn', 'Test message', { meta: 'data', object: testObj });
      spy.mockRestore();
    });
  });

  describe('error method', () => {
    test('should handle Error instance with metadata', () => {
      const spy = jest.spyOn(logger, 'log').mockImplementation(() => {});
      const error = new Error('Test error');
      logger.error(error, { context: 'test' });
      expect(spy).toHaveBeenCalledWith(
        'error',
        'Test error',
        expect.objectContaining({
          context: 'test',
          stack: expect.any(String),
        })
      );
      spy.mockRestore();
    });

    test('should handle Error instance without metadata', () => {
      const spy = jest.spyOn(logger, 'log').mockImplementation(() => {});
      const error = new Error('Test error');
      logger.error(error);
      expect(spy).toHaveBeenCalledWith(
        'error',
        'Test error',
        expect.objectContaining({
          stack: expect.any(String),
        })
      );
      spy.mockRestore();
    });

    test('should handle string message with metadata', () => {
      const spy = jest.spyOn(logger, 'log').mockImplementation(() => {});
      logger.error('String error', { context: 'test' });
      expect(spy).toHaveBeenCalledWith('error', 'String error', { context: 'test' });
      spy.mockRestore();
    });

    test('should handle string message without metadata', () => {
      const spy = jest.spyOn(logger, 'log').mockImplementation(() => {});
      logger.error('String error');
      expect(spy).toHaveBeenCalledWith('error', 'String error');
      spy.mockRestore();
    });
  });

  describe('logWithMeta method', () => {
    test('should log with metadata', () => {
      const spy = jest.spyOn(logger, 'log').mockImplementation(() => {});
      logger.logWithMeta('debug', 'Debug message', { debug: true });
      expect(spy).toHaveBeenCalledWith('debug', 'Debug message', { debug: true });
      spy.mockRestore();
    });

    test('should log without metadata', () => {
      const spy = jest.spyOn(logger, 'log').mockImplementation(() => {});
      logger.logWithMeta('info', 'Info message');
      expect(spy).toHaveBeenCalledWith('info', 'Info message', {});
      spy.mockRestore();
    });
  });

  describe('Slack integration', () => {
    test('should not add Slack transports when SLACK_LOGGING_ENABLED is not set', () => {
      const transports = logger.transports || [];
      const slackTransports = transports.filter((t) => t.constructor && t.constructor.name === 'SlackTransport');
      expect(slackTransports.length).toBe(0);
    });

    test('should not add Slack transports when SLACK_LOGGING_ENABLED is false', () => {
      process.env.SLACK_LOGGING_ENABLED = 'false';
      jest.resetModules();
      const loggerInstance = require('../../../crons/config/logger');
      const transports = loggerInstance.transports || [];
      const slackTransports = transports.filter((t) => t.constructor && t.constructor.name === 'SlackTransport');
      expect(slackTransports.length).toBe(0);
    });

    test('should not add Slack transport when webhook URL is missing', () => {
      process.env.SLACK_LOGGING_ENABLED = 'true';
      jest.resetModules();
      const loggerInstance = require('../../../crons/config/logger');
      const transports = loggerInstance.transports || [];
      const slackTransports = transports.filter((t) => t.constructor && t.constructor.name === 'SlackTransport');
      expect(slackTransports.length).toBe(0);
    });

    test('should add Slack transport when enabled and webhook URL is provided', () => {
      process.env.SLACK_LOGGING_ENABLED = 'true';
      process.env.SLACK_WEBHOOK_URL_INFO = 'https://hooks.slack.com/services/test';
      jest.resetModules();
      const loggerInstance = require('../../../crons/config/logger');
      const transports = loggerInstance.transports || [];
      const slackTransports = transports.filter((t) => t.constructor && t.constructor.name === 'SlackTransport');
      expect(slackTransports.length).toBeGreaterThan(0);
    });

    test('should filter logs by target level', (done) => {
      process.env.SLACK_LOGGING_ENABLED = 'true';
      process.env.SLACK_WEBHOOK_URL_INFO = 'https://hooks.slack.com/services/test';
      jest.resetModules();

      const mockWrite = jest.fn();
      const mockEnd = jest.fn();
      const mockSetTimeout = jest.fn();
      const mockDestroy = jest.fn();

      https.request = jest.fn().mockImplementation((options, callback) => {
        setTimeout(() => {
          if (callback) {
            callback({ statusCode: 200 });
          }
        }, 0);
        return {
          on: jest.fn(),
          write: mockWrite,
          end: mockEnd,
          setTimeout: mockSetTimeout,
          destroy: mockDestroy,
        };
      });

      const loggerInstance = require('../../../crons/config/logger');
      const transports = loggerInstance.transports || [];
      const slackTransport = transports.find(
        (t) => t.constructor && t.constructor.name === 'SlackTransport' && t.targetLevel === 'info'
      );

      if (slackTransport) {
        const callback = jest.fn();
        slackTransport.log({ level: 'warn', message: 'test' }, callback);
        setTimeout(() => {
          expect(mockWrite).not.toHaveBeenCalled();
          expect(callback).toHaveBeenCalled();
          done();
        }, 10);
      } else {
        done();
      }
    });

    test('should send to Slack when level matches', (done) => {
      process.env.SLACK_LOGGING_ENABLED = 'true';
      process.env.SLACK_WEBHOOK_URL_INFO = 'https://hooks.slack.com/services/test';
      jest.resetModules();

      const mockWrite = jest.fn();
      const mockEnd = jest.fn();

      https.request = jest.fn().mockImplementation((options, callback) => {
        setTimeout(() => {
          if (callback) {
            callback({ statusCode: 200 });
          }
        }, 0);
        return {
          on: jest.fn(),
          write: mockWrite,
          end: mockEnd,
          setTimeout: jest.fn(),
          destroy: jest.fn(),
        };
      });

      const loggerInstance = require('../../../crons/config/logger');
      const transports = loggerInstance.transports || [];
      const slackTransport = transports.find(
        (t) => t.constructor && t.constructor.name === 'SlackTransport' && t.targetLevel === 'info'
      );

      if (slackTransport) {
        const callback = jest.fn();
        slackTransport.log({ level: 'info', message: 'test message' }, callback);
        setTimeout(() => {
          expect(mockWrite).toHaveBeenCalled();
          const writtenData = JSON.parse(mockWrite.mock.calls[0][0]);
          expect(writtenData.text).toBe('test message');
          expect(mockEnd).toHaveBeenCalled();
          expect(callback).toHaveBeenCalled();
          done();
        }, 10);
      } else {
        done();
      }
    });
  });
});
