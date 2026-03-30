import { Command } from 'commander';
import { logger, createSpinner, colorPlan } from '../../utils/logger';
import { isAuthenticated, getConfig } from '../../utils/config';
import { formatDate } from '../../utils/format';
import { api } from '../../services/api';

export const whoamiCommand = new Command('whoami')
  .description('Show current user info')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.info("Run 'hooknexus login' to authenticate.");
      process.exit(1);
    }

    const spinner = createSpinner('Fetching user info...').start();

    try {
      const user = await api.getCurrentUser();
      spinner.stop();

      if (options.json) {
        logger.jsonLine(user);
        return;
      }

      logger.newline();
      logger.label('Email', user.email);
      logger.label('Name', user.name || '-');
      logger.label('Plan', colorPlan(user.plan));
      logger.label('Joined', formatDate(user.createdAt));
      logger.newline();
    } catch (error) {
      spinner.fail('Failed to fetch user info');
      const err = error as Error;
      logger.error(err.message);
      process.exit(1);
    }
  });
