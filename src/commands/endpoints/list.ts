import { Command } from 'commander';
import { logger, createSpinner } from '../../utils/logger';
import { isAuthenticated } from '../../utils/config';
import { createEndpointsTable } from '../../utils/format';
import { api } from '../../services/api';

export const listEndpointsCommand = new Command('list')
  .alias('ls')
  .description('List all endpoints')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.info("Run 'hooknexus login' to authenticate.");
      process.exit(1);
    }

    const spinner = createSpinner('Fetching endpoints...').start();

    try {
      const response = await api.listEndpoints();
      spinner.stop();

      if (options.json) {
        logger.jsonLine(response);
        return;
      }

      if (response.endpoints.length === 0) {
        logger.info('No endpoints found');
        logger.info("Run 'hooknexus endpoints create' to create one.");
        return;
      }

      logger.log(createEndpointsTable(response.endpoints));
      logger.newline();
      logger.info(`Showing ${response.total} endpoint${response.total === 1 ? '' : 's'}`);
    } catch (error) {
      spinner.fail('Failed to fetch endpoints');
      const err = error as Error;
      logger.error(err.message);
      process.exit(1);
    }
  });
