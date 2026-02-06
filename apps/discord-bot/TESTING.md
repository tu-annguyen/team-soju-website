# Discord Bot Unit Testing Guide

## Overview

A complete Jest unit test suite has been set up for the Team Soju Discord Bot with **36 passing tests** covering handlers and utilities.

## What Was Created

### 1. **Jest Configuration** ([jest.config.cjs](jest.config.cjs))
- Configured for Node.js environment
- Collects coverage reports
- Automatically runs setup file before tests

### 2. **Test Setup** ([test/setup.js](test/setup.js))
- Mocks dotenv to prevent `.env` loading during tests
- Sets up test environment variables

### 3. **Mock Fixtures** ([test/fixtures/mockInteraction.js](test/fixtures/mockInteraction.js))
- `createMockInteraction()` - Creates a mock Discord interaction with all necessary methods
- `createMockUser()` - Creates mock Discord user objects
- Provides helper functions for test setup

### 4. **Test Files**

#### [test/memberHandlers.test.js](test/memberHandlers.test.js)
Tests for member command handlers (11 tests):
- `handleAddMember` - Adding new team members
- `handleGetMember` - Retrieving member info
- `handleEditMember` - Updating member details
- `handleDeleteMember` - Removing members
- `handleReactivateMember` - Restoring deleted members

Coverage includes:
- Successful operations with proper embeds
- API error handling
- Default value handling
- Discord mention integration

#### [test/statsHandlers.test.js](test/statsHandlers.test.js)
Tests for stats command handlers (6 tests):
- `handleLeaderboard` - Top trainers display
- `handleStats` - Team-wide statistics

Coverage includes:
- Default and custom limits
- Empty result handling
- Secret shiny tracking
- API error handling

#### [test/utils.test.js](test/utils.test.js)
Tests for utility functions (19 tests):
- `getCommandHandlers()` - Router to handler modules
- `getCommandHandler()` - Route to specific handler functions
- Unknown command error handling

## Running Tests

### Run all tests once
```bash
npm test
```

### Watch mode (auto-rerun on changes)
```bash
npm run test:watch
```

### Run specific test file
```bash
npm test -- memberHandlers.test.js
```

### Generate coverage report
```bash
npm test -- --coverage
```

The coverage report is generated in the `coverage/` directory.

## Current Coverage

**Test Results: 36 tests passing, 0 failures**

Coverage by module:
- **memberHandlers.js**: 92.64% lines, 100% functions
- **statsHandlers.js**: 100% lines, 100% functions
- **utils.js**: 12.17% lines (by design - only tests exports)

## Key Testing Patterns

### Mocking Discord Interactions
```javascript
const { createMockInteraction } = require('./fixtures/mockInteraction');

const interaction = createMockInteraction({
  options: {
    ign: 'tunacore',
    rank: 'Champion'
  }
});

await handleAddMember(interaction);
expect(interaction.editReply).toHaveBeenCalledWith(
  expect.objectContaining({ embeds: expect.any(Array) })
);
```

### Mocking API Calls
```javascript
jest.mock('axios');
const axios = require('axios');

axios.post.mockResolvedValue({
  data: { data: { id: 'member-123', ign: 'tunacore' } }
});

await handleAddMember(interaction);
expect(axios.post).toHaveBeenCalledWith(...);
```

### Testing Error Cases
```javascript
axios.get.mockRejectedValue({
  response: { status: 404 }
});

await handleGetMember(interaction);
expect(interaction.editReply).toHaveBeenCalledWith(
  expect.objectContaining({ content: expect.stringContaining('not found') })
);
```

## Adding New Tests

### For a new handler function:
1. Create test file: `test/[handlerName].test.js`
2. Mock dependencies (axios, discord.js)
3. Test happy path, error cases, and edge cases
4. Use `createMockInteraction()` to create test interactions
5. Run `npm test` to verify

### Example template:
```javascript
const { handleMyFunction } = require('../src/handlers/myHandlers');
const { createMockInteraction } = require('./fixtures/mockInteraction');

jest.mock('axios');
const axios = require('axios');

describe('My Handlers', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should do something', async () => {
    const interaction = createMockInteraction({
      options: { /* your options */ }
    });

    axios.get.mockResolvedValue({ data: { data: { /* response */ } } });

    await handleMyFunction(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ /* expectations */ })
    );
  });
});
```

## Notes

- **Discord.js**: The EmbedBuilder is mocked to avoid needing the full Discord.js initialization
- **Axios**: HTTP calls are mocked to avoid hitting real APIs during tests
- **dotenv**: Loading is mocked to prevent `.env` file dependency during testing
- Each test suite resets mocks in `beforeEach()` to ensure test isolation

## Troubleshooting

### "TypeError: interaction.options.getString is not a function"
Ensure you're using `createMockInteraction()` from the fixtures, and pass options via the `options` property:
```javascript
createMockInteraction({ options: { ign: 'player' } })
```

### "Cannot find module" errors
Make sure the path in your require statement matches the actual file location, accounting for the test file being in `test/` subdirectory.

### Mock not working as expected
Remember to call `jest.resetAllMocks()` in `beforeEach()` to clear mock state between tests.

## Next Steps

Consider adding tests for:
- **shinyHandlers.js** - Complete shiny command test suite (currently 0% coverage)
- **commands.js** - Validate command builders and options
- **app.js** - Integration tests for the Discord client
- Edge cases and error scenarios for handlers

---

**Test Framework**: Jest 30.x  
**Node Environment**: Node.js compatible  
**Last Updated**: February 2026
