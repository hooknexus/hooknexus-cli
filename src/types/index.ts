// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  plan: 'free' | 'plus' | 'pro' | 'team';
  createdAt: string;
}

// Endpoint types
export interface Endpoint {
  id: string;
  userId: string | null;
  alias: string | null;
  isPermanent: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  requestCount: number;
  lastRequestAt: string | null;
}

export interface CreateEndpointOptions {
  isPermanent?: boolean;
}

// Request types
export interface WebhookRequest {
  id: string;
  endpointId: string;
  method: HttpMethod;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string;
  contentType: string;
  ip: string;
  userAgent: string;
  size: number;
  createdAt: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

// Subscription types
export interface Subscription {
  id: string;
  userId: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due' | 'paused';
  plan: 'free' | 'plus' | 'pro' | 'team';
  billingCycle: 'monthly' | 'yearly';
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
}

export interface AccountUsage {
  endpoints: { current: number; limit: number };
  requests: { current: number; limit: number };
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'new_request' | 'replay_request' | 'connected' | 'ping' | 'pong' | 'error';
  payload?: any;
  timestamp: number;
}

export interface ReplayTarget {
  connectionId: string;
  clientType: 'web' | 'cli' | 'api_key' | 'unknown';
  clientMode: string | null;
  connectedAt: number;
  userAgent: string | null;
}

export interface ReplayDispatchPayload {
  replayId: string;
  sourceRequestId: string;
  dispatchedAt: string;
  target: ReplayTarget;
  request: WebhookRequest;
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  code?: string;
}

export interface EndpointsListResponse {
  endpoints: Endpoint[];
  total: number;
  usage?: AccountUsage | {
    dailyRequests: number;
    dailyRequestsMax: number;
  };
}

export interface RequestsListResponse {
  requests: WebhookRequest[];
  total: number;
  page: number;
  limit: number;
}

// Config types
export interface Config {
  apiUrl: string;
  authUrl: string;
  webUrl: string;
  authToken: string | null;
  outputFormat: 'pretty' | 'json' | 'minimal';
  color: boolean;
  timeout: number;
}

// Forward options
export interface ForwardOptions {
  targetUrl: string;
  preservePath: boolean;
  timeout: number;
  headers?: Record<string, string>;
}

export interface ForwardResult {
  success: boolean;
  statusCode?: number;
  statusMessage?: string;
  responseTime: number;
  body?: string;
  error?: string;
}
