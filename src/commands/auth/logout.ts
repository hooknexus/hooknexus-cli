import { Command } from 'commander';
import { logger, createSpinner } from '../../utils/logger';
import { clearAuthToken, isAuthenticated } from '../../utils/config';
import { api } from '../../services/api';

export const logoutCommand = new Command('logout')
  .description('Logout from HookNexus')
  .action(async () => {
    if (!isAuthenticated()) {
      logger.info('Not logged in');
      return;
    }

    const spinner = createSpinner('Logging out...').start();

    try {
      // Try to logout on server side
      await api.logout();
    } catch {
      // Ignore server-side logout errors
    }

    // Clear local token
    clearAuthToken();
    spinner.succeed('Successfully logged out');
  });
