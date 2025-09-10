import type { DebugLevel, DebugConfig } from '../types/index.js';

/**
 * Debug logger with configurable levels and data sanitization
 */
export class DebugLogger {
  private readonly level: DebugLevel;
  private readonly timestamps: boolean;
  private readonly logger: (message: string, context?: Record<string, unknown>) => void;
  
  /**
   * Numeric level values for comparison
   */
  private static readonly LEVELS: Readonly<Record<DebugLevel, number>> = {
    none: 0,
    basic: 1,
    verbose: 2,
    transport: 3,
    trace: 4,
  } as const;

  constructor(config: boolean | DebugLevel | DebugConfig | undefined) {
    // Handle backward compatibility and different config formats
    if (config === undefined || config === false) {
      this.level = 'none';
      this.timestamps = true;
      this.logger = console.log;
    } else if (config === true) {
      // Backward compatibility: true maps to 'basic'
      this.level = 'basic';
      this.timestamps = true;
      this.logger = console.log;
    } else if (typeof config === 'string') {
      this.level = config;
      this.timestamps = true;
      this.logger = console.log;
    } else {
      this.level = config.level;
      this.timestamps = config.timestamps !== false;
      this.logger = config.logger || console.log;
    }
  }

  /**
   * Check if a debug level is enabled
   */
  private isLevelEnabled(requiredLevel: DebugLevel): boolean {
    return DebugLogger.LEVELS[this.level] >= DebugLogger.LEVELS[requiredLevel];
  }

  /**
   * Sanitize sensitive data in debug output
   */
  private sanitize(data: unknown): unknown {
    if (data === null || data === undefined) return data;
    
    if (typeof data === 'string') {
      // Sanitize wallet addresses (0x followed by 40 hex chars)
      if (/^0x[0-9a-f]{40}$/i.test(data)) {
        return `${data.slice(0, 6)}...${data.slice(-4)}`;
      }
      
      // Sanitize signatures (0x followed by 130 hex chars)
      if (/^0x[0-9a-f]{130}$/i.test(data)) {
        return `${data.slice(0, 10)}...${data.slice(-8)}`;
      }
      
      // Truncate very long strings
      if (data.length > 1000) {
        return `${data.slice(0, 500)}...[truncated ${data.length - 500} chars]`;
      }
      
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }
    
    if (typeof data === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        // Special handling for known sensitive fields
        if (key === 'signature' && typeof value === 'string') {
          sanitized[key] = this.sanitize(value);
        } else if (key === 'walletAddress' && typeof value === 'string') {
          sanitized[key] = this.sanitize(value);
        } else if (key === 'privateKey' || key === 'secret' || key === 'password') {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitize(value);
        }
      }
      return sanitized;
    }
    
    return data;
  }

  /**
   * Format log message with optional timestamp
   */
  private formatMessage(message: string): string {
    if (this.timestamps) {
      return `[${new Date().toISOString()}] ${message}`;
    }
    return message;
  }

  /**
   * Log at basic level (auth flow start/end)
   */
  public basic(message: string, context?: Record<string, unknown>): void {
    if (!this.isLevelEnabled('basic')) return;
    
    const sanitizedContext = context && Object.keys(context).length > 0
      ? this.sanitize(context) as Record<string, unknown>
      : undefined;
    this.logger(this.formatMessage(message), sanitizedContext);
  }

  /**
   * Log at verbose level (detailed step-by-step)
   */
  public verbose(message: string, context?: Record<string, unknown>): void {
    if (!this.isLevelEnabled('verbose')) return;
    
    const sanitizedContext = context && Object.keys(context).length > 0
      ? this.sanitize(context) as Record<string, unknown>
      : undefined;
    this.logger(this.formatMessage(message), sanitizedContext);
  }

  /**
   * Log at transport level (raw request/response)
   */
  public transport(message: string, context?: Record<string, unknown>): void {
    if (!this.isLevelEnabled('transport')) return;
    
    const sanitizedContext = context && Object.keys(context).length > 0
      ? this.sanitize(context) as Record<string, unknown>
      : undefined;
    this.logger(this.formatMessage(message), sanitizedContext);
  }

  /**
   * Log at trace level (everything including internal state)
   */
  public trace(message: string, context?: Record<string, unknown>): void {
    if (!this.isLevelEnabled('trace')) return;
    
    const sanitizedContext = context && Object.keys(context).length > 0
      ? this.sanitize(context) as Record<string, unknown>
      : undefined;
    this.logger(this.formatMessage(message), sanitizedContext);
  }

  /**
   * Log error with context (always logged unless level is 'none')
   */
  public error(message: string, error: Error, context?: Record<string, unknown>): void {
    if (this.level === 'none') return;
    
    const errorContext = {
      ...context,
      error: {
        message: error.message,
        name: error.name,
        stack: this.level === 'trace' ? error.stack : undefined,
      },
    };
    
    const sanitizedContext = this.sanitize(errorContext) as Record<string, unknown>;
    this.logger(this.formatMessage(`[ERROR] ${message}`), sanitizedContext);
  }

  /**
   * Get the current debug level
   */
  public getLevel(): DebugLevel {
    return this.level;
  }

  /**
   * Check if debug logging is enabled at any level
   */
  public isEnabled(): boolean {
    return this.level !== 'none';
  }
}