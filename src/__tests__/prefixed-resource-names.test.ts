import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RadiusMcpSdk } from '../radius-mcp-sdk.js';
import type { RadiusConfig, EVMAuthProof } from '../types/index.js';
import { recoverTypedDataAddress } from 'viem';

// Mock viem
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    readContract: vi.fn(),
  })),
  getContract: vi.fn(() => ({
    read: {
      balanceOf: vi.fn(),
      balanceOfBatch: vi.fn(),
    },
  })),
  http: vi.fn(),
  isAddress: vi.fn((addr: string) => /^0x[0-9a-f]{40}$/i.test(addr)),
  recoverTypedDataAddress: vi.fn(),
}));

const mockRecoverTypedDataAddress = recoverTypedDataAddress as ReturnType<typeof vi.fn>;

describe('Prefixed Resource Names', () => {
  let sdk: RadiusMcpSdk;
  let mockBalanceOf: ReturnType<typeof vi.fn>;

  const config: RadiusConfig = {
    contractAddress: '0x1234567890123456789012345678901234567890',
    chainId: 1,
    rpcUrl: 'https://ethereum.rpc.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sdk = new RadiusMcpSdk(config);
    
    // Setup mocks
    const mockContract = (sdk as any).contract;
    mockBalanceOf = mockContract.read.balanceOf = vi.fn();
    mockBalanceOf.mockResolvedValue(1n); // User owns the token
  });

  describe('Authentication with Prefixed Names', () => {
    it('should authenticate successfully with ngrok weather prefix', async () => {
      const handler = vi.fn().mockResolvedValue({ result: 'success' });
      const protectedHandler = sdk.protect(101, handler);

      // Create a proof for 'get-alerts' tool with 'ngrok weather:' prefix
      const proof: EVMAuthProof = {
        challenge: {
          domain: {
            name: 'EVMAuth',
            version: '1',
            chainId: 1,
            verifyingContract: '0x1234567890123456789012345678901234567890',
          },
          primaryType: 'EVMAuthRequest',
          types: {
            EIP712Domain: [],
            EVMAuthRequest: [],
          },
          message: {
            serverName: 'test-server',
            resourceName: 'ngrok weather:get-alerts', // Prefixed resource name
            requiredTokens: '[101]',
            walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            nonce: `${Date.now()}-${'a'.repeat(32)}`,
            issuedAt: Date.now().toString(),
            expiresAt: (Date.now() + 30000).toString(),
            purpose: 'test',
          },
        },
        signature: '0x' + 'a'.repeat(130),
      };

      // Mock signature recovery
      mockRecoverTypedDataAddress.mockResolvedValue('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');

      // Request also uses the prefixed name
      const result = await protectedHandler({
        params: {
          name: 'ngrok weather:get-alerts', // Client sends prefixed name
          arguments: {
            __evmauth: proof,
            data: 'test',
          },
        },
      });

      expect(handler).toHaveBeenCalled();
      expect(result).toEqual({ result: 'success' });
    });

    it('should authenticate when only request has prefix', async () => {
      const handler = vi.fn().mockResolvedValue({ result: 'success' });
      const protectedHandler = sdk.protect(101, handler);

      // Proof uses non-prefixed name
      const proof: EVMAuthProof = {
        challenge: {
          domain: {
            name: 'EVMAuth',
            version: '1',
            chainId: 1,
            verifyingContract: '0x1234567890123456789012345678901234567890',
          },
          primaryType: 'EVMAuthRequest',
          types: {
            EIP712Domain: [],
            EVMAuthRequest: [],
          },
          message: {
            serverName: 'test-server',
            resourceName: 'get-alerts', // Non-prefixed in proof
            requiredTokens: '[101]',
            walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            nonce: `${Date.now()}-${'a'.repeat(32)}`,
            issuedAt: Date.now().toString(),
            expiresAt: (Date.now() + 30000).toString(),
            purpose: 'test',
          },
        },
        signature: '0x' + 'a'.repeat(130),
      };

      mockRecoverTypedDataAddress.mockResolvedValue('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');

      // Request uses prefixed name
      const result = await protectedHandler({
        params: {
          name: 'client-prefix:get-alerts', // Prefixed in request
          arguments: {
            __evmauth: proof,
            data: 'test',
          },
        },
      });

      expect(handler).toHaveBeenCalled();
      expect(result).toEqual({ result: 'success' });
    });

    it('should authenticate when only proof has prefix', async () => {
      const handler = vi.fn().mockResolvedValue({ result: 'success' });
      const protectedHandler = sdk.protect(101, handler);

      // Proof uses prefixed name
      const proof: EVMAuthProof = {
        challenge: {
          domain: {
            name: 'EVMAuth',
            version: '1',
            chainId: 1,
            verifyingContract: '0x1234567890123456789012345678901234567890',
          },
          primaryType: 'EVMAuthRequest',
          types: {
            EIP712Domain: [],
            EVMAuthRequest: [],
          },
          message: {
            serverName: 'test-server',
            resourceName: 'claude-web:fetch-data', // Prefixed in proof
            requiredTokens: '[101]',
            walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            nonce: `${Date.now()}-${'a'.repeat(32)}`,
            issuedAt: Date.now().toString(),
            expiresAt: (Date.now() + 30000).toString(),
            purpose: 'test',
          },
        },
        signature: '0x' + 'a'.repeat(130),
      };

      mockRecoverTypedDataAddress.mockResolvedValue('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');

      // Request uses non-prefixed name
      const result = await protectedHandler({
        params: {
          name: 'fetch-data', // Non-prefixed in request
          arguments: {
            __evmauth: proof,
            data: 'test',
          },
        },
      });

      expect(handler).toHaveBeenCalled();
      expect(result).toEqual({ result: 'success' });
    });

    it('should fail when tool names do not match after extraction', async () => {
      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      // Proof for different tool
      const proof: EVMAuthProof = {
        challenge: {
          domain: {
            name: 'EVMAuth',
            version: '1',
            chainId: 1,
            verifyingContract: '0x1234567890123456789012345678901234567890',
          },
          primaryType: 'EVMAuthRequest',
          types: {
            EIP712Domain: [],
            EVMAuthRequest: [],
          },
          message: {
            serverName: 'test-server',
            resourceName: 'client:different-tool', // Different tool
            requiredTokens: '[101]',
            walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            nonce: `${Date.now()}-${'a'.repeat(32)}`,
            issuedAt: Date.now().toString(),
            expiresAt: (Date.now() + 30000).toString(),
            purpose: 'test',
          },
        },
        signature: '0x' + 'a'.repeat(130),
      };

      mockRecoverTypedDataAddress.mockResolvedValue('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');

      const result = await protectedHandler({
        params: {
          name: 'client:another-tool', // Different tool name
          arguments: {
            __evmauth: proof,
            data: 'test',
          },
        },
      });

      expect(handler).not.toHaveBeenCalled();
      const errorText = (result as any).content[0].text;
      expect(errorText).toContain('PROOF_INVALID');
    });

    it('should handle multiple colons in prefix', async () => {
      const handler = vi.fn().mockResolvedValue({ result: 'success' });
      const protectedHandler = sdk.protect(101, handler);

      const proof: EVMAuthProof = {
        challenge: {
          domain: {
            name: 'EVMAuth',
            version: '1',
            chainId: 1,
            verifyingContract: '0x1234567890123456789012345678901234567890',
          },
          primaryType: 'EVMAuthRequest',
          types: {
            EIP712Domain: [],
            EVMAuthRequest: [],
          },
          message: {
            serverName: 'test-server',
            resourceName: 'org:department:service:api-method', // Multiple colons
            requiredTokens: '[101]',
            walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            nonce: `${Date.now()}-${'a'.repeat(32)}`,
            issuedAt: Date.now().toString(),
            expiresAt: (Date.now() + 30000).toString(),
            purpose: 'test',
          },
        },
        signature: '0x' + 'a'.repeat(130),
      };

      mockRecoverTypedDataAddress.mockResolvedValue('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');

      const result = await protectedHandler({
        params: {
          name: 'another:prefix:api-method', // Different prefix, same tool
          arguments: {
            __evmauth: proof,
            data: 'test',
          },
        },
      });

      expect(handler).toHaveBeenCalled();
      expect(result).toEqual({ result: 'success' });
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with non-prefixed names', async () => {
      const handler = vi.fn().mockResolvedValue({ result: 'success' });
      const protectedHandler = sdk.protect(101, handler);

      const proof: EVMAuthProof = {
        challenge: {
          domain: {
            name: 'EVMAuth',
            version: '1',
            chainId: 1,
            verifyingContract: '0x1234567890123456789012345678901234567890',
          },
          primaryType: 'EVMAuthRequest',
          types: {
            EIP712Domain: [],
            EVMAuthRequest: [],
          },
          message: {
            serverName: 'test-server',
            resourceName: 'simple-tool', // No prefix
            requiredTokens: '[101]',
            walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            nonce: `${Date.now()}-${'a'.repeat(32)}`,
            issuedAt: Date.now().toString(),
            expiresAt: (Date.now() + 30000).toString(),
            purpose: 'test',
          },
        },
        signature: '0x' + 'a'.repeat(130),
      };

      mockRecoverTypedDataAddress.mockResolvedValue('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');

      const result = await protectedHandler({
        params: {
          name: 'simple-tool', // No prefix
          arguments: {
            __evmauth: proof,
            data: 'test',
          },
        },
      });

      expect(handler).toHaveBeenCalled();
      expect(result).toEqual({ result: 'success' });
    });

    it('should handle empty or missing tool names gracefully', async () => {
      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      const result = await protectedHandler({
        params: {
          // name is missing
          arguments: {
            data: 'test',
          },
        },
      });

      expect(handler).not.toHaveBeenCalled();
      const errorText = (result as any).content[0].text;
      expect(errorText).toContain('PROOF_MISSING');
    });
  });
});