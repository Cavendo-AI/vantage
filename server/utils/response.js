/**
 * Standardized API response helpers
 */

import { toCamelCase } from './transform.js';

export function success(res, data, status = 200) {
  res.status(status).json({ success: true, data: toCamelCase(data) });
}

export function created(res, data) {
  success(res, data, 201);
}

export function error(res, message, status = 400, code = 'BAD_REQUEST') {
  res.status(status).json({ success: false, error: { code, message } });
}

export function notFound(res, resource = 'Resource') {
  error(res, `${resource} not found`, 404, 'NOT_FOUND');
}

export function unauthorized(res, message = 'Authentication required') {
  error(res, message, 401, 'UNAUTHORIZED');
}

export function forbidden(res, message = 'Access denied') {
  error(res, message, 403, 'FORBIDDEN');
}

export function validationError(res, message, errors = {}) {
  res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message, errors } });
}

export function badRequest(res, message = 'Bad request') {
  error(res, message, 400, 'BAD_REQUEST');
}

export function conflict(res, message = 'Resource conflict') {
  error(res, message, 409, 'CONFLICT');
}

export function serverError(res, message = 'Internal server error') {
  error(res, message, 500, 'INTERNAL_ERROR');
}
