/**
 * Centralized API Client
 *
 * Provides consistent error handling, authentication management,
 * and request/response handling across all API services.
 */

import { logger } from '../../utils/logger';

const apiLogger = logger.namespace('API');

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Custom error class for authentication errors
export class AuthError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'AuthError';
  }
}

// Event name for auth expiration
export const AUTH_EXPIRED_EVENT = 'auth:expired';

/**
 * Dispatch auth expired event
 * This allows React components (like AuthContext) to handle the redirect
 */
function dispatchAuthExpired(): void {
  apiLogger.warn('Session expired, dispatching auth:expired event');
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}

/**
 * Parse API response and handle errors consistently
 */
async function parseResponse<T>(response: Response): Promise<T> {
  // Handle 401 - Authentication required
  if (response.status === 401) {
    dispatchAuthExpired();
    throw new AuthError();
  }

  // Handle other error responses
  if (!response.ok) {
    let errorData: { message?: string; error?: { message?: string; code?: string; details?: unknown } } = {};

    try {
      errorData = await response.json();
    } catch {
      // Response is not JSON
    }

    const message =
      errorData.error?.message ||
      errorData.message ||
      `Request failed with status ${response.status}`;
    const code = errorData.error?.code;
    const details = errorData.error?.details;

    apiLogger.error(`API Error [${response.status}]:`, message);
    throw new ApiError(message, response.status, code, details);
  }

  // Handle successful responses
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    const data = await response.json();
    // Handle standardized response format { success: true, data: ... }
    if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
      return data.data as T;
    }
    return data as T;
  }

  // Return empty object for non-JSON responses
  return {} as T;
}

/**
 * Make an API request with consistent error handling
 */
export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const defaultOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const mergedOptions = { ...defaultOptions, ...options };

  // Don't set Content-Type for FormData or when explicitly removed
  if (options.body instanceof FormData || options.headers?.['Content-Type'] === undefined) {
    delete (mergedOptions.headers as Record<string, string>)['Content-Type'];
  }

  try {
    const response = await fetch(url, mergedOptions);
    return parseResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Network or other error
    apiLogger.error('Network error:', error);
    throw new ApiError('Network error. Please check your connection.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Convenience methods for common HTTP methods
 */
export const api = {
  get: <T>(url: string, options?: RequestInit) =>
    apiRequest<T>(url, { ...options, method: 'GET' }),

  post: <T>(url: string, body?: unknown, options?: RequestInit) =>
    apiRequest<T>(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(url: string, body?: unknown, options?: RequestInit) =>
    apiRequest<T>(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(url: string, body?: unknown, options?: RequestInit) =>
    apiRequest<T>(url, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(url: string, options?: RequestInit) =>
    apiRequest<T>(url, { ...options, method: 'DELETE' }),
};
