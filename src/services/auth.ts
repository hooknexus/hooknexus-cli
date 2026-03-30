import { createServer, IncomingMessage, ServerResponse } from 'http';
import open from 'open';
import { getConfig, setAuthToken } from '../utils/config';
import { logger, createSpinner } from '../utils/logger';

const CALLBACK_PORT_START = 9876;
const CALLBACK_PORT_END = 9886;

interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
}

// Find an available port
async function findAvailablePort(): Promise<number> {
  const net = await import('net');

  return new Promise((resolve, reject) => {
    let currentPort = CALLBACK_PORT_START;

    const tryPort = () => {
      if (currentPort > CALLBACK_PORT_END) {
        reject(new Error('No available port found'));
        return;
      }

      const server = net.createServer();
      server.once('error', () => {
        currentPort++;
        tryPort();
      });
      server.once('listening', () => {
        server.close(() => resolve(currentPort));
      });
      server.listen(currentPort, '127.0.0.1');
    };

    tryPort();
  });
}

// Start local OAuth callback server
export async function startOAuthFlow(provider: 'github' | 'google' = 'github'): Promise<AuthResult> {
  const config = getConfig();

  let port: number;
  try {
    port = await findAvailablePort();
  } catch (error) {
    return { success: false, error: 'Could not find available port for OAuth callback' };
  }

  const callbackUrl = `http://localhost:${port}/callback`;

  return new Promise((resolve) => {
    let resolved = false;
    let timeoutId: NodeJS.Timeout;

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      if (url.pathname === '/callback') {
        const token = url.searchParams.get('token');
        const error = url.searchParams.get('error');

        // Send response to browser
        res.writeHead(200, { 'Content-Type': 'text/html' });
        if (token) {
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>HookNexus CLI - Login Successful</title>
                <style>
                  body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a1a; color: #fff; }
                  .container { text-align: center; padding: 40px; }
                  h1 { color: #10b981; margin-bottom: 16px; }
                  p { color: #9ca3af; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>Login Successful!</h1>
                  <p>You can close this window and return to the terminal.</p>
                </div>
              </body>
            </html>
          `);

          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            server.close();
            resolve({ success: true, token });
          }
        } else {
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>HookNexus CLI - Login Failed</title>
                <style>
                  body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a1a; color: #fff; }
                  .container { text-align: center; padding: 40px; }
                  h1 { color: #ef4444; margin-bottom: 16px; }
                  p { color: #9ca3af; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>Login Failed</h1>
                  <p>${error || 'An unknown error occurred. Please try again.'}</p>
                </div>
              </body>
            </html>
          `);

          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            server.close();
            resolve({ success: false, error: error || 'Login failed' });
          }
        }
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(port, '127.0.0.1', async () => {
      // Build OAuth URL with CLI callback (use authUrl for OAuth)
      const oauthUrl = new URL(`${config.authUrl}/auth/${provider}`);
      oauthUrl.searchParams.set('cli_callback', callbackUrl);

      logger.info('Opening browser for authentication...');

      try {
        await open(oauthUrl.toString());
      } catch (error) {
        logger.warn(`Could not open browser automatically.`);
        logger.log(`Please open this URL manually: ${oauthUrl.toString()}`);
      }

      // Timeout after 5 minutes
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          server.close();
          resolve({ success: false, error: 'Login timed out. Please try again.' });
        }
      }, 5 * 60 * 1000);
    });

    server.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: `Server error: ${error.message}` });
      }
    });
  });
}

// Token-based login
export async function loginWithToken(token: string): Promise<AuthResult> {
  // Temporarily set the token to test it
  const originalToken = getConfig().authToken;
  setAuthToken(token);

  try {
    const { api } = await import('./api');
    await api.getCurrentUser();
    return { success: true, token };
  } catch (error) {
    // Restore original token on failure
    if (originalToken) {
      setAuthToken(originalToken);
    }
    const err = error as Error;
    return { success: false, error: err.message || 'Invalid token' };
  }
}

// Check if user is logged in
export async function checkAuth(): Promise<{ authenticated: boolean; user?: any }> {
  const config = getConfig();

  if (!config.authToken) {
    return { authenticated: false };
  }

  try {
    const { api } = await import('./api');
    const user = await api.getCurrentUser();
    return { authenticated: true, user };
  } catch {
    return { authenticated: false };
  }
}
