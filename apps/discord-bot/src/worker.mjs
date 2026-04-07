import workerModule from './worker.js';

const worker = workerModule.default ?? workerModule;
let commandRegistrationPromise = null;

async function ensureCommandsRegistered(env) {
  if (env?.REGISTER_COMMANDS_ON_START !== 'true') {
    return;
  }

  if (!commandRegistrationPromise) {
    commandRegistrationPromise = Promise.resolve(worker.registerCommandsIfNeeded(env)).catch(error => {
      commandRegistrationPromise = null;
      console.error('Command registration failed:', error);
      throw error;
    });
  }

  await commandRegistrationPromise;
}

export default {
  async fetch(request, env, ctx) {
    await ensureCommandsRegistered(env);
    return worker.fetch(request, env, ctx);
  },
};
