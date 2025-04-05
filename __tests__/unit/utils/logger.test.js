const winston = require('winston');
const logger = require('../../../crons/config/logger');

// Mock winston
jest.mock('winston', () => {
  const originalModule = jest.requireActual('winston');

  return {
    ...originalModule,
    createLogger: jest.fn().mockReturnValue({
      log: jest.fn(),
      add: jest.fn(),
      error: jest.fn(),
    }),
    format: {
      ...originalModule.format,
      combine: jest.fn(),
      timestamp: jest.fn(),
      errors: jest.fn(),
      printf: jest.fn(),
      colorize: jest.fn(),
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    },
  };
});

describe('logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('custom logger methods', () => {
    it('should log object with metadata', () => {
      const testObj = { foo: 'bar' };
      logger.object(testObj, 'info', 'test message', { extra: 'data' });
      expect(logger.log).toHaveBeenCalledWith('info', 'test message', {
        extra: 'data',
        object: testObj,
      });
    });

    it('should handle error logging with Error instance', () => {
      const testErr = new Error('test error');
      testErr.someData = 'extra data';
      logger.error(testErr, { context: 'test' });
      expect(logger.log).toHaveBeenCalledWith(
        'error',
        'test error',
        expect.objectContaining({
          stack: expect.any(String),
          someData: 'extra data',
          context: 'test',
        })
      );
    });

    it('should handle error logging with string message and metadata', () => {
      logger.error('error message', { context: 'test' });
      expect(logger.log).toHaveBeenCalledWith('error', 'error message', { context: 'test' });
    });

    it('should handle error logging with only message', () => {
      logger.error('error message');
      expect(logger.log).toHaveBeenCalledWith('error', 'error message');
    });

    it('should log with metadata', () => {
      logger.logWithMeta('debug', 'test message', { extra: 'data' });
      expect(logger.log).toHaveBeenCalledWith('debug', 'test message', { extra: 'data' });
    });
  });
});
