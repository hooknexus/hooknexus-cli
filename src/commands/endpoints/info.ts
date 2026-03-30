import { Command } from 'commander';
import { logger, createSpinner, colorEndpointStatus } from '../../utils/logger';
import { isAuthenticated, getConfig } from '../../utils/config';
import { formatDate, getEndpointStatus } from '../../utils/format';
import { api } from '../../services/api';

export const infoEndpointCommand = new Command('info')
  .description('Show endpoint details')
  .argument('<id>', 'Endpoint ID')
  .option('--json', 'Output in JSON format')
  .action(async (id: string, options) => {
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.info("Run 'hooknexus login' to authenticate.");
      process.exit(1);
    }

    const spinner = createSpinner('Fetching endpoint...').start();

    try {
      const endpoint = await api.getEndpoint(id);
      spinner.stop();

      const config = getConfig();
      const webhookUrl = `${config.apiUrl}/h/${endpoint.id}`;
      const status = getEndpointStatus(endpoint);

      if (options.json) {
        logger.jsonLine({ ...endpoint, url: webhookUrl, status });
        return;
      }

      logger.newline();
      logger.label('Endpoint', endpoint.id);
      logger.label('URL', webhookUrl);
      logger.label('Alias', endpoint.alias || '-');
      logger.label('Status', colorEndpointStatus(status));
      logger.label('Created', formatDate(endpoint.createdAt));
      logger.label('Expires', endpoint.expiresAt ? formatDate(endpoint.expiresAt) : 'Never');
      logger.label('Requests', String(endpoint.requestCount) + ' total');
      logger.label('Last Request', endpoint.lastRequestAt ? formatDate(endpoint.lastRequestAt) : 'Never');
      logger.newline();
    } catch (error) {
      spinner.fail('Failed to fetch endpoint');
      const err = error as Error;
      logger.error(err.message);
      process.exit(1);
    }
  });
