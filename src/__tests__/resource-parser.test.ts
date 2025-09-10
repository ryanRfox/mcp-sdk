import { describe, it, expect } from 'vitest';
import {
  extractToolName,
  hasPrefix,
  extractPrefix,
  normalizeResourceName,
  compareResourceNames,
} from '../utils/resource-parser.js';

describe('Resource Parser', () => {
  describe('extractToolName', () => {
    it('should extract tool name from prefixed resource', () => {
      expect(extractToolName('ngrok weather:get-alerts')).toBe('get-alerts');
      expect(extractToolName('client:tool-name')).toBe('tool-name');
      expect(extractToolName('prefix:another-tool')).toBe('another-tool');
    });

    it('should handle multiple colons (nested prefixes)', () => {
      expect(extractToolName('client:prefix:tool')).toBe('tool');
      expect(extractToolName('a:b:c:d')).toBe('d');
      expect(extractToolName('namespace:service:method')).toBe('method');
    });

    it('should return full name when no prefix', () => {
      expect(extractToolName('simple-tool')).toBe('simple-tool');
      expect(extractToolName('get_weather')).toBe('get_weather');
      expect(extractToolName('tool')).toBe('tool');
    });

    it('should handle edge cases', () => {
      expect(extractToolName('')).toBe('');
      expect(extractToolName(undefined)).toBe('');
      expect(extractToolName(':')).toBe('');
      expect(extractToolName(':::')).toBe('');
      expect(extractToolName(':tool')).toBe('tool');
      expect(extractToolName('prefix:')).toBe('');
    });

    it('should preserve special characters in tool names', () => {
      expect(extractToolName('client:get-weather-data')).toBe('get-weather-data');
      expect(extractToolName('client:get_weather_data')).toBe('get_weather_data');
      expect(extractToolName('client:getWeatherData')).toBe('getWeatherData');
      expect(extractToolName('client:get.weather.data')).toBe('get.weather.data');
    });

    it('should handle real-world examples from Issue #3', () => {
      // Examples from the bug report
      expect(extractToolName('ngrok weather:get-alerts')).toBe('get-alerts');
      expect(extractToolName('claude-web:fetch-data')).toBe('fetch-data');
      expect(extractToolName('mcp-client:process_request')).toBe('process_request');
    });
  });

  describe('hasPrefix', () => {
    it('should detect prefixed resource names', () => {
      expect(hasPrefix('client:tool')).toBe(true);
      expect(hasPrefix('ngrok weather:get-alerts')).toBe(true);
      expect(hasPrefix('a:b:c')).toBe(true);
    });

    it('should detect non-prefixed resource names', () => {
      expect(hasPrefix('simple-tool')).toBe(false);
      expect(hasPrefix('get_weather')).toBe(false);
      expect(hasPrefix('tool')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(hasPrefix('')).toBe(false);
      expect(hasPrefix(undefined)).toBe(false);
      expect(hasPrefix(':')).toBe(true);
      expect(hasPrefix(':::')).toBe(true);
    });
  });

  describe('extractPrefix', () => {
    it('should extract single prefix', () => {
      expect(extractPrefix('client:tool')).toBe('client');
      expect(extractPrefix('prefix:another-tool')).toBe('prefix');
    });

    it('should extract compound prefix', () => {
      expect(extractPrefix('ngrok weather:get-alerts')).toBe('ngrok weather');
      expect(extractPrefix('client:prefix:tool')).toBe('client:prefix');
      expect(extractPrefix('a:b:c:d')).toBe('a:b:c');
    });

    it('should return empty string for non-prefixed names', () => {
      expect(extractPrefix('simple-tool')).toBe('');
      expect(extractPrefix('tool')).toBe('');
    });

    it('should handle edge cases', () => {
      expect(extractPrefix('')).toBe('');
      expect(extractPrefix(undefined)).toBe('');
      expect(extractPrefix(':')).toBe('');
      expect(extractPrefix(':tool')).toBe('');
      expect(extractPrefix('prefix:')).toBe('prefix');
    });
  });

  describe('normalizeResourceName', () => {
    it('should normalize prefixed names', () => {
      expect(normalizeResourceName('client:tool-name')).toBe('tool-name');
      expect(normalizeResourceName('CLIENT:TOOL-NAME')).toBe('TOOL-NAME');
      expect(normalizeResourceName('  client:tool  ')).toBe('tool');
    });

    it('should normalize non-prefixed names', () => {
      expect(normalizeResourceName('tool-name')).toBe('tool-name');
      expect(normalizeResourceName('  tool-name  ')).toBe('tool-name');
      expect(normalizeResourceName('TOOL-NAME')).toBe('TOOL-NAME');
    });

    it('should handle edge cases', () => {
      expect(normalizeResourceName('')).toBe('');
      expect(normalizeResourceName(undefined)).toBe('');
      expect(normalizeResourceName('   ')).toBe('');
      expect(normalizeResourceName(':')).toBe('');
    });
  });

  describe('compareResourceNames', () => {
    it('should match prefixed and non-prefixed names', () => {
      expect(compareResourceNames('client:tool', 'tool')).toBe(true);
      expect(compareResourceNames('ngrok weather:get-alerts', 'get-alerts')).toBe(true);
      expect(compareResourceNames('prefix:tool', 'another-prefix:tool')).toBe(true);
    });

    it('should match identical names', () => {
      expect(compareResourceNames('tool', 'tool')).toBe(true);
      expect(compareResourceNames('client:tool', 'client:tool')).toBe(true);
      expect(compareResourceNames('get-alerts', 'get-alerts')).toBe(true);
    });

    it('should handle whitespace', () => {
      expect(compareResourceNames('  client:tool  ', 'tool')).toBe(true);
      expect(compareResourceNames('tool  ', '  tool')).toBe(true);
      expect(compareResourceNames('client:tool  ', '  another:tool  ')).toBe(true);
    });

    it('should not match different tool names', () => {
      expect(compareResourceNames('client:tool1', 'tool2')).toBe(false);
      expect(compareResourceNames('tool1', 'tool2')).toBe(false);
      expect(compareResourceNames('client:tool1', 'client:tool2')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(compareResourceNames('', '')).toBe(true);
      expect(compareResourceNames(undefined, undefined)).toBe(true);
      expect(compareResourceNames('tool', undefined)).toBe(false);
      expect(compareResourceNames(undefined, 'tool')).toBe(false);
      expect(compareResourceNames(':', ':')).toBe(true);
    });

    it('should handle real-world scenarios from Issue #3', () => {
      // The bug scenario: tool name extraction uses full name, proof uses extracted name
      const clientResourceName = 'ngrok weather:get-alerts';
      const extractedFromProof = 'get-alerts';
      const fullNameFromParams = 'ngrok weather:get-alerts';
      
      // All these should match
      expect(compareResourceNames(clientResourceName, extractedFromProof)).toBe(true);
      expect(compareResourceNames(fullNameFromParams, extractedFromProof)).toBe(true);
      expect(compareResourceNames(clientResourceName, fullNameFromParams)).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle Claude Web naming pattern', () => {
      const claudeWebResource = 'claude-web:fetch-user-data';
      const toolName = extractToolName(claudeWebResource);
      
      expect(toolName).toBe('fetch-user-data');
      expect(hasPrefix(claudeWebResource)).toBe(true);
      expect(extractPrefix(claudeWebResource)).toBe('claude-web');
      expect(compareResourceNames(claudeWebResource, 'fetch-user-data')).toBe(true);
    });

    it('should handle ngrok proxy pattern', () => {
      const ngrokResource = 'ngrok weather:get-forecast';
      const toolName = extractToolName(ngrokResource);
      
      expect(toolName).toBe('get-forecast');
      expect(hasPrefix(ngrokResource)).toBe(true);
      expect(extractPrefix(ngrokResource)).toBe('ngrok weather');
      expect(compareResourceNames(ngrokResource, 'get-forecast')).toBe(true);
    });

    it('should handle custom MCP client patterns', () => {
      const patterns = [
        'mcp-client:tool',
        'custom.client:api.method',
        'namespace:service:endpoint',
        'org.company.product:feature:action',
      ];

      const expectedTools = [
        'tool',
        'api.method',
        'endpoint',
        'action',
      ];

      patterns.forEach((pattern, index) => {
        expect(extractToolName(pattern)).toBe(expectedTools[index]);
        expect(hasPrefix(pattern)).toBe(true);
      });
    });

    it('should maintain backward compatibility with non-prefixed names', () => {
      const legacyNames = [
        'get-weather',
        'fetch_data',
        'processRequest',
        'simple-tool',
      ];

      legacyNames.forEach(name => {
        expect(extractToolName(name)).toBe(name);
        expect(hasPrefix(name)).toBe(false);
        expect(extractPrefix(name)).toBe('');
        expect(compareResourceNames(name, name)).toBe(true);
      });
    });
  });
});