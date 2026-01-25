/**
 * Backend Logger Utility
 *
 * Provides structured logging with configurable log levels.
 * In production, only warnings and errors are logged.
 * In development, all log levels are enabled.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  minLevel: LogLevel;
  prefix?: string;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production';
};

const defaultConfig: LoggerConfig = {
  minLevel: isProduction() ? 'warn' : 'debug',
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
 * Format timestamp for log messages
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Format a log message with timestamp and optional prefix
 */
function formatMessage(level: LogLevel, namespace: string | undefined, message: string): string {
  const parts: string[] = [getTimestamp(), `[${level.toUpperCase()}]`];

  if (namespace) {
    parts.push(`[${namespace}]`);
  }

  parts.push(message);

  return parts.join(' ');
}

/**
 * Core logging function
 */
function log(level: LogLevel, namespace: string | undefined, message: string, ...args: unknown[]): void {
  if (!shouldLog(level)) return;

  const formattedMessage = formatMessage(level, namespace, message);

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
  debug: (message: string, ...args: unknown[]) => log('debug', undefined, message, ...args),
  info: (message: string, ...args: unknown[]) => log('info', undefined, message, ...args),
  warn: (message: string, ...args: unknown[]) => log('warn', undefined, message, ...args),
  error: (message: string, ...args: unknown[]) => log('error', undefined, message, ...args),

  /**
   * Create a namespaced logger with a prefix
   */
  namespace: (prefix: string) => ({
    debug: (message: string, ...args: unknown[]) => log('debug', prefix, message, ...args),
    info: (message: string, ...args: unknown[]) => log('info', prefix, message, ...args),
    warn: (message: string, ...args: unknown[]) => log('warn', prefix, message, ...args),
    error: (message: string, ...args: unknown[]) => log('error', prefix, message, ...args),
  }),
};

// Pre-configured loggers for different modules
export const serverLogger = logger.namespace('Server');
export const authLogger = logger.namespace('Auth');
export const journeyLogger = logger.namespace('Journey');
export const sessionLogger = logger.namespace('Session');
export const screenLogger = logger.namespace('Screen');
export const feedbackLogger = logger.namespace('Feedback');
export const recordingLogger = logger.namespace('Recording');
export const bedrockLogger = logger.namespace('Bedrock');
