const logger = require('../../../crons/config/logger');

describe('logger configuration', () => {
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
});
