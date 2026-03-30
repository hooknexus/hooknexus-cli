import { Command } from 'commander';
import { logger, createSpinner, colorMethod } from '../../utils/logger';
import { isAuthenticated, getConfig } from '../../utils/config';
import { createRequestsTable, formatRequestDetails } from '../../utils/format';
import { api } from '../../services/api';
import { RequestForwarder, validateTargetUrl } from '../../services/forwarder';

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function handleRequestLookupError(
  spinner: ReturnType<typeof createSpinner> | null,
  id: string,
  actionLabel: string,
  error: unknown
): never {
  if (spinner) {
    spinner.clear();
    spinner.stop();
  }

  const err = error as Error;
  if (err.message === 'Request not found') {
    logger.error(`Could not ${actionLabel} because the request was not found.`);
    logger.newline();
    if (!isUuidLike(id)) {
      logger.info('The request ID looks incomplete or mistyped.');
      logger.log('Use `hooknexus requests ls <endpoint-id>` to copy the full request ID and try again.');
    } else {
      logger.info('Check that the request still exists and is within the current retention window.');
      logger.log('If needed, run `hooknexus requests ls <endpoint-id>` to confirm the request ID.');
    }
    process.exit(1);
  }

  if (spinner) {
    spinner.fail(`Failed to ${actionLabel}`);
  }
  logger.error(err.message);
  process.exit(1);
}

const listRequestsCommand = new Command('list')
  .alias('ls')
  .description('List requests for an endpoint')
  .argument('<endpoint>', 'Endpoint ID')
  .option('-l, --limit <number>', 'Number of requests to show', '20')
  .option('-p, --page <number>', 'Page number', '1')
  .option('--json', 'Output in JSON format')
  .action(async (endpointId: string, options) => {
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.info("Run 'hooknexus login' to authenticate.");
      process.exit(1);
    }

    const spinner = createSpinner('Fetching requests...').start();

    try {
      const response = await api.listRequests(endpointId, {
        page: parseInt(options.page),
        limit: parseInt(options.limit),
      });
      spinner.stop();

      if (options.json) {
        logger.jsonLine(response);
        return;
      }

      if (response.requests.length === 0) {
        logger.info('No requests found for this endpoint');
        return;
      }

      logger.log(createRequestsTable(response.requests));
      logger.newline();
      logger.info(`Showing ${response.requests.length} of ${response.total} requests (page ${response.page})`);
    } catch (error) {
      spinner.fail('Failed to fetch requests');
      const err = error as Error;
      logger.error(err.message);
      process.exit(1);
    }
  });

const showRequestCommand = new Command('show')
  .description('Show request details')
  .argument('<id>', 'Request ID')
  .option('--json', 'Output in JSON format')
  .action(async (id: string, options) => {
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.info("Run 'hooknexus login' to authenticate.");
      process.exit(1);
    }

  try {
    const request = await api.getRequest(id);

    if (options.json) {
      logger.jsonLine(request);
      return;
    }

    logger.log(formatRequestDetails(request));
  } catch (error) {
    handleRequestLookupError(null, id, 'fetch the request', error);
  }
  });

const bodyRequestCommand = new Command('body')
  .description('Show only the request body')
  .argument('<id>', 'Request ID')
  .option('--json', 'Output body as JSON when possible')
  .action(async (id: string, options) => {
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.info("Run 'hooknexus login' to authenticate.");
      process.exit(1);
    }

    try {
      const request = await api.getRequest(id);

      if (!request.body) {
        logger.info('This request does not contain a body.');
        return;
      }

      if (options.json || request.contentType.includes('json')) {
        try {
          logger.json(JSON.parse(request.body));
          return;
        } catch {
          // Fall back to raw text when body is not valid JSON.
        }
      }

      logger.log(request.body);
    } catch (error) {
      handleRequestLookupError(null, id, 'fetch the request body', error);
    }
  });

const replayRequestCommand = new Command('replay')
  .description('Replay a request to a target URL')
  .argument('<id>', 'Request ID')
  .requiredOption('-t, --to <url>', 'Target URL to replay to')
  .option('--allow-external', 'Allow replaying to non-localhost URLs')
  .option('-H, --header <headers...>', 'Additional headers (format: "Key: Value")')
  .option('--timeout <ms>', 'Request timeout in milliseconds', '30000')
  .option('--json', 'Output in JSON format')
  .action(async (id: string, options) => {
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.info("Run 'hooknexus login' to authenticate.");
      process.exit(1);
    }

    try {
      const user = await api.getCurrentUser();

      if (user.plan === 'free') {
        logger.error('Request replay is available on the Plus plan and above.');
        logger.newline();
        logger.info('Upgrade to Plus to unlock:');
        logger.log('  - Request replay');
        logger.log('  - Permanent URLs');
        logger.log('  - Extended log retention');
        logger.newline();
        logger.info(`Run 'hooknexus upgrade' or visit ${getConfig().webUrl}/pricing`);
        process.exit(1);
      }
    } catch (error) {
      logger.error('Failed to check subscription');
      const err = error as Error;
      logger.error(err.message);
      process.exit(1);
    }

    // Validate target URL
    const validation = validateTargetUrl(options.to, options.allowExternal);
    if (!validation.valid) {
      logger.error(validation.error || 'Invalid target URL');
      process.exit(1);
    }

    // Fetch request
    let request;

    try {
      request = await api.getRequest(id);
    } catch (error) {
      handleRequestLookupError(null, id, 'replay the request', error);
    }

    // Parse additional headers
    const additionalHeaders: Record<string, string> = {};
    if (options.header) {
      for (const h of options.header) {
        const colonIndex = h.indexOf(':');
        if (colonIndex > 0) {
          const key = h.slice(0, colonIndex).trim();
          const value = h.slice(colonIndex + 1).trim();
          additionalHeaders[key] = value;
        }
      }
    }

    // Replay request
    const forwarder = new RequestForwarder({
      targetUrl: options.to,
      preservePath: false,
      timeout: parseInt(options.timeout) || 30000,
      headers: Object.keys(additionalHeaders).length > 0 ? additionalHeaders : undefined,
    });

    const spinner = createSpinner('Replaying request...');

    try {
      spinner.start();
      const result = await forwarder.forward(request);
      spinner.stop();

      if (options.json) {
        logger.jsonLine({
          request: { id: request.id, method: request.method },
          replay: {
            target: options.to,
            success: result.success,
            statusCode: result.statusCode,
            responseTime: result.responseTime,
            body: result.body,
            error: result.error,
          },
        });
        return;
      }

      if (result.success) {
        logger.success(`Replayed ${colorMethod(request.method)} request to ${options.to}`);
        logger.label('Status', `${result.statusCode} ${result.statusMessage}`);
        logger.label('Response Time', `${result.responseTime}ms`);

        if (result.body) {
          logger.newline();
          logger.header('Response:');
          try {
            const parsed = JSON.parse(result.body);
            logger.json(parsed);
          } catch {
            logger.log(result.body.slice(0, 1000));
            if (result.body.length > 1000) {
              logger.info('(response truncated)');
            }
          }
        }
      } else {
        const failureSummary = result.statusCode
          ? `${result.statusCode} ${result.statusMessage || 'Request failed'}`
          : result.error || 'Unknown error';
        logger.error(`Failed to replay request: ${failureSummary}`);
        if (result.body) {
          logger.newline();
          logger.header('Response:');
          logger.log(result.body.slice(0, 1000));
          if (result.body.length > 1000) {
            logger.info('(response truncated)');
          }
        }
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Replay failed');
      const err = error as Error;
      logger.error(err.message);
      process.exit(1);
    }
  });

export const requestsCommand = new Command('requests')
  .alias('req')
  .description('View and replay requests')
  .addCommand(listRequestsCommand)
  .addCommand(showRequestCommand)
  .addCommand(bodyRequestCommand)
  .addCommand(replayRequestCommand)
  .action(function (this: Command) {
    if (this.args.length > 0) {
      logger.newline();
      logger.error(`Unknown request command '${this.args[0]}'`);
      logger.newline();
      this.outputHelp({ error: true });
      process.exit(1);
    }

    logger.newline();
    logger.header('Request Commands');
    logger.divider();
    this.outputHelp();
    logger.newline();
    logger.info("Tip: run 'hooknexus requests ls <endpoint-id>' to view recent requests.");
  });
