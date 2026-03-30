import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    static instances: MockWebSocket[] = [];

    readyState = MockWebSocket.CONNECTING;
    listeners = new Map<string, Array<(...args: any[]) => void>>();

    constructor(
      public url: string,
      public options?: { headers?: Record<string, string> }
    ) {
      MockWebSocket.instances.push(this);
    }

    on(event: string, listener: (...args: any[]) => void) {
      const existing = this.listeners.get(event) || [];
      existing.push(listener);
      this.listeners.set(event, existing);
      return this;
    }

    emit(event: string, ...args: any[]) {
      for (const listener of this.listeners.get(event) || []) {
        listener(...args);
      }
    }

    send() {
      return;
    }

    close() {
      this.readyState = MockWebSocket.CLOSED;
    }
  }

  class MockResponse {
    statusCode?: number;
    statusMessage?: string;
    listeners = new Map<string, Array<(...args: any[]) => void>>();

    on(event: string, listener: (...args: any[]) => void) {
      const existing = this.listeners.get(event) || [];
      existing.push(listener);
      this.listeners.set(event, existing);
      return this;
    }

    emit(event: string, ...args: any[]) {
      for (const listener of this.listeners.get(event) || []) {
        listener(...args);
      }
    }
  }

  return {
    MockWebSocket,
    MockResponse,
    getConfig: vi.fn(),
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('ws', () => ({
  default: state.MockWebSocket,
}));

vi.mock('../utils/config', () => ({
  getConfig: state.getConfig,
}));

vi.mock('../utils/logger', () => ({
  logger: state.logger,
}));

describe('WebSocketManager reconnect handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    state.MockWebSocket.instances.length = 0;
    state.getConfig.mockReturnValue({
      apiUrl: 'https://api.hooknexus.com',
      authToken: 'test-token',
    });
  });

  it('does not create a second socket while a connection is still in progress', async () => {
    const { WebSocketManager } = await import('../services/websocket');
    const manager = new WebSocketManager('ep_123', {
      clientType: 'cli',
      clientMode: 'forward',
    });

    manager.connect();
    manager.connect();

    expect(state.MockWebSocket.instances).toHaveLength(1);
  });

  it('ignores stale close events after a new socket has replaced the old one', async () => {
    const { WebSocketManager } = await import('../services/websocket');
    const manager = new WebSocketManager('ep_123');
    const disconnected = vi.fn();
    const connected = vi.fn();

    manager.on('disconnected', disconnected);
    manager.on('connected', connected);

    manager.connect();
    const firstSocket = state.MockWebSocket.instances[0];

    firstSocket.readyState = state.MockWebSocket.OPEN;
    firstSocket.emit('open');
    firstSocket.readyState = state.MockWebSocket.CLOSED;
    firstSocket.emit('close', 1006, Buffer.from('network lost'));

    expect(disconnected).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);

    expect(state.MockWebSocket.instances).toHaveLength(2);

    const secondSocket = state.MockWebSocket.instances[1];
    secondSocket.readyState = state.MockWebSocket.OPEN;
    secondSocket.emit('open');

    firstSocket.emit('close', 1006, Buffer.from('late close'));
    await vi.advanceTimersByTimeAsync(30000);

    expect(connected).toHaveBeenCalledTimes(2);
    expect(disconnected).toHaveBeenCalledTimes(1);
    expect(state.MockWebSocket.instances).toHaveLength(2);
  });

  it('cancels a scheduled reconnect when disconnect is called manually', async () => {
    const { WebSocketManager } = await import('../services/websocket');
    const manager = new WebSocketManager('ep_123');

    manager.connect();
    const socket = state.MockWebSocket.instances[0];

    socket.readyState = state.MockWebSocket.OPEN;
    socket.emit('open');
    socket.readyState = state.MockWebSocket.CLOSED;
    socket.emit('close', 1006, Buffer.from('network lost'));

    manager.disconnect();
    await vi.advanceTimersByTimeAsync(30000);

    expect(state.MockWebSocket.instances).toHaveLength(1);
  });

  it('keeps retrying when reconnect briefly hits the connection limit', async () => {
    const { WebSocketManager } = await import('../services/websocket');
    const manager = new WebSocketManager('ep_123');
    manager.on('error', () => {});

    manager.connect();
    const firstSocket = state.MockWebSocket.instances[0];

    const response = new state.MockResponse();
    response.statusCode = 403;
    response.statusMessage = 'Forbidden';

    firstSocket.emit('unexpected-response', {}, response);
    response.emit('data', JSON.stringify({ error: 'Connection limit reached', max: 2 }));
    response.emit('end');
    firstSocket.readyState = state.MockWebSocket.CLOSED;
    firstSocket.emit('close', 1006, Buffer.from('limit'));

    await vi.advanceTimersByTimeAsync(1000);

    expect(state.MockWebSocket.instances).toHaveLength(2);
  });
});
