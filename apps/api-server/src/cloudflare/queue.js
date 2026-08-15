const { createRepositories } = require('./repositories');
const { failShinyOcrJob, processShinyOcrJob } = require('./services/shiny-ocr');

async function consumeShinyOcrQueue(batch, env, options = {}) {
  const repositories = options.repositories || createRepositories(env);
  const fetchImpl = options.fetchImpl || fetch;

  await Promise.all(batch.messages.map(async (message) => {
    const jobId = message.body?.jobId;
    if (!jobId) {
      message.ack();
      return;
    }
    try {
      await processShinyOcrJob(env, jobId, repositories, fetchImpl);
      message.ack();
    } catch (error) {
      console.error('Shiny OCR Queue job failed:', { jobId, attempt: message.attempts, error });
      const status = Number(error?.status || 0);
      const isPermanent = status >= 400 && status < 500;
      if (!isPermanent && Number(message.attempts || 1) < 3) {
        message.retry({ delaySeconds: Math.min(60, 5 * (2 ** (Number(message.attempts || 1) - 1))) });
        return;
      }
      try {
        await failShinyOcrJob(env, jobId, error, fetchImpl);
      } catch (callbackError) {
        console.error('Failed to deliver terminal shiny OCR error:', { jobId, error: callbackError });
      }
      message.ack();
    }
  }));
}

module.exports = { consumeShinyOcrQueue };
