const { handlePokemonAutocomplete, handleShinyAutocomplete } = require('./shinyCore');
const { enhanceAsyncScreenshotPayload } = require('./shinyEditing');
const {
  handleAddShiny,
  handleDeleteShiny,
  handleEditShiny,
  handleFailShiny,
  handleGetMyShinies,
  handleGetShinies,
  handleGetShiny,
} = require('./shinyCommands');
const {
  handleShinyComponent,
  handleShinyEditModal,
  isShinyComponent,
  isShinyEditModal,
} = require('./shinyInteractions');
const { handleAddShinyScreenshot } = require('./shinyScreenshotHandler');

module.exports = {
  enhanceAsyncScreenshotPayload,
  handleAddShiny,
  handleAddShinyScreenshot,
  handleDeleteShiny,
  handleEditShiny,
  handleFailShiny,
  handleGetMyShinies,
  handlePokemonAutocomplete,
  handleShinyAutocomplete,
  handleGetShinies,
  handleGetShiny,
  handleShinyComponent,
  handleShinyEditModal,
  isShinyComponent,
  isShinyEditModal,
};
