import { Command } from 'commander';
import chalk from 'chalk';
import { logger, colorMethod, colorStatus } from '../../utils/logger';
import { isAuthenticated, getConfig } from '../../utils/config';
import { resolveSingleEndpoint } from '../../utils/endpoints';
import { formatDuration } from '../../utils/format';
import { WebSocketManager } from '../../services/websocket';
import { RequestForwarder, validateTargetUrl } from '../../services/forwarder';
import type { ReplayDispatchPayload, WebhookRequest } from '../../types';

export const forwardCommand = new Command('forward')
  .alias('fwd')
  .description('Forward webhook requests to a local server')
  .argument('[endpoint]', 'Endpoint ID to listen to')
  .requiredOption('-t, --to <url>', 'Target URL to forward requests to')
  .option('--preserve-path', 'Preserve the original request path')
  .option('--allow-external', 'Allow forwarding to non-localhost URLs')
  .option('-H, --header <headers...>', 'Additional headers (format: "Key: Value")')
  .option('--timeout <ms>', 'Request timeout in milliseconds', '30000')
  .option('--json', 'Output in JSON format')
  .option('-q, --quiet', 'Minimal output')
  .action(async (endpointId: string | undefined, options) => {
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.info("Run 'hooknexus login' to authenticate.");
      process.exit(1);
    }

    // Validate target URL
    const validation = validateTargetUrl(options.to, options.allowExternal);
    if (!validation.valid) {
      logger.error(validation.error || 'Invalid target URL');
      process.exit(1);
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

    const config = getConfig();
    const timeout = parseInt(options.timeout) || 30000;
    let resolvedEndpointId = endpointId || '';

    try {
      resolvedEndpointId = await resolveSingleEndpoint({
        providedEndpointId: endpointId,
        silent: options.json || options.quiet,
      });
    } catch (error) {
      const err = error as Error;
      logger.error(err.message);
      process.exit(1);
    }

    // Create forwarder
    const forwarder = new RequestForwarder({
      targetUrl: options.to,
      preservePath: options.preservePath || false,
      timeout,
      headers: Object.keys(additionalHeaders).length > 0 ? additionalHeaders : undefined,
    });

    // Display info
    if (!options.json && !options.quiet) {
      logger.newline();
      logger.info(`Listening to endpoint: ${resolvedEndpointId}`);
      logger.label('Webhook URL', `${config.apiUrl}/h/${resolvedEndpointId}`);
      logger.label('Forwarding to', options.to);
      if (options.preservePath) {
        logger.label('Preserve path', 'Yes');
      }
      if (Object.keys(additionalHeaders).length > 0) {
        logger.label('Extra headers', Object.keys(additionalHeaders).join(', '));
      }
      logger.newline();
      logger.info('Connected. Waiting for requests...');
      logger.info('Press Ctrl+C to stop.');
      logger.newline();
    }

    // Stats
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    // Handle incoming requests
    const handleRequest = async (request: WebhookRequest) => {
      totalRequests++;

      const result = await forwarder.forward(request);

      if (options.json) {
        logger.jsonLine({
          request: {
            id: request.id,
            method: request.method,
            size: request.size,
          },
          forward: {
            target: options.to,
            success: result.success,
            statusCode: result.statusCode,
            responseTime: result.responseTime,
            error: result.error,
          },
        });
        return;
      }

      if (result.success) {
        successfulRequests++;

        if (options.quiet) {
          const time = new Date().toLocaleTimeString();
          logger.log(
            `[${time}] ${colorMethod(request.method)} ${colorStatus(result.statusCode!)} ${formatDuration(result.responseTime)}`
          );
        } else {
          logger.log(
            `[${new Date().toLocaleString()}] ${colorMethod(request.method)} -> ${options.to}`
          );
          logger.log(
            `  Status: ${colorStatus(result.statusCode!)} ${result.statusMessage} (${formatDuration(result.responseTime)})`
          );

          // Show truncated response
          if (result.body) {
            const truncated = result.body.length > 100
              ? result.body.slice(0, 100) + '...'
              : result.body;
            logger.log(`  Response: ${truncated}`);
          }
          logger.newline();
        }
      } else {
        failedRequests++;

        if (options.quiet) {
          const time = new Date().toLocaleTimeString();
          logger.log(
            `[${time}] ${colorMethod(request.method)} ${chalk.red('ERR')} ${result.error}`
          );
        } else {
          logger.log(
            `[${new Date().toLocaleString()}] ${colorMethod(request.method)} -> ${options.to}`
          );
          if (result.statusCode) {
            logger.error(`  Error: ${result.statusCode} ${result.statusMessage || 'Request failed'}`);
          } else {
            logger.error(`  Error: ${result.error}`);
          }
          if (result.body) {
            const truncated = result.body.length > 200
              ? result.body.slice(0, 200) + '...'
              : result.body;
            logger.log(`  Response: ${truncated}`);
          }
          logger.newline();
        }
      }
    };

    const handleReplay = async (payload: ReplayDispatchPayload) => {
      totalRequests++;

      const result = await forwarder.forward(payload.request, {
        mode: 'replay',
        captureBody: false,
      });

      if (options.json) {
        logger.jsonLine({
          replay: {
            replayId: payload.replayId,
            sourceRequestId: payload.sourceRequestId,
            target: options.to,
            dispatchedAt: payload.dispatchedAt,
            success: result.success,
            statusCode: result.statusCode,
            responseTime: result.responseTime,
            error: result.error,
          },
          request: {
            id: payload.request.id,
            method: payload.request.method,
            size: payload.request.size,
          },
        });
        return;
      }

      const replayLabel = `Replay ${colorMethod(payload.request.method)} -> ${options.to}`;

      if (result.success) {
        successfulRequests++;

        if (options.quiet) {
          const time = new Date().toLocaleTimeString();
          logger.log(`[${time}] REPLAY ${colorStatus(result.statusCode!)} ${formatDuration(result.responseTime)}`);
        } else {
          logger.log(`[${new Date().toLocaleString()}] ${replayLabel}`);
          logger.log(
            `  Status: ${colorStatus(result.statusCode!)} ${result.statusMessage} (${formatDuration(result.responseTime)})`
          );
          logger.log(`  Source: ${payload.sourceRequestId}`);
          logger.newline();
        }
      } else {
        failedRequests++;

        if (options.quiet) {
          const time = new Date().toLocaleTimeString();
          logger.log(`[${time}] REPLAY ${chalk.red('ERR')} ${result.error}`);
        } else {
          logger.log(`[${new Date().toLocaleString()}] ${replayLabel}`);
          if (result.statusCode) {
            logger.error(`  Error: ${result.statusCode} ${result.statusMessage || 'Request failed'}`);
          } else {
            logger.error(`  Error: ${result.error}`);
          }
          logger.log(`  Source: ${payload.sourceRequestId}`);
          logger.newline();
        }
      }
    };

    // Create WebSocket manager
    const manager = new WebSocketManager(resolvedEndpointId, {
      clientType: 'cli',
      clientMode: 'forward',
    });

    manager.on('connected', () => {
      if (!options.json && !options.quiet) {
        logger.debug('WebSocket connected');
      }
    });

    manager.on('disconnected', () => {
      if (!options.json && !options.quiet) {
        logger.warn('Connection lost, reconnecting...');
      }
    });

    manager.on('request', (request: WebhookRequest) => {
      handleRequest(request);
    });

    manager.on('replay', (payload: ReplayDispatchPayload) => {
      handleReplay(payload);
    });

    manager.on('error', (error: Error) => {
      logger.error(`WebSocket error: ${error.message}`);
    });

    manager.connect();

    // Handle graceful shutdown
    const cleanup = () => {
      manager.disconnect();

      if (!options.json && !options.quiet) {
        logger.newline();
        logger.info('Stopping forwarder...');
        logger.newline();
        logger.log('Session Summary:');
        logger.label('Total requests', String(totalRequests));
        logger.label('Successful', String(successfulRequests));
        logger.label('Failed', String(failedRequests));
        logger.newline();
      }

      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });
