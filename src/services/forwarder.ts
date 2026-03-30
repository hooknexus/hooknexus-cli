import { request } from 'undici';
import { logger } from '../utils/logger';
import type { WebhookRequest, ForwardOptions, ForwardResult } from '../types';

export class RequestForwarder {
  private options: ForwardOptions;

  constructor(options: ForwardOptions) {
    this.options = options;
  }

  async forward(
    webhookRequest: WebhookRequest,
    runtimeOptions: {
      mode?: 'live' | 'replay';
      captureBody?: boolean;
    } = {}
  ): Promise<ForwardResult> {
    const startTime = Date.now();
    const mode = runtimeOptions.mode || 'live';
    const captureBody = runtimeOptions.captureBody ?? mode === 'live';

    try {
      // Build target URL
      let targetUrl = this.options.targetUrl;

      if (this.options.preservePath && webhookRequest.path) {
        // Remove original endpoint path prefix, keep extra path
        const extraPath = webhookRequest.path.replace(/^\/h\/[^\/]+/, '');
        if (extraPath) {
          targetUrl = targetUrl.replace(/\/$/, '') + extraPath;
        }
      }

      // Build query string
      const queryParams = new URLSearchParams(webhookRequest.query);
      if (queryParams.toString()) {
        const separator = targetUrl.includes('?') ? '&' : '?';
        targetUrl += separator + queryParams.toString();
      }

      // Build headers
      const headers: Record<string, string> = {};

      // Copy original headers (exclude certain headers)
      const excludeHeaders = [
        'host',
        'connection',
        'content-length',
        'transfer-encoding',
        // 若带上上游的 gzip/br，本地服务可能返回压缩体；text() 按 UTF-8 解码会成乱码
        'accept-encoding',
        'cf-connecting-ip',
        'cf-ray',
        'cf-visitor',
        'cf-ipcountry',
        'x-forwarded-for',
        'x-forwarded-proto',
        'x-real-ip',
      ];

      for (const [key, value] of Object.entries(webhookRequest.headers)) {
        if (!excludeHeaders.includes(key.toLowerCase())) {
          headers[key] = value;
        }
      }

      // Add custom headers
      if (this.options.headers) {
        Object.assign(headers, this.options.headers);
      }

      if (mode === 'live') {
        // 要求明文响应，便于终端打印 JSON（避免 gzip/br 被当成字符串）
        headers['accept-encoding'] = 'identity';

        // Add forwarding identification headers
        headers['X-Forwarded-By'] = 'HookNexus-CLI';
        headers['X-HookNexus-Request-Id'] = webhookRequest.id;
        headers['X-HookNexus-Original-IP'] = webhookRequest.ip || 'unknown';
      }

      logger.debug(`Forwarding ${webhookRequest.method} to ${targetUrl}`);

      const response = await request(targetUrl, {
        method: webhookRequest.method as any,
        headers,
        body: webhookRequest.body || undefined,
        headersTimeout: this.options.timeout,
        bodyTimeout: this.options.timeout,
      });

      let responseBody: string | undefined;
      if (captureBody) {
        responseBody = await response.body.text();
      } else {
        await response.body.dump();
      }
      const responseTime = Date.now() - startTime;
      const statusMessage = getStatusMessage(response.statusCode);
      const success = response.statusCode >= 200 && response.statusCode < 400;

      return {
        success,
        statusCode: response.statusCode,
        statusMessage,
        responseTime,
        body: responseBody,
        error: success ? undefined : `Target responded with ${response.statusCode} ${statusMessage}`,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const err = error as Error;

      let errorMessage = err.message || 'Unknown error';

      // Friendly error messages
      if (errorMessage.includes('ECONNREFUSED')) {
        errorMessage = `Connection refused - is your server running at ${this.options.targetUrl}?`;
      } else if (errorMessage.includes('ENOTFOUND')) {
        errorMessage = `Host not found - check the target URL: ${this.options.targetUrl}`;
      } else if (errorMessage.includes('ETIMEDOUT')) {
        errorMessage = `Request timed out after ${this.options.timeout}ms`;
      }

      return {
        success: false,
        responseTime,
        error: errorMessage,
      };
    }
  }
}

function getStatusMessage(statusCode: number): string {
  const messages: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };

  return messages[statusCode] || 'Unknown';
}

// Validate target URL
export function validateTargetUrl(url: string, allowExternal: boolean): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use http or https protocol' };
    }

    const isLocal =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '0.0.0.0' ||
      parsed.hostname.endsWith('.local') ||
      parsed.hostname === '::1';

    if (!isLocal && !allowExternal) {
      return {
        valid: false,
        error: 'Target URL must be localhost. Use --allow-external to forward to remote hosts.',
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
