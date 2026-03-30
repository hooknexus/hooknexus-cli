import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { listEndpointsCommand } from './list';
import { createEndpointCommand } from './create';
import { deleteEndpointCommand } from './delete';
import { infoEndpointCommand } from './info';

export const endpointsCommand = new Command('endpoints')
  .alias('ep')
  .description('Manage webhook endpoints')
  .addCommand(listEndpointsCommand)
  .addCommand(createEndpointCommand)
  .addCommand(deleteEndpointCommand)
  .addCommand(infoEndpointCommand)
  .action(function (this: Command) {
    if (this.args.length > 0) {
      logger.newline();
      logger.error(`Unknown endpoint command '${this.args[0]}'`);
      logger.newline();
      this.outputHelp({ error: true });
      process.exit(1);
    }

    logger.newline();
    logger.header('Endpoint Commands');
    logger.divider();
    this.outputHelp();
    logger.newline();
    logger.info("Tip: run 'hooknexus endpoints ls' to view all endpoints.");
  });
