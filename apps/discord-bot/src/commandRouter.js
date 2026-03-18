const memberHandlers = require('./handlers/memberHandlers');
const shinyHandlers = require('./handlers/shinyHandlers');
const statsHandlers = require('./handlers/statsHandlers');

function getCommandHandlers(commandName) {
  const handlerMap = {
    'addmember': memberHandlers,
    'editmember': memberHandlers,
    'deletemember': memberHandlers,
    'reactivatemember': memberHandlers,
    'member': memberHandlers,
    'addshiny': shinyHandlers,
    'addshinyscreenshot': shinyHandlers,
    'editshiny': shinyHandlers,
    'deleteshiny': shinyHandlers,
    'failshiny': shinyHandlers,
    'shiny': shinyHandlers,
    'shinies': shinyHandlers,
    'myshinies': shinyHandlers,
    'leaderboard': statsHandlers,
    'stats': statsHandlers,
  };

  const handlers = handlerMap[commandName];
  if (!handlers) {
    throw new Error(`No handler found for command: ${commandName}`);
  }

  return handlers;
}

function getCommandHandler(commandName) {
  const handlers = getCommandHandlers(commandName);

  const handlerNameMap = {
    'addmember': 'handleAddMember',
    'editmember': 'handleEditMember',
    'deletemember': 'handleDeleteMember',
    'reactivatemember': 'handleReactivateMember',
    'member': 'handleGetMember',
    'addshiny': 'handleAddShiny',
    'addshinyscreenshot': 'handleAddShinyScreenshot',
    'editshiny': 'handleEditShiny',
    'deleteshiny': 'handleDeleteShiny',
    'failshiny': 'handleFailShiny',
    'shiny': 'handleGetShiny',
    'shinies': 'handleGetShinies',
    'myshinies': 'handleGetMyShinies',
    'leaderboard': 'handleLeaderboard',
    'stats': 'handleStats',
  };

  const handlerName = handlerNameMap[commandName];
  if (!handlers[handlerName]) {
    throw new Error(`No handler function found for command: ${commandName}`);
  }

  return handlers[handlerName];
}

module.exports = {
  getCommandHandlers,
  getCommandHandler,
};
