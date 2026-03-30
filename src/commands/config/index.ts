import { Command } from 'commander';
import inquirer from 'inquirer';
import { logger } from '../../utils/logger';
import {
  getConfig,
  setConfig,
  resetConfig,
  getConfigPath,
  getConfigValue,
  getAllConfigEntries,
} from '../../utils/config';
import { createConfigTable } from '../../utils/format';
import type { Config } from '../../types';

const setConfigCommand = new Command('set')
  .description('Set a configuration value')
  .argument('<key>', 'Configuration key')
  .argument('<value>', 'Configuration value')
  .action(async (key: string, value: string) => {
    const validKeys: (keyof Config)[] = [
      'apiUrl',
      'authUrl',
      'webUrl',
      'outputFormat',
      'color',
      'timeout',
    ];

    if (!validKeys.includes(key as keyof Config)) {
      logger.error(`Invalid configuration key: ${key}`);
      logger.info(`Valid keys: ${validKeys.join(', ')}`);
      process.exit(1);
    }

    // Parse value based on key
    let parsedValue: any = value;

    if (key === 'color') {
      parsedValue = value === 'true' || value === '1';
    } else if (key === 'timeout') {
      parsedValue = parseInt(value);
      if (isNaN(parsedValue) || parsedValue < 1000 || parsedValue > 120000) {
        logger.error('Timeout must be a number between 1000 and 120000 (ms)');
        process.exit(1);
      }
    } else if (key === 'outputFormat') {
      if (!['pretty', 'json', 'minimal'].includes(value)) {
        logger.error('Output format must be: pretty, json, or minimal');
        process.exit(1);
      }
    }

    setConfig(key as keyof Config, parsedValue);
    logger.success(`Config updated: ${key} = ${parsedValue}`);
  });

const getConfigCommand = new Command('get')
  .description('Get a configuration value')
  .argument('<key>', 'Configuration key')
  .action(async (key: string) => {
    const config = getConfig();

    if (!(key in config)) {
      logger.error(`Unknown configuration key: ${key}`);
      process.exit(1);
    }

    const value = config[key as keyof Config];
    logger.log(String(value));
  });

const listConfigCommand = new Command('list')
  .alias('ls')
  .description('List all configuration values')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    const entries = getAllConfigEntries();

    if (options.json) {
      const config = getConfig();
      // Mask auth token in JSON output
      const output = { ...config, authToken: config.authToken ? '****' : null };
      logger.jsonLine(output);
      return;
    }

    logger.log(createConfigTable(entries));
    logger.newline();
    logger.info(`Config file: ${getConfigPath()}`);
  });

const resetConfigCommand = new Command('reset')
  .description('Reset all configuration to defaults')
  .option('-f, --force', 'Skip confirmation')
  .action(async (options) => {
    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to reset all configuration?',
          default: false,
        },
      ]);

      if (!confirm) {
        logger.info('Reset cancelled');
        return;
      }
    }

    resetConfig();
    logger.success('Configuration reset to defaults');
  });

const pathConfigCommand = new Command('path')
  .description('Show configuration file path')
  .action(async () => {
    logger.log(getConfigPath());
  });

export const configCommand = new Command('config')
  .description('Manage CLI configuration')
  .addCommand(setConfigCommand)
  .addCommand(getConfigCommand)
  .addCommand(listConfigCommand)
  .addCommand(resetConfigCommand)
  .addCommand(pathConfigCommand);
