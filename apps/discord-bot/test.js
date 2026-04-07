/**
 * Verification script for Discord bot structure
 * Validates worker, commands, and handlers load correctly
 */

console.log('🧪 Discord Bot Structure Verification\n');

try {
  console.log('Checking worker structure...');

  // Verify commands
  const { COMMANDS } = require('./src/commands');
  console.log(`✓ Commands loaded: ${COMMANDS.length} commands registered`);
  COMMANDS.forEach((cmd, idx) => {
    console.log(`  ${idx + 1}. /${cmd.name}`);
  });

  // Verify utils
  const utils = require('./src/utils');
  console.log(`\n✓ Utils loaded`);
  console.log(`  - registerSlashCommands: ${typeof utils.registerSlashCommands}`);
  console.log(`  - getCommandHandler: ${typeof utils.getCommandHandler}`);
  console.log(`  - validateEnvironment: ${typeof utils.validateEnvironment}`);

  // Verify handlers
  const memberHandlers = require('./src/handlers/memberHandlers');
  const shinyHandlers = require('./src/handlers/shinyHandlers');
  const statsHandlers = require('./src/handlers/statsHandlers');

  console.log(`\n✓ Handlers loaded`);
  console.log(`  - memberHandlers: ${Object.keys(memberHandlers).length} functions`);
  console.log(`    ${Object.keys(memberHandlers).join(', ')}`);
  console.log(`  - shinyHandlers: ${Object.keys(shinyHandlers).length} functions`);
  console.log(`    ${Object.keys(shinyHandlers).join(', ')}`);
  console.log(`  - statsHandlers: ${Object.keys(statsHandlers).length} functions`);
  console.log(`    ${Object.keys(statsHandlers).join(', ')}`);

  // Verify worker structure
  const worker = require('./src/worker');
  console.log(`\n✓ Worker loaded`);
  console.log(`  - fetch: ${typeof worker.fetch}`);
  console.log(`  - registerCommandsIfNeeded: ${typeof worker.registerCommandsIfNeeded}`);

  console.log(`\n✅ All verification checks passed!`);
  console.log(`\n📝 Next steps:`);
  console.log(`  1. Copy .env.example to .env`);
  console.log(`  2. Add your Discord credentials to .env`);
  console.log(`  3. Run: npm run dev`);

} catch (error) {
  console.error(`\n❌ Verification failed:`);
  console.error(`  ${error.message}`);
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error(`\nMissing module. Try running: npm install`);
  }
  process.exit(1);
}
