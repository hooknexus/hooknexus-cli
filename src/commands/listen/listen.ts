import { Command } from 'commander';
import { logger, colorMethod } from '../../utils/logger';
import { isAuthenticated, getConfig } from '../../utils/config';
import { formatRequestDetails, formatBytes } from '../../utils/format';
import { resolveListenEndpoints } from '../../utils/endpoints';
import { WebSocketManager, MultiWebSocketManager } from '../../services/websocket';
import type { ReplayDispatchPayload, WebhookRequest } from '../../types';

export const listenCommand = new Command('listen')
  .description('Listen for incoming webhook requests')
  .argument('[endpoints...]', 'Endpoint IDs to listen to')
  .option('--all', 'Listen to all endpoints')
  .option('--json', 'Output requests in JSON format')
  .option('-q, --quiet', 'Minimal output (one line per request)')
  .action(async (endpointIds: string[], options) => {
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.info("Run 'hooknexus login' to authenticate.");
      process.exit(1);
    }

    const config = getConfig();
    let endpoints: string[] = [];

    try {
      endpoints = await resolveListenEndpoints({
        providedEndpointIds: endpointIds,
        listenAll: options.all,
        silent: options.json || options.quiet,
      });
    } catch (error) {
      const err = error as Error;
      logger.error(err.message);
      process.exit(1);
    }

    // Display listening info
    if (!options.json && !options.quiet) {
      logger.newline();
      if (endpoints.length === 1) {
        const ep = endpoints[0];
        logger.info(`Listening to endpoint: ${ep}`);
        logger.label('URL', `${config.apiUrl}/h/${ep}`);
      } else {
        logger.info(`Listening to ${endpoints.length} endpoints...`);
        for (const ep of endpoints) {
          logger.log(`  - ${ep}`);
        }
      }
      logger.newline();
      logger.info('Connected via WebSocket. Waiting for requests...');
      logger.info('Press Ctrl+C to stop listening.');
      logger.newline();
    }

    // Handle request display
    const handleRequest = (epId: string, request: WebhookRequest) => {
      if (options.json) {
        logger.jsonLine({ endpoint: epId, ...request });
        return;
      }

      if (options.quiet) {
        // Minimal output
        const time = new Date(request.createdAt).toLocaleTimeString();
        logger.log(`[${time}] ${colorMethod(request.method)} ${request.id.slice(0, 8)} ${formatBytes(request.size)}`);
        return;
      }

      // Full output
      logger.log(formatRequestDetails(request));
      logger.newline();
    };

    const handleReplay = (epId: string, payload: ReplayDispatchPayload) => {
      const request = payload.request;

      if (options.json) {
        logger.jsonLine({
          endpoint: epId,
          replay: {
            replayId: payload.replayId,
            sourceRequestId: payload.sourceRequestId,
            dispatchedAt: payload.dispatchedAt,
            target: payload.target,
          },
          request,
        });
        return;
      }

      if (options.quiet) {
        const time = new Date(payload.dispatchedAt).toLocaleTimeString();
        logger.log(`[${time}] REPLAY ${colorMethod(request.method)} ${request.id.slice(0, 8)} ${formatBytes(request.size)}`);
        return;
      }

      logger.info(`Replay dispatched to this listener from request ${payload.sourceRequestId.slice(0, 8)}...`);
      logger.log(formatRequestDetails(request));
      logger.newline();
    };

    // Create WebSocket manager(s)
    if (endpoints.length === 1) {
      // Single endpoint
      const manager = new WebSocketManager(endpoints[0], {
        clientType: 'cli',
        clientMode: 'listen',
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
        handleRequest(endpoints[0], request);
      });

      manager.on('replay', (payload: ReplayDispatchPayload) => {
        handleReplay(endpoints[0], payload);
      });

      manager.on('error', (error: Error) => {
        logger.error(`WebSocket error: ${error.message}`);
      });

      manager.connect();

      // Handle graceful shutdown
      const cleanup = () => {
        if (!options.json && !options.quiet) {
          logger.newline();
          logger.info('Stopping listener...');
        }
        manager.disconnect();
        process.exit(0);
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
    } else {
      // Multiple endpoints
      const manager = new MultiWebSocketManager({
        clientType: 'cli',
        clientMode: 'listen',
      });

      manager.on('connected', (endpointId: string) => {
        if (!options.json && !options.quiet) {
          logger.debug(`Connected to ${endpointId}`);
        }
      });

      manager.on('disconnected', (endpointId: string) => {
        if (!options.json && !options.quiet) {
          logger.warn(`Lost connection to ${endpointId}, reconnecting...`);
        }
      });

      manager.on('request', (endpointId: string, request: WebhookRequest) => {
        handleRequest(endpointId, request);
      });

      manager.on('replay', (endpointId: string, payload: ReplayDispatchPayload) => {
        handleReplay(endpointId, payload);
      });

      manager.on('error', (endpointId: string, error: Error) => {
        logger.error(`Error on ${endpointId}: ${error.message}`);
      });

      // Connect to all endpoints
      for (const ep of endpoints) {
        manager.addEndpoint(ep);
      }

      // Handle graceful shutdown
      const cleanup = () => {
        if (!options.json && !options.quiet) {
          logger.newline();
          logger.info('Stopping listener...');
        }
        manager.disconnectAll();
        process.exit(0);
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
    }
  });
