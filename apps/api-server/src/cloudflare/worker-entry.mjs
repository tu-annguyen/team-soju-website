import workerModule from './worker.js';

const app = workerModule.createWorkerApp();

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};
