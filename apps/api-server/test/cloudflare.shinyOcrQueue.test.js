jest.mock('../src/cloudflare/services/shiny-ocr', () => ({
  processShinyOcrJob: jest.fn(),
  failShinyOcrJob: jest.fn(),
}));

const { failShinyOcrJob, processShinyOcrJob } = require('../src/cloudflare/services/shiny-ocr');
const { consumeShinyOcrQueue } = require('../src/cloudflare/queue');

function message(attempts = 1) {
  return { body: { jobId: 'ss-1' }, attempts, ack: jest.fn(), retry: jest.fn() };
}

describe('shiny OCR Queue consumer', () => {
  const options = { repositories: {}, fetchImpl: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('acknowledges successful jobs', async () => {
    const item = message();
    await consumeShinyOcrQueue({ messages: [item] }, {}, options);
    expect(processShinyOcrJob).toHaveBeenCalledWith({}, 'ss-1', {}, options.fetchImpl);
    expect(item.ack).toHaveBeenCalled();
  });

  it('retries transient failures with backoff', async () => {
    processShinyOcrJob.mockRejectedValueOnce(new Error('temporary'));
    const item = message(1);
    await consumeShinyOcrQueue({ messages: [item] }, {}, options);
    expect(item.retry).toHaveBeenCalledWith({ delaySeconds: 5 });
    expect(item.ack).not.toHaveBeenCalled();
  });

  it('records and acknowledges a failure after three deliveries', async () => {
    const error = new Error('terminal');
    processShinyOcrJob.mockRejectedValueOnce(error);
    const item = message(3);
    await consumeShinyOcrQueue({ messages: [item] }, {}, options);
    expect(failShinyOcrJob).toHaveBeenCalledWith({}, 'ss-1', error, options.fetchImpl);
    expect(item.ack).toHaveBeenCalled();
  });
});
