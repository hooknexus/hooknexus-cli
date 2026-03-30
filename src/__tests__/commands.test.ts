import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const spinners: any[] = [];

  return {
    api: {
      getCurrentUser: vi.fn(),
      logout: vi.fn(),
      listEndpoints: vi.fn(),
      createEndpoint: vi.fn(),
      getEndpoint: vi.fn(),
      deleteEndpoint: vi.fn(),
      listRequests: vi.fn(),
      getRequest: vi.fn(),
      getSubscription: vi.fn(),
    },
    config: {
      isAuthenticated: vi.fn(),
      getConfig: vi.fn(),
      setConfig: vi.fn(),
      resetConfig: vi.fn(),
      getConfigPath: vi.fn(),
      getConfigValue: vi.fn(),
      getAllConfigEntries: vi.fn(),
      clearAuthToken: vi.fn(),
    },
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      newline: vi.fn(),
      label: vi.fn(),
      header: vi.fn(),
      divider: vi.fn(),
      json: vi.fn(),
      jsonLine: vi.fn(),
    },
    spinnerFactory: vi.fn((text: string) => {
      const spinner = {
        text,
        start: vi.fn().mockReturnThis(),
        stop: vi.fn(),
        fail: vi.fn(),
        succeed: vi.fn(),
        clear: vi.fn(),
      };

      spinners.push(spinner);
      return spinner;
    }),
    spinners,
    inquirerPrompt: vi.fn(),
    open: vi.fn(),
    validateTargetUrl: vi.fn(),
    forward: vi.fn(),
    resolveSingleEndpoint: vi.fn(),
    resolveListenEndpoints: vi.fn(),
    wsConnect: vi.fn(),
    wsDisconnect: vi.fn(),
    multiAddEndpoint: vi.fn(),
    multiDisconnectAll: vi.fn(),
  };
});

vi.mock('../services/api', () => ({
  api: state.api,
}));

vi.mock('../utils/config', () => ({
  isAuthenticated: state.config.isAuthenticated,
  getConfig: state.config.getConfig,
  setConfig: state.config.setConfig,
  resetConfig: state.config.resetConfig,
  getConfigPath: state.config.getConfigPath,
  getConfigValue: state.config.getConfigValue,
  getAllConfigEntries: state.config.getAllConfigEntries,
  clearAuthToken: state.config.clearAuthToken,
}));

vi.mock('../utils/logger', () => ({
  logger: state.logger,
  createSpinner: state.spinnerFactory,
  colorMethod: (value: string) => value,
  colorStatus: (value: number) => String(value),
  colorPlan: (value: string) => value,
  colorEndpointStatus: (value: string) => value,
}));

vi.mock('../utils/endpoints', () => ({
  resolveSingleEndpoint: state.resolveSingleEndpoint,
  resolveListenEndpoints: state.resolveListenEndpoints,
}));

vi.mock('../services/forwarder', () => ({
  RequestForwarder: class {
    async forward(request: unknown) {
      return state.forward(request);
    }
  },
  validateTargetUrl: state.validateTargetUrl,
}));

vi.mock('../services/websocket', () => ({
  WebSocketManager: class {
    on() {
      return this;
    }

    connect() {
      state.wsConnect();
    }

    disconnect() {
      state.wsDisconnect();
    }
  },
  MultiWebSocketManager: class {
    on() {
      return this;
    }

    addEndpoint(endpointId: string) {
      state.multiAddEndpoint(endpointId);
    }

    disconnectAll() {
      state.multiDisconnectAll();
    }
  },
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: state.inquirerPrompt,
  },
}));

vi.mock('open', () => ({
  default: state.open,
}));

function resetState() {
  vi.clearAllMocks();
  state.spinners.length = 0;

  state.config.isAuthenticated.mockReturnValue(true);
  state.config.getConfig.mockReturnValue({
    apiUrl: 'https://api.hooknexus.com',
    authUrl: 'https://api.infra-hub.hooknexus.com',
    webUrl: 'https://hooknexus.com',
    authToken: 'test-token',
    outputFormat: 'pretty',
    color: false,
    timeout: 30000,
  });
  state.config.getConfigPath.mockReturnValue('C:\\mock\\hooknexus.json');
  state.config.getAllConfigEntries.mockReturnValue([
    { key: 'apiUrl', value: 'https://api.hooknexus.com' },
  ]);

  state.validateTargetUrl.mockReturnValue({ valid: true });
  state.resolveSingleEndpoint.mockResolvedValue('ep_123');
  state.resolveListenEndpoints.mockResolvedValue(['ep_123']);
  state.forward.mockResolvedValue({
    success: true,
    statusCode: 200,
    statusMessage: 'OK',
    responseTime: 18,
    body: '{"ok":true}',
  });
}

function createExitError(code?: number): Error {
  return new Error(`process.exit:${code ?? 0}`);
}

async function expectExit(run: () => Promise<unknown>, code = 1) {
  await expect(run()).rejects.toThrow(`process.exit:${code}`);
}

function sampleUser(plan: 'free' | 'plus' = 'free') {
  return {
    id: 'user_123',
    email: 'user@example.com',
    name: 'Test User',
    avatarUrl: null,
    plan,
    createdAt: '2026-03-26T08:00:00.000Z',
  };
}

function sampleEndpoint() {
  return {
    id: 'ep_123',
    userId: 'user_123',
    alias: null,
    isPermanent: false,
    expiresAt: '2026-03-27T08:00:00.000Z',
    createdAt: '2026-03-26T08:00:00.000Z',
    updatedAt: '2026-03-26T08:00:00.000Z',
    requestCount: 2,
    lastRequestAt: '2026-03-26T09:00:00.000Z',
  };
}

function sampleRequest() {
  return {
    id: 'req_123',
    endpointId: 'ep_123',
    method: 'POST',
    path: '/webhook',
    query: {},
    headers: { 'content-type': 'application/json' },
    body: '{"test":true}',
    contentType: 'application/json',
    ip: '127.0.0.1',
    userAgent: 'Vitest',
    size: 13,
    createdAt: '2026-03-26T10:00:00.000Z',
  };
}

beforeEach(() => {
  vi.resetModules();
  resetState();
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw createExitError(code);
  }) as never);
  vi.spyOn(process, 'on').mockImplementation((() => process) as any);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CLI command coverage', () => {
  it('renders whoami as json', async () => {
    state.api.getCurrentUser.mockResolvedValue(sampleUser('plus'));
    const { whoamiCommand } = await import('../commands/auth/whoami');

    await whoamiCommand.parseAsync(['--json'], { from: 'user' });

    expect(state.api.getCurrentUser).toHaveBeenCalledOnce();
    expect(state.logger.jsonLine).toHaveBeenCalledWith(sampleUser('plus'));
  });

  it('logs out and clears the local token even if server logout fails', async () => {
    state.api.logout.mockRejectedValue(new Error('network'));
    const { logoutCommand } = await import('../commands/auth/logout');

    await logoutCommand.parseAsync([], { from: 'user' });

    expect(state.api.logout).toHaveBeenCalledOnce();
    expect(state.config.clearAuthToken).toHaveBeenCalledOnce();
    expect(state.spinners[0].succeed).toHaveBeenCalledWith('Successfully logged out');
  });

  it('shows the free plan upgrade prompt in account subscription', async () => {
    state.api.getCurrentUser.mockResolvedValue(sampleUser('free'));
    state.api.getSubscription.mockResolvedValue(null);
    const { accountCommand } = await import('../commands/account');

    await accountCommand.parseAsync(['subscription'], { from: 'user' });

    expect(state.logger.info).toHaveBeenCalledWith('You are on the Free plan.');
    expect(state.logger.log).toHaveBeenCalledWith('Upgrade to Plus or above for more features:');
  });

  it('opens the pricing page from upgrade', async () => {
    const { upgradeCommand } = await import('../commands/account');

    await upgradeCommand.parseAsync([], { from: 'user' });

    expect(state.open).toHaveBeenCalledWith('https://hooknexus.com/pricing');
    expect(state.logger.success).toHaveBeenCalledWith('Opened https://hooknexus.com/pricing');
  });

  it('updates config values through config set', async () => {
    const { configCommand } = await import('../commands/config');

    await configCommand.parseAsync(['set', 'timeout', '5000'], { from: 'user' });

    expect(state.config.setConfig).toHaveBeenCalledWith('timeout', 5000);
    expect(state.logger.success).toHaveBeenCalledWith('Config updated: timeout = 5000');
  });

  it('allows config set authUrl', async () => {
    const { configCommand } = await import('../commands/config');

    await configCommand.parseAsync(['set', 'authUrl', 'http://localhost:8788'], { from: 'user' });

    expect(state.config.setConfig).toHaveBeenCalledWith('authUrl', 'http://localhost:8788');
    expect(state.logger.success).toHaveBeenCalledWith('Config updated: authUrl = http://localhost:8788');
  });

  it('rejects invalid timeout values in config set', async () => {
    const { configCommand } = await import('../commands/config');

    await expectExit(() => configCommand.parseAsync(['set', 'timeout', '500'], { from: 'user' }));

    expect(state.logger.error).toHaveBeenCalledWith('Timeout must be a number between 1000 and 120000 (ms)');
  });

  it('lists endpoints for an authenticated user', async () => {
    state.api.listEndpoints.mockResolvedValue({ endpoints: [sampleEndpoint()], total: 1 });
    const { endpointsCommand } = await import('../commands/endpoints');

    await endpointsCommand.parseAsync(['list'], { from: 'user' });

    expect(state.api.listEndpoints).toHaveBeenCalledOnce();
    expect(state.logger.info).toHaveBeenCalledWith('Showing 1 endpoint');
  });

  it('creates a permanent endpoint when requested', async () => {
    state.api.createEndpoint.mockResolvedValue({
      ...sampleEndpoint(),
      isPermanent: true,
      expiresAt: null,
    });
    const { endpointsCommand } = await import('../commands/endpoints');

    await endpointsCommand.parseAsync(['create', '--permanent'], { from: 'user' });

    expect(state.api.createEndpoint).toHaveBeenCalledWith({ isPermanent: true });
    expect(state.logger.success).toHaveBeenCalledWith('Created endpoint: ep_123');
  });

  it('cancels endpoint deletion when confirmation is declined', async () => {
    state.inquirerPrompt.mockResolvedValue({ confirm: false });
    const { endpointsCommand } = await import('../commands/endpoints');

    await endpointsCommand.parseAsync(['delete', 'ep_123'], { from: 'user' });

    expect(state.api.deleteEndpoint).not.toHaveBeenCalled();
    expect(state.logger.info).toHaveBeenCalledWith('Deletion cancelled');
  });

  it('shows a helpful message for truncated request ids', async () => {
    state.api.getRequest.mockRejectedValue(new Error('Request not found'));
    const { requestsCommand } = await import('../commands/requests');

    await expectExit(() =>
      requestsCommand.parseAsync(['show', 'd80fcebd-0261-4b4c-a356-441dc55b030'], { from: 'user' })
    );

    expect(state.logger.error).toHaveBeenCalledWith('Could not fetch the request because the request was not found.');
    expect(state.logger.info).toHaveBeenCalledWith('The request ID looks incomplete or mistyped.');
  });

  it('prints the request body as formatted json', async () => {
    state.api.getRequest.mockResolvedValue(sampleRequest());
    const { requestsCommand } = await import('../commands/requests');

    await requestsCommand.parseAsync(['body', 'req_123'], { from: 'user' });

    expect(state.logger.json).toHaveBeenCalledWith({ test: true });
  });

  it('blocks replay on the free plan with an upgrade prompt', async () => {
    state.api.getCurrentUser.mockResolvedValue(sampleUser('free'));
    const { requestsCommand } = await import('../commands/requests');

    await expectExit(() =>
      requestsCommand.parseAsync(['replay', 'req_123', '--to', 'http://localhost:3000/webhook'], { from: 'user' })
    );

    expect(state.logger.error).toHaveBeenCalledWith('Request replay is available on the Plus plan and above.');
    expect(state.logger.log).toHaveBeenCalledWith('  - Request replay');
  });

  it('replays a request on the plus plan', async () => {
    state.api.getCurrentUser.mockResolvedValue(sampleUser('plus'));
    state.api.getRequest.mockResolvedValue(sampleRequest());
    const { requestsCommand } = await import('../commands/requests');

    await requestsCommand.parseAsync(['replay', 'req_123', '--to', 'http://localhost:3000/webhook'], { from: 'user' });

    expect(state.validateTargetUrl).toHaveBeenCalledWith('http://localhost:3000/webhook', undefined);
    expect(state.forward).toHaveBeenCalledWith(sampleRequest());
    expect(state.logger.success).toHaveBeenCalledWith('Replayed POST request to http://localhost:3000/webhook');
  });

  it('starts listen with a resolved endpoint', async () => {
    const { listenCommand } = await import('../commands/listen/listen');

    await listenCommand.parseAsync([], { from: 'user' });

    expect(state.resolveListenEndpoints).toHaveBeenCalledWith({
      providedEndpointIds: [],
      listenAll: undefined,
      silent: undefined,
    });
    expect(state.wsConnect).toHaveBeenCalledOnce();
  });

  it('rejects invalid forwarding targets before connecting', async () => {
    state.validateTargetUrl.mockReturnValue({
      valid: false,
      error: 'Invalid URL format',
    });
    const { forwardCommand } = await import('../commands/listen/forward');

    await expectExit(() =>
      forwardCommand.parseAsync(['--to', 'bad-url'], { from: 'user' })
    );

    expect(state.logger.error).toHaveBeenCalledWith('Invalid URL format');
    expect(state.wsConnect).not.toHaveBeenCalled();
  });

  it('starts forwarding with an auto-resolved endpoint', async () => {
    const { forwardCommand } = await import('../commands/listen/forward');

    await forwardCommand.parseAsync(['--to', 'http://localhost:3000/webhook'], { from: 'user' });

    expect(state.resolveSingleEndpoint).toHaveBeenCalledWith({
      providedEndpointId: undefined,
      silent: undefined,
    });
    expect(state.wsConnect).toHaveBeenCalledOnce();
  });
});
