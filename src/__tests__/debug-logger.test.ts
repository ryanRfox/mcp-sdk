import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DebugLogger } from '../utils/debug-logger.js';
import type { DebugConfig } from '../types/index.js';

describe('DebugLogger', () => {
  let mockLogger: ReturnType<typeof vi.fn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockLogger = vi.fn();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor Configuration', () => {
    it('should handle undefined config as none level', () => {
      const logger = new DebugLogger(undefined);
      expect(logger.getLevel()).toBe('none');
      expect(logger.isEnabled()).toBe(false);
    });

    it('should handle false config as none level', () => {
      const logger = new DebugLogger(false);
      expect(logger.getLevel()).toBe('none');
      expect(logger.isEnabled()).toBe(false);
    });

    it('should handle true config as basic level (backward compatibility)', () => {
      const logger = new DebugLogger(true);
      expect(logger.getLevel()).toBe('basic');
      expect(logger.isEnabled()).toBe(true);
    });

    it('should handle string debug level', () => {
      const logger = new DebugLogger('verbose');
      expect(logger.getLevel()).toBe('verbose');
      expect(logger.isEnabled()).toBe(true);
    });

    it('should handle full DebugConfig object', () => {
      const config: DebugConfig = {
        level: 'transport',
        timestamps: false,
        logger: mockLogger,
      };
      const logger = new DebugLogger(config);
      expect(logger.getLevel()).toBe('transport');
      expect(logger.isEnabled()).toBe(true);
    });

    it('should use console.log by default', () => {
      const logger = new DebugLogger('basic');
      logger.basic('Test message', { data: 'test' });
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should use custom logger when provided', () => {
      const config: DebugConfig = {
        level: 'basic',
        logger: mockLogger,
      };
      const logger = new DebugLogger(config);
      logger.basic('Test message', { data: 'test' });
      expect(mockLogger).toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('Debug Level Hierarchy', () => {
    it('should not log when level is none', () => {
      const logger = new DebugLogger('none');
      logger.basic('Basic message', {});
      logger.verbose('Verbose message', {});
      logger.transport('Transport message', {});
      logger.trace('Trace message', {});
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log only basic when level is basic', () => {
      const config: DebugConfig = { level: 'basic', logger: mockLogger };
      const logger = new DebugLogger(config);
      
      logger.basic('Basic message', {});
      expect(mockLogger).toHaveBeenCalledTimes(1);
      
      logger.verbose('Verbose message', {});
      logger.transport('Transport message', {});
      logger.trace('Trace message', {});
      expect(mockLogger).toHaveBeenCalledTimes(1);
    });

    it('should log basic and verbose when level is verbose', () => {
      const config: DebugConfig = { level: 'verbose', logger: mockLogger };
      const logger = new DebugLogger(config);
      
      logger.basic('Basic message', {});
      logger.verbose('Verbose message', {});
      expect(mockLogger).toHaveBeenCalledTimes(2);
      
      logger.transport('Transport message', {});
      logger.trace('Trace message', {});
      expect(mockLogger).toHaveBeenCalledTimes(2);
    });

    it('should log basic, verbose, and transport when level is transport', () => {
      const config: DebugConfig = { level: 'transport', logger: mockLogger };
      const logger = new DebugLogger(config);
      
      logger.basic('Basic message', {});
      logger.verbose('Verbose message', {});
      logger.transport('Transport message', {});
      expect(mockLogger).toHaveBeenCalledTimes(3);
      
      logger.trace('Trace message', {});
      expect(mockLogger).toHaveBeenCalledTimes(3);
    });

    it('should log everything when level is trace', () => {
      const config: DebugConfig = { level: 'trace', logger: mockLogger };
      const logger = new DebugLogger(config);
      
      logger.basic('Basic message', {});
      logger.verbose('Verbose message', {});
      logger.transport('Transport message', {});
      logger.trace('Trace message', {});
      expect(mockLogger).toHaveBeenCalledTimes(4);
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize wallet addresses', () => {
      const config: DebugConfig = { level: 'basic', logger: mockLogger };
      const logger = new DebugLogger(config);
      
      logger.basic('Test', {
        wallet: '0x1234567890abcdef1234567890abcdef12345678',
      });
      
      expect(mockLogger).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          wallet: '0x1234...5678',
        })
      );
    });

    it('should sanitize signatures', () => {
      const config: DebugConfig = { level: 'basic', logger: mockLogger };
      const logger = new DebugLogger(config);
      
      const signature = '0x' + 'a'.repeat(130);
      logger.basic('Test', { signature });
      
      expect(mockLogger).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signature: '0xaaaaaaaa...aaaaaaaa',
        })
      );
    });

    it('should redact sensitive fields', () => {
      const config: DebugConfig = { level: 'basic', logger: mockLogger };
      const logger = new DebugLogger(config);
      
      logger.basic('Test', {
        privateKey: 'secret-key',
        secret: 'my-secret',
        password: 'my-password',
        publicData: 'visible',
      });
      
      expect(mockLogger).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          privateKey: '[REDACTED]',
          secret: '[REDACTED]',
          password: '[REDACTED]',
          publicData: 'visible',
        })
      );
    });

    it('should truncate very long strings', () => {
      const config: DebugConfig = { level: 'basic', logger: mockLogger };
      const logger = new DebugLogger(config);
      
      const longString = 'x'.repeat(2000);
      logger.basic('Test', { data: longString });
      
      expect(mockLogger).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: expect.stringMatching(/^x{500}.*truncated 1500 chars.*$/),
        })
      );
    });

    it('should sanitize nested objects', () => {
      const config: DebugConfig = { level: 'basic', logger: mockLogger };
      const logger = new DebugLogger(config);
      
      logger.basic('Test', {
        outer: {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          inner: {
            signature: '0x' + 'b'.repeat(130),
            secret: 'hidden',
          },
        },
      });
      
      expect(mockLogger).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          outer: expect.objectContaining({
            walletAddress: '0x1234...5678',
            inner: expect.objectContaining({
              signature: '0xbbbbbbbb...bbbbbbbb',
              secret: '[REDACTED]',
            }),
          }),
        })
      );
    });

    it('should sanitize arrays', () => {
      const config: DebugConfig = { level: 'basic', logger: mockLogger };
      const logger = new DebugLogger(config);
      
      logger.basic('Test', {
        wallets: [
          '0x1234567890abcdef1234567890abcdef12345678',
          '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        ],
      });
      
      expect(mockLogger).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          wallets: ['0x1234...5678', '0xabcd...abcd'],
        })
      );
    });
  });

  describe('Timestamps', () => {
    it('should include timestamps by default', () => {
      const config: DebugConfig = { level: 'basic', logger: mockLogger };
      const logger = new DebugLogger(config);
      
      logger.basic('Test message', {});
      
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T.*\] Test message$/),
        undefined
      );
    });

    it('should exclude timestamps when disabled', () => {
      const config: DebugConfig = {
        level: 'basic',
        timestamps: false,
        logger: mockLogger,
      };
      const logger = new DebugLogger(config);
      
      logger.basic('Test message', {});
      
      expect(mockLogger).toHaveBeenCalledWith('Test message', undefined);
    });
  });

  describe('Error Logging', () => {
    it('should log errors when level is not none', () => {
      const config: DebugConfig = { level: 'basic', logger: mockLogger };
      const logger = new DebugLogger(config);
      
      const error = new Error('Test error');
      logger.error('Error occurred', error, { extra: 'data' });
      
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Error occurred'),
        expect.objectContaining({
          extra: 'data',
          error: expect.objectContaining({
            message: 'Test error',
            name: 'Error',
          }),
        })
      );
    });

    it('should not log errors when level is none', () => {
      const config: DebugConfig = { level: 'none', logger: mockLogger };
      const logger = new DebugLogger(config);
      
      const error = new Error('Test error');
      logger.error('Error occurred', error, {});
      
      expect(mockLogger).not.toHaveBeenCalled();
    });

    it('should include stack trace only at trace level', () => {
      const config: DebugConfig = { level: 'trace', logger: mockLogger };
      const logger = new DebugLogger(config);
      
      const error = new Error('Test error');
      logger.error('Error occurred', error);
      
      expect(mockLogger).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          error: expect.objectContaining({
            stack: expect.stringContaining('Error: Test error'),
          }),
        })
      );
    });

    it('should not include stack trace at lower levels', () => {
      const config: DebugConfig = { level: 'basic', logger: mockLogger };
      const logger = new DebugLogger(config);
      
      const error = new Error('Test error');
      logger.error('Error occurred', error);
      
      expect(mockLogger).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Test error',
            stack: undefined,
          }),
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined values', () => {
      const config: DebugConfig = { level: 'basic', logger: mockLogger };
      const logger = new DebugLogger(config);
      
      logger.basic('Test', {
        nullValue: null,
        undefinedValue: undefined,
        normalValue: 'test',
      });
      
      expect(mockLogger).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          nullValue: null,
          undefinedValue: undefined,
          normalValue: 'test',
        })
      );
    });

    it('should handle non-string wallet addresses gracefully', () => {
      const config: DebugConfig = { level: 'basic', logger: mockLogger };
      const logger = new DebugLogger(config);
      
      logger.basic('Test', {
        wallet: 12345,
        validWallet: '0x1234567890abcdef1234567890abcdef12345678',
      });
      
      expect(mockLogger).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          wallet: 12345,
          validWallet: '0x1234...5678',
        })
      );
    });
  });
});