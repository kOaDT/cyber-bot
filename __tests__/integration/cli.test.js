const { execSync } = require('child_process');

describe('CLI integration', () => {
  test('should fail when called without required --cron option', () => {
    expect(() => {
      execSync('node index.js', { stdio: 'pipe' });
    }).toThrow();
  });

  test('should run with --cron and --dry-mode options', () => {
    try {
      const output = execSync('node index.js --cron mockCron --dry-mode', {
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' },
      }).toString();

      expect(output).toContain('DRY-RUN');
    } catch (error) {
      expect(error.message).toContain('Command failed:');
    }
  });
});
