/**
 * Standardized API Response Utilities
 *
 * Provides consistent response format across all API endpoints.
 */

import { Response } from 'express';

/**
 * Standard success response
 * Includes no-cache headers to ensure fresh data on each request
 */
export function success<T>(res: Response, data: T, status: number = 200): Response {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  return res.status(status).json({
    success: true,
    data,
  });
}

/**
 * Standard error response
 */
export function error(
  res: Response,
  message: string,
  status: number = 500,
  code?: string,
  details?: unknown
): Response {
  return res.status(status).json({
    success: false,
    error: {
      message,
      code,
      ...(details && { details }),
    },
  });
}

/**
 * Validation error response (400)
 */
export function validationError(res: Response, message: string, details?: unknown): Response {
  return error(res, message, 400, 'VALIDATION_ERROR', details);
}

/**
 * Not found error response (404)
 */
export function notFound(res: Response, resource: string = 'Resource'): Response {
  return error(res, `${resource} not found`, 404, 'NOT_FOUND');
}

/**
 * Unauthorized error response (401)
 */
export function unauthorized(res: Response, message: string = 'Unauthorized'): Response {
  return error(res, message, 401, 'UNAUTHORIZED');
}

/**
 * Forbidden error response (403)
 */
export function forbidden(res: Response, message: string = 'Forbidden'): Response {
  return error(res, message, 403, 'FORBIDDEN');
}

/**
 * Internal server error response (500)
 */
export function serverError(res: Response, message: string = 'Internal server error', details?: unknown): Response {
  return error(res, message, 500, 'INTERNAL_ERROR', details);
}

/**
 * Configuration error response (500)
 */
export function configError(res: Response, message: string, details?: unknown): Response {
  return error(res, message, 500, 'CONFIG_ERROR', details);
}
