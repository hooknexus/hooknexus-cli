import { Command } from 'commander';
import open from 'open';
import { logger, createSpinner, colorPlan } from '../../utils/logger';
import { isAuthenticated, getConfig } from '../../utils/config';
import { formatDate } from '../../utils/format';
import { api } from '../../services/api';

const accountInfoCommand = new Command('info')
  .description('Show account information')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.info("Run 'hooknexus login' to authenticate.");
      process.exit(1);
    }

    const spinner = createSpinner('Fetching account info...').start();

    try {
      const user = await api.getCurrentUser();
      spinner.stop();

      if (options.json) {
        logger.jsonLine(user);
        return;
      }

      logger.newline();
      logger.header('Account Information');
      logger.divider();
      logger.label('Email', user.email);
      logger.label('Name', user.name || '-');
      logger.label('Plan', colorPlan(user.plan));
      logger.label('Member Since', formatDate(user.createdAt));
      logger.newline();
    } catch (error) {
      spinner.fail('Failed to fetch account info');
      const err = error as Error;
      logger.error(err.message);
      process.exit(1);
    }
  });

const subscriptionCommand = new Command('subscription')
  .alias('sub')
  .description('Show subscription status')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.info("Run 'hooknexus login' to authenticate.");
      process.exit(1);
    }

    const spinner = createSpinner('Fetching subscription...').start();

    try {
      const [user, subscription] = await Promise.all([
        api.getCurrentUser(),
        api.getSubscription(),
      ]);
      spinner.stop();

      if (options.json) {
        logger.jsonLine({ user, subscription });
        return;
      }

      logger.newline();
      logger.header('Subscription Status');
      logger.divider();
      logger.label('Plan', colorPlan(user.plan));

      if (subscription) {
        logger.label('Status', subscription.status);
        logger.label('Billing Cycle', subscription.billingCycle);
        if (subscription.currentPeriodEnd) {
          logger.label('Next Billing', formatDate(subscription.currentPeriodEnd));
        }
        if (subscription.cancelledAt) {
          logger.label('Cancelled At', formatDate(subscription.cancelledAt));
        }
      } else if (user.plan === 'free') {
        logger.newline();
        logger.info('You are on the Free plan.');
        logger.log('Upgrade to Plus or above for more features:');
        logger.log('  - Permanent URLs');
        logger.log('  - Extended log retention');
        logger.log('  - API keys');
        logger.newline();
        logger.info("Run 'hooknexus upgrade' to upgrade your plan.");
      }

      logger.newline();
    } catch (error) {
      spinner.fail('Failed to fetch subscription');
      const err = error as Error;
      logger.error(err.message);
      process.exit(1);
    }
  });

const upgradeCommand = new Command('upgrade')
  .description('Open the pricing page to upgrade your plan')
  .action(async () => {
    const config = getConfig();
    const pricingUrl = `${config.webUrl}/pricing`;

    logger.info('Opening pricing page...');

    try {
      await open(pricingUrl);
      logger.success(`Opened ${pricingUrl}`);
    } catch {
      logger.warn('Could not open browser automatically.');
      logger.log(`Please visit: ${pricingUrl}`);
    }
  });

export const accountCommand = new Command('account')
  .description('Manage your account')
  .addCommand(accountInfoCommand)
  .addCommand(subscriptionCommand)
  .addCommand(upgradeCommand);

// Export upgrade command separately for top-level access
export { upgradeCommand };
