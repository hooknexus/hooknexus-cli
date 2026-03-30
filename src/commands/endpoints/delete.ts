import { Command } from 'commander';
import inquirer from 'inquirer';
import { logger, createSpinner } from '../../utils/logger';
import { isAuthenticated } from '../../utils/config';
import { api } from '../../services/api';

export const deleteEndpointCommand = new Command('delete')
  .alias('rm')
  .description('Delete an endpoint')
  .argument('<id>', 'Endpoint ID')
  .option('-f, --force', 'Skip confirmation')
  .action(async (id: string, options) => {
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.info("Run 'hooknexus login' to authenticate.");
      process.exit(1);
    }

    // Confirm deletion
    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to delete endpoint ${id}?`,
          default: false,
        },
      ]);

      if (!confirm) {
        logger.info('Deletion cancelled');
        return;
      }
    }

    const spinner = createSpinner('Deleting endpoint...').start();

    try {
      await api.deleteEndpoint(id);
      spinner.succeed('Endpoint deleted');
    } catch (error) {
      spinner.fail('Failed to delete endpoint');
      const err = error as Error;
      logger.error(err.message);
      process.exit(1);
    }
  });
