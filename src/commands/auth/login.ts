import { Command } from 'commander';
import inquirer from 'inquirer';
import { logger, createSpinner } from '../../utils/logger';
import { setAuthToken, isAuthenticated } from '../../utils/config';
import { startOAuthFlow } from '../../services/auth';
import { api } from '../../services/api';

export const loginCommand = new Command('login')
  .description('Login to HookNexus')
  .option('--github', 'Login with GitHub')
  .action(async () => {
    // Check if already logged in
    if (isAuthenticated()) {
      try {
        const user = await api.getCurrentUser();
        logger.info(`Already logged in as ${user.email}`);

        const { relogin } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'relogin',
            message: 'Do you want to login with a different account?',
            default: false,
          },
        ]);

        if (!relogin) {
          return;
        }
      } catch {
        // Token is invalid, continue with login
      }
    }

    // Start OAuth flow
    const spinner = createSpinner('Waiting for authentication...').start();

    const result = await startOAuthFlow('github');

    if (result.success && result.token) {
      setAuthToken(result.token);
      spinner.succeed('Authentication successful');

      try {
        const user = await api.getCurrentUser();
        logger.success(`Successfully logged in as ${user.email}`);
      } catch {
        logger.success('Successfully logged in');
      }
    } else {
      spinner.fail('Authentication failed');
      logger.error(result.error || 'Login failed');
      process.exit(1);
    }
  });
