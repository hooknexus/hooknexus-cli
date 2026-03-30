import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { getConfig } from './config';

type LogLevel = 'debug' | 'info' | 'success' | 'warn' | 'error';

function shouldUseColor(): boolean {
  return getConfig().color && !process.env.HOOKNEXUS_NO_COLOR;
}

function formatMessage(level: LogLevel, message: string): string {
  const useColor = shouldUseColor();

  const prefixes: Record<LogLevel, string> = {
    debug: useColor ? chalk.gray('[DEBUG]') : '[DEBUG]',
    info: useColor ? chalk.blue('ℹ') : 'i',
    success: useColor ? chalk.green('✓') : '✓',
    warn: useColor ? chalk.yellow('⚠') : '!',
    error: useColor ? chalk.red('✗') : '✗',
  };

  const colors: Record<LogLevel, (s: string) => string> = {
    debug: useColor ? chalk.gray : (s) => s,
    info: useColor ? chalk.blue : (s) => s,
    success: useColor ? chalk.green : (s) => s,
    warn: useColor ? chalk.yellow : (s) => s,
    error: useColor ? chalk.red : (s) => s,
  };

  return `${prefixes[level]} ${colors[level](message)}`;
}

export const logger = {
  debug(message: string, ...args: any[]): void {
    if (process.env.HOOKNEXUS_DEBUG) {
      console.log(formatMessage('debug', message), ...args);
    }
  },

  info(message: string): void {
    console.log(formatMessage('info', message));
  },

  success(message: string): void {
    console.log(formatMessage('success', message));
  },

  warn(message: string): void {
    console.log(formatMessage('warn', message));
  },

  error(message: string, error?: Error): void {
    console.log(formatMessage('error', message));
    if (error && process.env.HOOKNEXUS_DEBUG) {
      console.error(chalk.gray(error.stack || error.message));
    }
  },

  log(message: string): void {
    console.log(message);
  },

  newline(): void {
    console.log();
  },

  // Formatted output helpers
  label(label: string, value: string): void {
    const useColor = shouldUseColor();
    const formattedLabel = useColor ? chalk.gray(label + ':') : label + ':';
    console.log(`${formattedLabel.padEnd(useColor ? 25 : 15)} ${value}`);
  },

  header(text: string): void {
    const useColor = shouldUseColor();
    console.log(useColor ? chalk.bold(text) : text);
  },

  divider(char = '─', length = 60): void {
    const useColor = shouldUseColor();
    const line = char.repeat(length);
    console.log(useColor ? chalk.gray(line) : line);
  },

  json(data: any): void {
    console.log(JSON.stringify(data, null, 2));
  },

  jsonLine(data: any): void {
    console.log(JSON.stringify(data));
  },
};

// Spinner helper
export function createSpinner(text: string): Ora {
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots',
  });
}

// HTTP method colors
export function colorMethod(method: string): string {
  if (!shouldUseColor()) return method;

  const colors: Record<string, (s: string) => string> = {
    GET: chalk.green,
    POST: chalk.blue,
    PUT: chalk.yellow,
    PATCH: chalk.magenta,
    DELETE: chalk.red,
    HEAD: chalk.cyan,
    OPTIONS: chalk.gray,
  };

  const colorFn = colors[method.toUpperCase()] || chalk.white;
  return colorFn(method);
}

// Status code colors
export function colorStatus(status: number): string {
  if (!shouldUseColor()) return String(status);

  if (status >= 200 && status < 300) {
    return chalk.green(String(status));
  } else if (status >= 300 && status < 400) {
    return chalk.yellow(String(status));
  } else if (status >= 400 && status < 500) {
    return chalk.red(String(status));
  } else if (status >= 500) {
    return chalk.bgRed.white(String(status));
  }
  return String(status);
}

// Plan colors
export function colorPlan(plan: string): string {
  if (!shouldUseColor()) return plan;

  const colors: Record<string, (s: string) => string> = {
    free: chalk.gray,
    plus: chalk.cyan,
    pro: chalk.blue,
    team: chalk.magenta,
  };

  const colorFn = colors[plan.toLowerCase()] || chalk.white;
  return colorFn(plan.charAt(0).toUpperCase() + plan.slice(1));
}

// Endpoint status colors
export function colorEndpointStatus(status: string): string {
  if (!shouldUseColor()) return status;

  if (status.toLowerCase() === 'active') {
    return chalk.green(status);
  } else if (status.toLowerCase() === 'expired') {
    return chalk.red(status);
  }
  return chalk.yellow(status);
}
