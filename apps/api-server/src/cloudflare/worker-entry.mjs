import workerModule from './worker.js';

const app = workerModule.createWorkerApp();

export class FeebasBoardStreamDurableObject extends workerModule.FeebasBoardStreamDurableObject {}

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};
