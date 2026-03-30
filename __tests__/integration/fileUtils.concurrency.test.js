const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { withFileLock, atomicWriteFile } = require('../../crons/utils/fileUtils');

describe('fileUtils concurrency', () => {
  let tmpDir;
  let testFile;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cyber-bot-test-'));
    testFile = path.join(tmpDir, 'data.json');
    await fs.writeFile(testFile, JSON.stringify([], null, 2));
  });

  afterEach(async () => {
    const files = await fs.readdir(tmpDir);
    await Promise.all(files.map((f) => fs.rm(path.join(tmpDir, f), { recursive: true, force: true })));
    await fs.rmdir(tmpDir);
  });

  it('should not lose writes under concurrent access', async () => {
    const WRITERS = 20;

    const writeTask = (id) =>
      withFileLock(testFile, async () => {
        const raw = await fs.readFile(testFile, 'utf8');
        const items = JSON.parse(raw);
        items.push({ id, processedAt: new Date().toISOString() });
        await atomicWriteFile(testFile, JSON.stringify(items, null, 2));
      });

    await Promise.all(Array.from({ length: WRITERS }, (_, i) => writeTask(i)));

    const result = JSON.parse(await fs.readFile(testFile, 'utf8'));
    expect(result).toHaveLength(WRITERS);

    const ids = result.map((item) => item.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: WRITERS }, (_, i) => i));
  });

  it('should not lose data when reads and writes happen concurrently', async () => {
    await fs.writeFile(testFile, JSON.stringify([{ id: 'initial' }], null, 2));

    const writeTask = (id) =>
      withFileLock(testFile, async () => {
        const raw = await fs.readFile(testFile, 'utf8');
        const items = JSON.parse(raw);
        items.push({ id });
        await atomicWriteFile(testFile, JSON.stringify(items, null, 2));
      });

    const readTask = () =>
      withFileLock(testFile, async () => {
        const raw = await fs.readFile(testFile, 'utf8');
        return JSON.parse(raw);
      });

    const tasks = [];
    for (let i = 0; i < 10; i++) {
      tasks.push(writeTask(`w-${i}`));
      tasks.push(readTask());
    }

    await Promise.all(tasks);

    const result = JSON.parse(await fs.readFile(testFile, 'utf8'));
    expect(result).toHaveLength(11); // 1 initial + 10 writes
  });

  it('atomicWriteFile should not leave tmp files on success', async () => {
    await atomicWriteFile(testFile, '{"clean":true}');

    const files = await fs.readdir(tmpDir);
    expect(files.filter((f) => f.endsWith('.tmp'))).toHaveLength(0);
    expect(JSON.parse(await fs.readFile(testFile, 'utf8'))).toEqual({ clean: true });
  });
});
