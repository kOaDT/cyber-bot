/* eslint-disable security-node/detect-unhandled-async-errors */
const fs = require('fs').promises;

const LOCK_STALE_MS = parseInt(process.env.FILE_LOCK_STALE_MS, 10) || 10_000;
const LOCK_RETRY_MS = parseInt(process.env.FILE_LOCK_RETRY_MS, 10) || 50;
const LOCK_TIMEOUT_MS = parseInt(process.env.FILE_LOCK_TIMEOUT_MS, 10) || 5_000;

async function acquireLock(filePath) {
  const lockDir = `${filePath}.lock`;
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      await fs.mkdir(lockDir);
      return lockDir;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;

      try {
        const stat = await fs.stat(lockDir);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          await fs.rmdir(lockDir);
          continue;
        }
      } catch {
        continue;
      }

      await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    }
  }

  throw new Error(`Timed out acquiring lock for ${filePath}`);
}

async function releaseLock(lockDir) {
  try {
    await fs.rmdir(lockDir);
  } catch {}
}

async function withFileLock(filePath, fn) {
  const lockDir = await acquireLock(filePath);
  try {
    return await fn();
  } catch (err) {
    throw err;
  } finally {
    await releaseLock(lockDir);
  }
}

async function atomicWriteFile(filePath, data) {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, data);
  try {
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }
}

module.exports = { withFileLock, atomicWriteFile };
