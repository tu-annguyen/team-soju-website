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
  let errorSpy;
  let warnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

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
    expect(warnSpy).toHaveBeenCalledWith(
      'Shiny OCR Queue delivery failed; retry scheduled:',
      expect.objectContaining({ jobId: 'ss-1', attempt: 1, nextAttempt: 2, delaySeconds: 5 })
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('records and acknowledges a failure after three deliveries', async () => {
    const error = new Error('terminal');
    processShinyOcrJob.mockRejectedValueOnce(error);
    const item = message(3);
    await consumeShinyOcrQueue({ messages: [item] }, {}, options);
    expect(failShinyOcrJob).toHaveBeenCalledWith({}, 'ss-1', error, options.fetchImpl);
    expect(item.ack).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Shiny OCR Queue job failed permanently:',
      expect.objectContaining({ jobId: 'ss-1', attempt: 3, message: 'terminal' })
    );
  });

  it('does not retry permanent input failures', async () => {
    const error = Object.assign(new Error('invalid screenshot'), { status: 400 });
    processShinyOcrJob.mockRejectedValueOnce(error);
    const item = message(1);
    await consumeShinyOcrQueue({ messages: [item] }, {}, options);
    expect(item.retry).not.toHaveBeenCalled();
    expect(failShinyOcrJob).toHaveBeenCalledWith({}, 'ss-1', error, options.fetchImpl);
    expect(item.ack).toHaveBeenCalled();
  });
});
