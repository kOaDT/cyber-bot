jest.mock('../../../crons/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../crons/utils/relevance', () => ({
  evaluateRelevance: jest.fn().mockResolvedValue({ relevant: true, score: 8 }),
}));

jest.mock('../../../crons/utils/generate', () => ({
  generate: jest.fn().mockResolvedValue('Generated summary'),
}));

jest.mock('../../../crons/utils/sendMessage', () => ({
  sendMessage: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../crons/utils/delay', () => ({
  delay: jest.fn().mockResolvedValue(undefined),
}));

const { runContentJob } = require('../../../crons/utils/contentRunner');
const logger = require('../../../crons/config/logger');
const { evaluateRelevance } = require('../../../crons/utils/relevance');
const { generate } = require('../../../crons/utils/generate');
const { sendMessage } = require('../../../crons/utils/sendMessage');
const { delay } = require('../../../crons/utils/delay');

const createBaseConfig = (overrides = {}) => ({
  name: 'test item',
  source: 'test source',
  topicId: 'test-topic',
  cleanup: jest.fn().mockResolvedValue(undefined),
  fetchItems: jest.fn().mockResolvedValue([
    { title: 'Item 1', content: 'Content 1', id: '1' },
    { title: 'Item 2', content: 'Content 2', id: '2' },
  ]),
  filterNew: jest.fn().mockImplementation((items) => items),
  createPrompt: jest.fn().mockReturnValue('test prompt'),
  saveProcessed: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('contentRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    evaluateRelevance.mockResolvedValue({ relevant: true, score: 8 });
  });

  it('should process a relevant item and send message', async () => {
    const config = createBaseConfig();

    await runContentJob(config, { dryMode: false, lang: 'english' });

    expect(config.cleanup).toHaveBeenCalled();
    expect(config.fetchItems).toHaveBeenCalled();
    expect(config.filterNew).toHaveBeenCalled();
    expect(evaluateRelevance).toHaveBeenCalledWith({
      title: 'Item 1',
      content: 'Content 1',
      source: 'test source',
    });
    expect(config.saveProcessed).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
    expect(generate).toHaveBeenCalledWith('test prompt');
    expect(sendMessage).toHaveBeenCalledWith('Generated summary', 'test-topic');
  });

  it('should not send message in dry mode', async () => {
    const config = createBaseConfig();

    await runContentJob(config, { dryMode: true, lang: 'english' });

    expect(generate).toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('Dry mode: No message sent', { summary: 'Generated summary' });
  });

  it('should skip non-relevant items and save them', async () => {
    evaluateRelevance
      .mockResolvedValueOnce({ relevant: false, score: 2 })
      .mockResolvedValueOnce({ relevant: true, score: 8 });

    const config = createBaseConfig();

    await runContentJob(config, { dryMode: false, lang: 'english' });

    expect(config.saveProcessed).toHaveBeenCalledTimes(2);
    expect(config.saveProcessed).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: '1' }));
    expect(config.saveProcessed).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: '2' }));
    expect(generate).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('should log when no new items to process', async () => {
    const config = createBaseConfig({
      filterNew: jest.fn().mockResolvedValue([]),
    });

    await runContentJob(config, { dryMode: false, lang: 'english' });

    expect(logger.info).toHaveBeenCalledWith('No new test item to process');
    expect(evaluateRelevance).not.toHaveBeenCalled();
  });

  it('should log when no relevant items found', async () => {
    evaluateRelevance.mockResolvedValue({ relevant: false, score: 2 });

    const config = createBaseConfig();

    await runContentJob(config, { dryMode: false, lang: 'english' });

    expect(logger.info).toHaveBeenCalledWith('No relevant test item found after relevance checks');
    expect(generate).not.toHaveBeenCalled();
  });

  it('should respect maxItems', async () => {
    const config = createBaseConfig({
      maxItems: 2,
      fetchItems: jest.fn().mockResolvedValue([
        { title: 'Item 1', content: 'Content 1', id: '1' },
        { title: 'Item 2', content: 'Content 2', id: '2' },
        { title: 'Item 3', content: 'Content 3', id: '3' },
      ]),
    });

    await runContentJob(config, { dryMode: false, lang: 'english' });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('should respect maxCandidates', async () => {
    evaluateRelevance.mockResolvedValue({ relevant: false, score: 2 });

    const config = createBaseConfig({
      maxCandidates: 1,
      fetchItems: jest.fn().mockResolvedValue([
        { title: 'Item 1', content: 'Content 1', id: '1' },
        { title: 'Item 2', content: 'Content 2', id: '2' },
      ]),
    });

    await runContentJob(config, { dryMode: false, lang: 'english' });

    expect(evaluateRelevance).toHaveBeenCalledTimes(1);
  });

  it('should call enrichItem before creating prompt', async () => {
    const config = createBaseConfig({
      enrichItem: jest.fn().mockResolvedValue({ title: 'Enriched', content: 'Extra data', id: '1' }),
      fetchItems: jest.fn().mockResolvedValue([{ title: 'Item 1', id: '1' }]),
    });

    await runContentJob(config, { dryMode: false, lang: 'english' });

    expect(config.enrichItem).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
    expect(config.createPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Enriched', content: 'Extra data' }),
      'english'
    );
  });

  it('should use custom send when provided', async () => {
    const customSend = jest.fn().mockResolvedValue(undefined);
    const config = createBaseConfig({ send: customSend });

    await runContentJob(config, { dryMode: false, lang: 'english' });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(customSend).toHaveBeenCalledWith('Generated summary', expect.objectContaining({ id: '1' }));
  });

  it('should delay between multiple items', async () => {
    const config = createBaseConfig({
      maxItems: 2,
      delayBetweenItems: 5000,
    });

    await runContentJob(config, { dryMode: false, lang: 'english' });

    expect(delay).toHaveBeenCalledWith(5000);
    expect(delay).toHaveBeenCalledTimes(1);
  });

  it('should not delay after last item', async () => {
    const config = createBaseConfig({
      maxItems: 2,
      delayBetweenItems: 5000,
      fetchItems: jest.fn().mockResolvedValue([{ title: 'Item 1', id: '1' }]),
    });

    await runContentJob(config, { dryMode: false, lang: 'english' });

    expect(delay).not.toHaveBeenCalled();
  });

  it('should work without cleanup', async () => {
    const config = createBaseConfig();
    delete config.cleanup;

    await runContentJob(config, { dryMode: false, lang: 'english' });

    expect(generate).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    const config = createBaseConfig({
      fetchItems: jest.fn().mockRejectedValue(new Error('Fetch failed')),
    });

    await runContentJob(config, { dryMode: false, lang: 'english' });

    expect(logger.error).toHaveBeenCalledWith('Error processing test item', { error: 'Fetch failed' });
  });

  it('should default maxItems to 1', async () => {
    const config = createBaseConfig();

    await runContentJob(config, { dryMode: false, lang: 'english' });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});
