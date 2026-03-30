import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { getConfig } from '../utils/config';
import { logger } from '../utils/logger';
import type { ReplayDispatchPayload, WebSocketMessage, WebhookRequest } from '../types';

interface WebSocketConnectionOptions {
  clientType?: 'cli';
  clientMode?: 'listen' | 'forward';
}

export interface WebSocketManagerEvents {
  connected: () => void;
  disconnected: () => void;
  request: (request: WebhookRequest) => void;
  replay: (payload: ReplayDispatchPayload) => void;
  error: (error: Error) => void;
}

export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private endpointId: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private shouldReconnect = true;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionId: string | null = null;
  private options: WebSocketConnectionOptions;

  constructor(endpointId: string, options: WebSocketConnectionOptions = {}) {
    super();
    this.endpointId = endpointId;
    this.options = options;
  }

  connect(): void {
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) {
      logger.debug('WebSocket already connected');
      return;
    }

    this.clearReconnectTimer();

    const config = getConfig();
    const wsUrl = config.apiUrl
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');
    const url = new URL(`${wsUrl}/ws/${this.endpointId}`);

    if (config.authToken) {
      url.searchParams.set('token', config.authToken);
    }
    if (this.options.clientType) {
      url.searchParams.set('client', this.options.clientType);
    }
    if (this.options.clientMode) {
      url.searchParams.set('mode', this.options.clientMode);
    }

    logger.debug(`Connecting to WebSocket: ${url.toString()}`);

    const headers: Record<string, string> = {
      'User-Agent': 'HookNexus-CLI/1.0.0',
    };

    if (config.authToken) {
      headers['Authorization'] = `Bearer ${config.authToken}`;
    }

    this.ws = new WebSocket(url.toString(), { headers });
    const socket = this.ws;

    socket.on('open', () => {
      if (this.ws !== socket) {
        return;
      }

      this.reconnectAttempts = 0;
      this.clearReconnectTimer();
      logger.debug('WebSocket connected');
      this.startPingInterval();
      this.emit('connected');
    });

    socket.on('message', (data: WebSocket.Data) => {
      if (this.ws !== socket) {
        return;
      }

      this.handleMessage(data.toString());
    });

    socket.on('close', (code: number, reason: Buffer) => {
      if (this.ws !== socket) {
        return;
      }

      this.ws = null;
      this.connectionId = null;
      logger.debug(`WebSocket closed: ${code} - ${reason.toString()}`);
      this.stopPingInterval();
      this.emit('disconnected');

      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    });

    socket.on('error', (error: Error) => {
      if (this.ws !== socket) {
        return;
      }

      logger.debug('WebSocket error:', error);
      this.emit('error', error);
    });

    socket.on('unexpected-response', (_request, response) => {
      if (this.ws !== socket) {
        return;
      }

      this.handleUnexpectedResponse(socket, response);
    });
  }

  private handleUnexpectedResponse(socket: WebSocket, response: NodeJS.ReadableStream & {
    statusCode?: number;
    statusMessage?: string;
    on(event: 'data', listener: (chunk: Buffer | string) => void): any;
    on(event: 'end', listener: () => void): any;
  }): void {
    const chunks: Buffer[] = [];

    response.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    response.on('end', () => {
      const statusCode = response.statusCode ?? 0;
      const bodyText = Buffer.concat(chunks).toString('utf8').trim();
      let message = `WebSocket handshake failed (${statusCode}${response.statusMessage ? ` ${response.statusMessage}` : ''})`;
      let isConnectionLimitError = false;
      let shouldStopReconnect = false;

      if (bodyText) {
        try {
          const parsed = JSON.parse(bodyText) as { error?: string; max?: number };
          if (statusCode === 403 && parsed.error === 'Connection limit reached') {
            isConnectionLimitError = true;
            message = `Connection limit reached for this endpoint (max ${parsed.max ?? 1}). Close the dashboard listener or upgrade your plan.`;
          } else if (parsed.error) {
            message = parsed.error;
          }
        } catch {
          message = bodyText;
        }
      }

      if (statusCode === 401) {
        message = 'Authentication failed for WebSocket connection. Run `hooknexus login` again.';
        shouldStopReconnect = true;
      } else if (statusCode === 404 && !bodyText) {
        message = 'Endpoint not found or expired.';
        shouldStopReconnect = true;
      } else if (statusCode === 403) {
        shouldStopReconnect = !isConnectionLimitError;
      }

      if (shouldStopReconnect) {
        this.shouldReconnect = false;
        this.clearReconnectTimer();
      }

      if (this.ws === socket && socket.readyState !== WebSocket.CLOSED) {
        socket.close();
      }

      this.emit('error', new Error(message));
    });
  }

  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      logger.debug(`Received message type: ${message.type}`);

      switch (message.type) {
        case 'connected':
          this.connectionId = message.payload?.connectionId;
          logger.debug(`Connection ID: ${this.connectionId}`);
          break;

        case 'new_request':
          this.emit('request', message.payload as WebhookRequest);
          break;

        case 'replay_request':
          this.emit('replay', message.payload as ReplayDispatchPayload);
          break;

        case 'ping':
          this.send({ type: 'pong' });
          break;

        case 'error':
          this.emit('error', new Error(message.payload?.message || 'Unknown error'));
          break;

        default:
          logger.debug(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.debug('Failed to parse WebSocket message:', error);
    }
  }

  private send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      logger.debug('Reconnect already scheduled');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.debug('Max reconnect attempts reached');
      this.emit('error', new Error('Max reconnect attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    logger.debug(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;

      if (this.shouldReconnect) {
        this.connect();
      }
    }, delay);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.stopPingInterval();
    this.clearReconnectTimer();
    this.connectionId = null;

    const socket = this.ws;
    this.ws = null;

    if (socket) {
      socket.close();
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionId(): string | null {
    return this.connectionId;
  }
}

// Multi-endpoint WebSocket manager
export class MultiWebSocketManager extends EventEmitter {
  private managers: Map<string, WebSocketManager> = new Map();
  private options: WebSocketConnectionOptions;

  constructor(options: WebSocketConnectionOptions = {}) {
    super();
    this.options = options;
  }

  addEndpoint(endpointId: string): void {
    if (this.managers.has(endpointId)) {
      return;
    }

    const manager = new WebSocketManager(endpointId, this.options);

    manager.on('connected', () => {
      this.emit('connected', endpointId);
    });

    manager.on('disconnected', () => {
      this.emit('disconnected', endpointId);
    });

    manager.on('request', (request) => {
      this.emit('request', endpointId, request);
    });

    manager.on('replay', (payload) => {
      this.emit('replay', endpointId, payload);
    });

    manager.on('error', (error) => {
      this.emit('error', endpointId, error);
    });

    this.managers.set(endpointId, manager);
    manager.connect();
  }

  removeEndpoint(endpointId: string): void {
    const manager = this.managers.get(endpointId);
    if (manager) {
      manager.disconnect();
      this.managers.delete(endpointId);
    }
  }

  disconnectAll(): void {
    for (const manager of this.managers.values()) {
      manager.disconnect();
    }
    this.managers.clear();
  }

  getEndpointIds(): string[] {
    return Array.from(this.managers.keys());
  }
}
