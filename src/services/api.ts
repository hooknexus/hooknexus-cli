import { request } from 'undici';
import { getConfig } from '../utils/config';
import { logger } from '../utils/logger';
import type {
  User,
  Endpoint,
  CreateEndpointOptions,
  WebhookRequest,
  Subscription,
  AccountUsage,
  EndpointsListResponse,
  RequestsListResponse,
} from '../types';

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private normalizeEndpoint(raw: any): Endpoint {
    return {
      id: raw.id,
      userId: raw.userId ?? raw.user_id ?? null,
      alias: raw.alias ?? null,
      isPermanent: raw.isPermanent ?? raw.is_permanent ?? false,
      expiresAt: raw.expiresAt ?? raw.expires_at ?? null,
      createdAt: raw.createdAt ?? raw.created_at ?? '',
      updatedAt: raw.updatedAt ?? raw.updated_at ?? '',
      requestCount: raw.requestCount ?? raw.request_count ?? 0,
      lastRequestAt: raw.lastRequestAt ?? raw.last_request_at ?? null,
    };
  }

  private normalizeRequest(raw: any): WebhookRequest {
    return {
      id: raw.id,
      endpointId: raw.endpointId ?? raw.endpoint_id ?? '',
      method: raw.method,
      path: raw.path ?? '/',
      query: raw.query ?? {},
      headers: raw.headers ?? {},
      body: raw.body ?? '',
      contentType: raw.contentType ?? raw.content_type ?? 'text/plain',
      ip: raw.ip ?? 'unknown',
      userAgent: raw.userAgent ?? raw.user_agent ?? 'unknown',
      size: raw.size ?? 0,
      createdAt: raw.createdAt ?? raw.created_at ?? '',
    };
  }

  private getHeaders(): Record<string, string> {
    const config = getConfig();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'HookNexus-CLI/1.0.0',
    };

    if (config.authToken) {
      headers['Authorization'] = `Bearer ${config.authToken}`;
    }

    return headers;
  }

  private getBaseUrl(): string {
    return getConfig().apiUrl;
  }

  private getAuthUrl(): string {
    return getConfig().authUrl;
  }

  private async fetch<T>(
    method: string,
    path: string,
    body?: any,
    useAuthUrl: boolean = false
  ): Promise<T> {
    const baseUrl = useAuthUrl ? this.getAuthUrl() : this.getBaseUrl();
    const url = `${baseUrl}${path}`;
    const config = getConfig();

    logger.debug(`${method} ${url}`);

    try {
      const response = await request(url, {
        method: method as any,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        headersTimeout: config.timeout,
        bodyTimeout: config.timeout,
      });

      const responseBody = await response.body.text();

      if (response.statusCode >= 400) {
        let errorMessage = `Request failed with status ${response.statusCode}`;
        let errorCode: string | undefined;

        try {
          const errorData = JSON.parse(responseBody);
          errorMessage = errorData.error || errorData.message || errorMessage;
          errorCode = errorData.code;
        } catch {
          // Use default error message
        }

        throw new ApiError(errorMessage, response.statusCode, errorCode);
      }

      if (!responseBody) {
        return {} as T;
      }

      return JSON.parse(responseBody) as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      const err = error as Error;
      logger.debug('API request error:', err);

      if (err.message.includes('ECONNREFUSED')) {
        throw new ApiError('Cannot connect to HookNexus API', 0, 'CONNECTION_ERROR');
      }

      throw new ApiError(err.message || 'Unknown error', 0, 'UNKNOWN_ERROR');
    }
  }

  // Auth endpoints (via Infra-Hub)
  async getCurrentUser(): Promise<User> {
    return this.fetch<User>('GET', '/auth/me', undefined, true);
  }

  async logout(): Promise<void> {
    await this.fetch('POST', '/auth/logout', undefined, true);
  }

  // Endpoint management
  async listEndpoints(): Promise<EndpointsListResponse> {
    const response = await this.fetch<any>('GET', '/api/endpoints');
    const endpoints = Array.isArray(response.endpoints)
      ? response.endpoints.map((endpoint: any) => this.normalizeEndpoint(endpoint))
      : [];

    return {
      endpoints,
      total: typeof response.total === 'number' ? response.total : endpoints.length,
      usage: response.usage,
    };
  }

  async createEndpoint(options?: CreateEndpointOptions): Promise<Endpoint> {
    const response = await this.fetch<any>('POST', '/api/endpoints', options || {});
    return this.normalizeEndpoint(response);
  }

  async getEndpoint(id: string): Promise<Endpoint> {
    const response = await this.fetch<any>('GET', `/api/endpoints/${id}`);
    return this.normalizeEndpoint(response);
  }

  async deleteEndpoint(id: string): Promise<void> {
    await this.fetch('DELETE', `/api/endpoints/${id}`);
  }

  // Request management
  async listRequests(
    endpointId: string,
    options?: { page?: number; limit?: number }
  ): Promise<RequestsListResponse> {
    const params = new URLSearchParams();
    const limit = options?.limit ?? 20;
    const page = options?.page ?? 1;

    params.set('limit', String(limit));
    params.set('offset', String((page - 1) * limit));

    const queryString = params.toString();
    const path = `/api/endpoints/${endpointId}/requests${queryString ? '?' + queryString : ''}`;

    const response = await this.fetch<any>('GET', path);
    const requests = Array.isArray(response.requests)
      ? response.requests.map((request: any) => this.normalizeRequest(request))
      : [];

    return {
      requests,
      total: typeof response.total === 'number' ? response.total : requests.length,
      page,
      limit,
    };
  }

  async getRequest(id: string): Promise<WebhookRequest> {
    const response = await this.fetch<any>('GET', `/api/requests/${id}`);
    return this.normalizeRequest(response);
  }

  // Subscription (via Infra-Hub)
  async getSubscription(): Promise<Subscription | null> {
    try {
      return await this.fetch<Subscription>('GET', '/billing/subscription', undefined, true);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getAccountUsage(): Promise<AccountUsage> {
    return this.fetch<AccountUsage>('GET', '/api/account/usage');
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.fetch('GET', '/api/health');
      return true;
    } catch {
      return false;
    }
  }
}

export const api = new ApiClient();
export { ApiError };
