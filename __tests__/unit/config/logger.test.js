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
});
