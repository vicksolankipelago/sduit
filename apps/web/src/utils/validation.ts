/**
 * Input validation utilities for Call Recordings
 */

/**
 * UUID v4 format regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates if a string is a valid UUID v4
 */
export const isValidUUID = (value: string): boolean => {
  if (!value || typeof value !== 'string') {
    return false;
  }
  return UUID_REGEX.test(value.trim());
};

/**
 * Validates if a string is a valid numeric ID (integer or string representation)
 */
export const isValidNumericId = (value: string): boolean => {
  if (!value || typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) && parseInt(trimmed, 10) > 0;
};

/**
 * Validates search parameters for call recordings
 * Returns an object with { valid: boolean, errors: string[] }
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface RecordingSearchParams {
  clientId?: string;
  memberId?: string;
  appointmentId?: string;
}

export const validateRecordingSearchParams = (
  params: RecordingSearchParams
): ValidationResult => {
  const errors: string[] = [];

  // At least one parameter must be provided
  if (!params.clientId && !params.memberId && !params.appointmentId) {
    errors.push('At least one search parameter is required');
  }

  // Validate clientId if provided
  if (params.clientId) {
    const trimmed = params.clientId.trim();
    if (!trimmed) {
      errors.push('Client ID cannot be empty');
    } else if (!isValidNumericId(trimmed)) {
      errors.push('Client ID must be a valid positive number');
    }
  }

  // Validate memberId if provided
  if (params.memberId) {
    const trimmed = params.memberId.trim();
    if (!trimmed) {
      errors.push('Member ID cannot be empty');
    } else if (!isValidUUID(trimmed)) {
      errors.push('Member ID must be a valid UUID (format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)');
    }
  }

  // Validate appointmentId if provided
  if (params.appointmentId) {
    const trimmed = params.appointmentId.trim();
    if (!trimmed) {
      errors.push('Appointment ID cannot be empty');
    } else if (!isValidNumericId(trimmed)) {
      errors.push('Appointment ID must be a valid positive number');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Sanitizes a string input by trimming whitespace
 */
export const sanitizeInput = (value: string): string => {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

/**
 * Validates date range parameters
 */
export const validateDateRange = (startDate?: string, endDate?: string): ValidationResult => {
  const errors: string[] = [];

  if (startDate && !isValidISODate(startDate)) {
    errors.push('Start date must be a valid ISO date (YYYY-MM-DD)');
  }

  if (endDate && !isValidISODate(endDate)) {
    errors.push('End date must be a valid ISO date (YYYY-MM-DD)');
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      errors.push('Start date must be before or equal to end date');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validates if a string is a valid ISO date (YYYY-MM-DD)
 */
const isValidISODate = (value: string): boolean => {
  if (!value || typeof value !== 'string') {
    return false;
  }
  const date = new Date(value);
  return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(value);
};

