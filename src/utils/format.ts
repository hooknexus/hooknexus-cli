import Table from 'cli-table3';
import chalk from 'chalk';
import { getConfig } from './config';
import type { Endpoint, WebhookRequest } from '../types';

function shouldUseColor(): boolean {
  return getConfig().color && !process.env.HOOKNEXUS_NO_COLOR;
}

// Format date
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString();
}

// Format relative time
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(dateStr);
}

// Format bytes
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Format duration in ms
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Truncate string
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

// Create table for endpoints
export function createEndpointsTable(endpoints: Endpoint[]): string {
  const useColor = shouldUseColor();

  const table = new Table({
    head: ['Endpoint ID', 'Alias', 'Status', 'Requests', 'Created'],
    style: {
      head: useColor ? ['cyan'] : [],
      border: useColor ? ['gray'] : [],
    },
  });

  for (const ep of endpoints) {
    const status = getEndpointStatus(ep);
    const statusDisplay = useColor
      ? status === 'Active'
        ? chalk.green(status)
        : chalk.red(status)
      : status;

    table.push([
      ep.id,
      ep.alias || '-',
      statusDisplay,
      String(ep.requestCount),
      formatRelativeTime(ep.createdAt),
    ]);
  }

  return table.toString();
}

// Create table for requests
export function createRequestsTable(requests: WebhookRequest[]): string {
  const useColor = shouldUseColor();

  const table = new Table({
    head: ['Request ID', 'Method', 'Time', 'Size'],
    style: {
      head: useColor ? ['cyan'] : [],
      border: useColor ? ['gray'] : [],
    },
  });

  const methodColors: Record<string, (s: string) => string> = {
    GET: chalk.green,
    POST: chalk.blue,
    PUT: chalk.yellow,
    PATCH: chalk.magenta,
    DELETE: chalk.red,
  };

  for (const req of requests) {
    const methodDisplay = useColor
      ? (methodColors[req.method] || chalk.white)(req.method)
      : req.method;

    table.push([
      req.id,
      methodDisplay,
      formatRelativeTime(req.createdAt),
      formatBytes(req.size),
    ]);
  }

  return table.toString();
}

// Get endpoint status
export function getEndpointStatus(endpoint: Endpoint): string {
  if (!endpoint.expiresAt) return 'Active';
  const expiresAt = new Date(endpoint.expiresAt);
  return expiresAt > new Date() ? 'Active' : 'Expired';
}

// Format request details
export function formatRequestDetails(request: WebhookRequest): string {
  const useColor = shouldUseColor();
  const lines: string[] = [];

  // Header
  lines.push(useColor ? chalk.gray('─'.repeat(60)) : '─'.repeat(60));
  lines.push(
    `[${formatDate(request.createdAt)}] ${useColor ? chalk.bold(request.method) : request.method} (id: ${request.id})`
  );
  lines.push(useColor ? chalk.gray('─'.repeat(60)) : '─'.repeat(60));

  // Headers
  lines.push(useColor ? chalk.bold('Headers:') : 'Headers:');
  for (const [key, value] of Object.entries(request.headers)) {
    const formattedKey = useColor ? chalk.cyan(key) : key;
    lines.push(`  ${formattedKey}: ${truncate(value, 50)}`);
  }

  // Query params
  if (Object.keys(request.query).length > 0) {
    lines.push('');
    lines.push(useColor ? chalk.bold('Query:') : 'Query:');
    for (const [key, value] of Object.entries(request.query)) {
      const formattedKey = useColor ? chalk.cyan(key) : key;
      lines.push(`  ${formattedKey}: ${value}`);
    }
  }

  // Body
  if (request.body) {
    lines.push('');
    lines.push(useColor ? chalk.bold('Body:') : 'Body:');

    try {
      const parsed = JSON.parse(request.body);
      lines.push(JSON.stringify(parsed, null, 2).split('\n').map(l => '  ' + l).join('\n'));
    } catch {
      lines.push('  ' + request.body.slice(0, 500));
      if (request.body.length > 500) {
        lines.push(useColor ? chalk.gray('  ... (truncated)') : '  ... (truncated)');
      }
    }
  }

  return lines.join('\n');
}

// Format JSON for display
export function formatJson(data: any): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

// Create config table
export function createConfigTable(entries: Array<{ key: string; value: any }>): string {
  const useColor = shouldUseColor();

  const table = new Table({
    head: ['Key', 'Value'],
    style: {
      head: useColor ? ['cyan'] : [],
      border: useColor ? ['gray'] : [],
    },
  });

  for (const entry of entries) {
    table.push([entry.key, String(entry.value)]);
  }

  return table.toString();
}
