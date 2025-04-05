const { delay } = require('../../../crons/utils/delay');

describe('delay utility', () => {
  it('should wait for the specified time', async () => {
    const delayTime = 100;
    const start = Date.now();

    await delay(delayTime);

    const end = Date.now();
    const elapsedTime = end - start;

    // Allow for slight timing variance
    expect(elapsedTime).toBeGreaterThanOrEqual(delayTime - 5);
    expect(elapsedTime).toBeLessThan(delayTime + 50);
  });
});
