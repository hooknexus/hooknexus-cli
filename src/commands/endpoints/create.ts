import { Command } from 'commander';
import { logger, createSpinner } from '../../utils/logger';
import { isAuthenticated, getConfig } from '../../utils/config';
import { api } from '../../services/api';

export const createEndpointCommand = new Command('create')
  .alias('new')
  .description('Create a new endpoint')
  .option('-p, --permanent', 'Create a permanent endpoint (Plus feature)')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.info("Run 'hooknexus login' to authenticate.");
      process.exit(1);
    }

    const spinner = createSpinner('Creating endpoint...').start();

    try {
      const endpoint = await api.createEndpoint({
        isPermanent: options.permanent,
      });

      spinner.stop();

      const config = getConfig();
      const webhookUrl = `${config.apiUrl}/h/${endpoint.id}`;

      if (options.json) {
        logger.jsonLine({ ...endpoint, url: webhookUrl });
        return;
      }

      logger.success(`Created endpoint: ${endpoint.id}`);
      logger.label('URL', webhookUrl);

      if (endpoint.expiresAt) {
        logger.label('Expires', new Date(endpoint.expiresAt).toLocaleString());
      } else {
        logger.label('Expires', 'Never (permanent)');
      }

      logger.newline();
      logger.info('Copy the URL above and use it as your webhook endpoint.');
    } catch (error) {
      spinner.fail('Failed to create endpoint');
      const err = error as Error;
      logger.error(err.message);
      process.exit(1);
    }
  });
