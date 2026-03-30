#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig } from './utils/config';

// Import commands
import { loginCommand, logoutCommand, whoamiCommand } from './commands/auth';
import { endpointsCommand } from './commands/endpoints';
import { listenCommand, forwardCommand } from './commands/listen';
import { requestsCommand } from './commands/requests';
import { configCommand } from './commands/config';
import { accountCommand, upgradeCommand } from './commands/account';

const VERSION = '1.0.0';

// ASCII art logo
const logo = `
  _   _             _    _   _
 | | | | ___   ___ | | _| \\ | | _____  ___   _ ___
 | |_| |/ _ \\ / _ \\| |/ /  \\| |/ _ \\ \\/ / | | / __|
 |  _  | (_) | (_) |   <| |\\  |  __/>  <| |_| \\__ \\
 |_| |_|\\___/ \\___/|_|\\_\\_| \\_|\\___/_/\\_\\\\__,_|___/
`;

async function main() {
  const program = new Command();

  // Check for color support
  const config = getConfig();
  if (!config.color || process.env.HOOKNEXUS_NO_COLOR) {
    chalk.level = 0;
  }

  program
    .name('hooknexus')
    .description('HookNexus CLI - Real-time Webhook Debugging')
    .version(VERSION, '-v, --version', 'Show version number')
    .option('--no-color', 'Disable colored output')
    .option('--json', 'Output in JSON format (where supported)')
    .showSuggestionAfterError()
    .showHelpAfterError()
    .hook('preAction', (thisCommand) => {
      // Handle global options
      if (thisCommand.opts().noColor) {
        chalk.level = 0;
      }
    });

  // Auth commands (top-level)
  program.addCommand(loginCommand);
  program.addCommand(logoutCommand);
  program.addCommand(whoamiCommand);

  // Endpoint management
  program.addCommand(endpointsCommand);

  // Listen and forward (core functionality)
  program.addCommand(listenCommand);
  program.addCommand(forwardCommand);

  // Request management
  program.addCommand(requestsCommand);

  // Account and subscription
  program.addCommand(accountCommand);
  program.addCommand(upgradeCommand); // Also at top level for convenience

  // Configuration
  program.addCommand(configCommand);

  // Custom help
  program.on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  $ hooknexus login');
    console.log('  $ hooknexus endpoints create');
    console.log('  $ hooknexus listen');
    console.log('  $ hooknexus forward --to http://localhost:3000/webhooks');
    console.log('');
    console.log('Documentation: https://docs.hooknexus.com');
  });

  // Show logo and help if no command provided
  if (process.argv.length === 2) {
    if (config.color) {
      console.log(chalk.cyan(logo));
    } else {
      console.log(logo);
    }
    program.outputHelp();
    process.exit(0);
  }

  // Parse arguments
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    // Commander already handles most errors
    if (process.env.HOOKNEXUS_DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason) => {
  if (process.env.HOOKNEXUS_DEBUG) {
    console.error('Unhandled rejection:', reason);
  }
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  if (process.env.HOOKNEXUS_DEBUG) {
    console.error('Uncaught exception:', error);
  }
  process.exit(1);
});

main();
