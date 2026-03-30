import inquirer from 'inquirer';
import { api } from '../services/api';
import type { Endpoint } from '../types';
import { getConfig } from './config';
import { logger, createSpinner } from './logger';

interface ResolveListenEndpointsOptions {
  providedEndpointIds: string[];
  listenAll?: boolean;
  silent?: boolean;
}

interface ResolveSingleEndpointOptions {
  providedEndpointId?: string;
  silent?: boolean;
}

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function formatEndpointChoice(endpoint: Endpoint): string {
  const details = [
    endpoint.alias ? `alias: ${endpoint.alias}` : null,
    endpoint.isPermanent ? 'permanent' : null,
    endpoint.expiresAt
      ? `expires ${new Date(endpoint.expiresAt).toLocaleString()}`
      : null,
  ].filter(Boolean);

  if (details.length === 0) {
    return endpoint.id;
  }

  return `${endpoint.id} (${details.join(', ')})`;
}

async function fetchEndpoints(): Promise<Endpoint[]> {
  const spinner = createSpinner('Fetching endpoints...').start();

  try {
    const response = await api.listEndpoints();
    spinner.stop();
    return response.endpoints;
  } catch (error) {
    spinner.fail('Failed to fetch endpoints');
    throw error;
  }
}

async function createEndpointForImmediateUse(silent = false): Promise<Endpoint> {
  if (!silent) {
    logger.info('No endpoints found. Creating one automatically...');
  }

  const spinner = createSpinner('Creating endpoint...').start();

  try {
    const endpoint = await api.createEndpoint();
    spinner.stop();

    if (!silent) {
      const webhookUrl = `${getConfig().apiUrl}/h/${endpoint.id}`;
      logger.success(`Created endpoint: ${endpoint.id}`);
      logger.label('URL', webhookUrl);
      logger.newline();
    }

    return endpoint;
  } catch (error) {
    spinner.fail('Failed to create endpoint');
    throw error;
  }
}

async function ensureEndpointsAvailable(silent = false): Promise<Endpoint[]> {
  const endpoints = await fetchEndpoints();
  if (endpoints.length > 0) {
    return endpoints;
  }

  const endpoint = await createEndpointForImmediateUse(silent);
  return [endpoint];
}

export async function resolveListenEndpoints(
  options: ResolveListenEndpointsOptions
): Promise<string[]> {
  if (options.providedEndpointIds.length > 0) {
    return options.providedEndpointIds;
  }

  const endpoints = await ensureEndpointsAvailable(options.silent);

  if (options.listenAll) {
    return endpoints.map((endpoint) => endpoint.id);
  }

  if (endpoints.length === 1) {
    return [endpoints[0].id];
  }

  if (!isInteractiveTerminal()) {
    throw new Error(
      'No endpoint specified. Run this command in an interactive terminal or pass endpoint IDs explicitly.'
    );
  }

  const { selectedEndpointIds } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedEndpointIds',
      message: 'Choose endpoints to listen to:',
      choices: endpoints.map((endpoint) => ({
        name: formatEndpointChoice(endpoint),
        value: endpoint.id,
      })),
      validate: (value: string[]) =>
        value.length > 0 || 'Select at least one endpoint.',
    },
  ]);

  return selectedEndpointIds;
}

export async function resolveSingleEndpoint(
  options: ResolveSingleEndpointOptions = {}
): Promise<string> {
  if (options.providedEndpointId) {
    return options.providedEndpointId;
  }

  const endpoints = await ensureEndpointsAvailable(options.silent);

  if (endpoints.length === 1) {
    return endpoints[0].id;
  }

  if (!isInteractiveTerminal()) {
    throw new Error(
      'No endpoint specified. Run this command in an interactive terminal or pass an endpoint ID explicitly.'
    );
  }

  const { selectedEndpointId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedEndpointId',
      message: 'Choose an endpoint:',
      choices: endpoints.map((endpoint) => ({
        name: formatEndpointChoice(endpoint),
        value: endpoint.id,
      })),
    },
  ]);

  return selectedEndpointId;
}
