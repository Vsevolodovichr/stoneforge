/**
 * Authentication Middleware
 *
 * Token-based authentication for the Stoneforge Control Center.
 * Protects API routes when auth is enabled in configuration.
 */

import type { Context, Next } from 'hono';

export interface AuthConfig {
  /** Whether authentication is enabled */
  enabled: boolean;
  /** The expected auth token */
  token?: string;
}

/**
 * Extract token from request
 * Supports: Authorization header (Bearer), X-Auth-Token header, or ?token= query param
 */
function extractToken(c: Context): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check X-Auth-Token header
  const xAuthToken = c.req.header('X-Auth-Token');
  if (xAuthToken) {
    return xAuthToken;
  }

  // Check query parameter
  const url = new URL(c.req.url);
  const queryToken = url.searchParams.get('token');
  if (queryToken) {
    return queryToken;
  }

  return null;
}

/**
 * Auth middleware for Hono
 *
 * When auth is enabled, requires a valid token for all API routes.
 * Health check endpoint (/api/health) is always accessible.
 */
export function createAuthMiddleware(config: AuthConfig) {
  return async (c: Context, next: Next) => {
    // Skip auth if disabled
    if (!config.enabled) {
      return next();
    }

    // Skip auth for health check endpoint
    if (c.req.path === '/api/health') {
      return next();
    }

    // Skip auth for OPTIONS requests (CORS preflight)
    if (c.req.method === 'OPTIONS') {
      return next();
    }

    // Check if token is configured
    if (!config.token) {
      return c.json(
        {
          error: {
            code: 'AUTH_NOT_CONFIGURED',
            message: 'Authentication is enabled but no token is configured',
          },
        },
        500
      );
    }

    // Extract and validate token
    const providedToken = extractToken(c);
    if (!providedToken) {
      return c.json(
        {
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication token is required. Provide via Authorization: Bearer <token> header, X-Auth-Token header, or ?token= query parameter.',
          },
        },
        401
      );
    }

    if (providedToken !== config.token) {
      return c.json(
        {
          error: {
            code: 'AUTH_INVALID',
            message: 'Invalid authentication token',
          },
        },
        401
      );
    }

    // Token is valid, proceed
    return next();
  };
}

/**
 * WebSocket auth validation
 *
 * Validates token for WebSocket connections.
 * Returns true if the connection is authorized.
 */
export function validateWebSocketAuth(
  url: string,
  config: AuthConfig
): boolean {
  // Skip auth if disabled
  if (!config.enabled) {
    return true;
  }

  // Check if token is configured
  if (!config.token) {
    return false;
  }

  // Extract token from query parameter
  const urlObj = new URL(url, 'http://localhost');
  const token = urlObj.searchParams.get('token');

  return token === config.token;
}