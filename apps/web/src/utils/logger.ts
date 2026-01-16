/**
 * Logger Utility
 *
 * Provides structured logging with configurable log levels.
 * In production, only warnings and errors are logged.
 * In development, all log levels are enabled.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  minLevel: LogLevel;
  enableEmoji: boolean;
  prefix?: string;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_EMOJI: Record<LogLevel, string> = {
  debug: '🔍',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
};

// Determine if we're in production mode
const isProduction = (): boolean => {
  // Check for common production indicators
  if (typeof window !== 'undefined') {
    return (
      window.location.hostname !== 'localhost' &&
      !window.location.hostname.includes('127.0.0.1') &&
      !window.location.hostname.includes('.local')
    );
  }
  return process.env.NODE_ENV === 'production';
};

// Default configuration
const defaultConfig: LoggerConfig = {
  minLevel: isProduction() ? 'warn' : 'debug',
  enableEmoji: !isProduction(),
  prefix: undefined,
};

let globalConfig: LoggerConfig = { ...defaultConfig };

/**
 * Configure the global logger settings
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * Check if a log level should be logged based on current config
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[globalConfig.minLevel];
}

/**
 * Format a log message with optional emoji and prefix
 */
function formatMessage(level: LogLevel, message: string): string {
  const parts: string[] = [];

  if (globalConfig.enableEmoji) {
    parts.push(LOG_EMOJI[level]);
  }

  if (globalConfig.prefix) {
    parts.push(`[${globalConfig.prefix}]`);
  }

  parts.push(message);

  return parts.join(' ');
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, ...args: unknown[]): void {
  if (!shouldLog(level)) return;

  const formattedMessage = formatMessage(level, message);

  switch (level) {
    case 'debug':
      console.debug(formattedMessage, ...args);
      break;
    case 'info':
      console.info(formattedMessage, ...args);
      break;
    case 'warn':
      console.warn(formattedMessage, ...args);
      break;
    case 'error':
      console.error(formattedMessage, ...args);
      break;
  }
}

/**
 * Logger object with methods for each log level
 */
export const logger = {
  debug: (message: string, ...args: unknown[]) => log('debug', message, ...args),
  info: (message: string, ...args: unknown[]) => log('info', message, ...args),
  warn: (message: string, ...args: unknown[]) => log('warn', message, ...args),
  error: (message: string, ...args: unknown[]) => log('error', message, ...args),

  /**
   * Create a namespaced logger with a prefix
   */
  namespace: (prefix: string) => ({
    debug: (message: string, ...args: unknown[]) => {
      if (!shouldLog('debug')) return;
      console.debug(`[${prefix}] ${message}`, ...args);
    },
    info: (message: string, ...args: unknown[]) => {
      if (!shouldLog('info')) return;
      console.info(`[${prefix}] ${message}`, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
      if (!shouldLog('warn')) return;
      console.warn(`[${prefix}] ${message}`, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
      if (!shouldLog('error')) return;
      console.error(`[${prefix}] ${message}`, ...args);
    },
  }),
};

// Pre-configured loggers for different modules
export const voiceAgentLogger = logger.namespace('VoiceAgent');
export const journeyLogger = logger.namespace('Journey');
export const screenLogger = logger.namespace('Screen');
export const toolLogger = logger.namespace('Tool');
