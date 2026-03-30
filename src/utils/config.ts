import Conf from 'conf';
import type { Config } from '../types';

// Business API (endpoints, webhooks, replay)
const DEFAULT_API_URL = 'https://api.hooknexus.com';
// Auth/Billing API (Infra-Hub)
const DEFAULT_AUTH_URL = 'https://api.infra-hub.hooknexus.com';
// Web frontend
const DEFAULT_WEB_URL = 'https://hooknexus.com';

const defaultConfig: Config = {
  apiUrl: DEFAULT_API_URL,
  authUrl: DEFAULT_AUTH_URL,
  webUrl: DEFAULT_WEB_URL,
  authToken: null,
  outputFormat: 'pretty',
  color: true,
  timeout: 30000,
};

const store = new Conf<Config>({
  projectName: 'hooknexus-cli',
  defaults: defaultConfig,
});

export function getConfig(): Config {
  // Environment variables override stored config
  return {
    apiUrl: process.env.HOOKNEXUS_API_URL || store.get('apiUrl'),
    authUrl: process.env.HOOKNEXUS_AUTH_URL || store.get('authUrl'),
    webUrl: process.env.HOOKNEXUS_WEB_URL || store.get('webUrl'),
    authToken: process.env.HOOKNEXUS_TOKEN || store.get('authToken'),
    outputFormat: store.get('outputFormat'),
    color: process.env.HOOKNEXUS_NO_COLOR ? false : store.get('color'),
    timeout: store.get('timeout'),
  };
}

export function setConfig<K extends keyof Config>(key: K, value: Config[K]): void {
  store.set(key, value);
}

export function getConfigValue<K extends keyof Config>(key: K): Config[K] {
  return store.get(key);
}

export function resetConfig(): void {
  store.clear();
}

export function getConfigPath(): string {
  return store.path;
}

export function isAuthenticated(): boolean {
  const config = getConfig();
  return !!config.authToken;
}

export function getAuthToken(): string | null {
  return getConfig().authToken;
}

export function setAuthToken(token: string): void {
  store.set('authToken', token);
}

export function clearAuthToken(): void {
  store.set('authToken', null);
}

export function getAllConfigEntries(): Array<{ key: string; value: any }> {
  const config = getConfig();
  return Object.entries(config).map(([key, value]) => ({
    key,
    value: key === 'authToken' && value ? '****' + (value as string).slice(-4) : value,
  }));
}
