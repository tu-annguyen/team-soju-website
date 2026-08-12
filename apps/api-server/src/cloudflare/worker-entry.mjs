import workerModule from './worker.js';
import queueModule from './queue.js';

const app = workerModule.createWorkerApp();

export class FeebasBoardStreamDurableObject extends workerModule.FeebasBoardStreamDurableObject {}

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
  queue(batch, env) {
    return queueModule.consumeShinyOcrQueue(batch, env);
  },
};
