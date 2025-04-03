const { delay } = require('../../../crons/utils/delay');

describe('delay utility', () => {
  test('should wait for the specified time', async () => {
    const start = Date.now();
    const delayTime = 100;

    await delay(delayTime);

    const end = Date.now();
    const elapsedTime = end - start;

    expect(elapsedTime).toBeGreaterThanOrEqual(delayTime);
    expect(elapsedTime).toBeLessThan(delayTime + 50);
  });
});
