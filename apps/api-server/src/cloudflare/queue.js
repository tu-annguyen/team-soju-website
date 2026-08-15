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
      const attempt = Number(message.attempts || 1);
      const status = Number(error?.status || 0);
      const isPermanent = status >= 400 && status < 500;
      if (!isPermanent && attempt < 3) {
        const delaySeconds = Math.min(60, 5 * (2 ** (attempt - 1)));
        console.warn('Shiny OCR Queue delivery failed; retry scheduled:', {
          jobId,
          attempt,
          nextAttempt: attempt + 1,
          delaySeconds,
          code: error?.code,
          message: String(error?.message || error),
        });
        message.retry({ delaySeconds });
        return;
      }
      console.error('Shiny OCR Queue job failed permanently:', {
        jobId,
        attempt,
        code: error?.code,
        message: String(error?.message || error),
      });
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
