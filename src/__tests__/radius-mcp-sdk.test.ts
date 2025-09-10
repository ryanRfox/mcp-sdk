
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RadiusMcpSdk } from '../radius-mcp-sdk';
import type { RadiusConfig, EVMAuthErrorResponse, EVMAuthProof } from '../types';

vi.mock('viem');

import * as viem from 'viem';

const mockRecoverTypedDataAddress = vi.mocked(viem.recoverTypedDataAddress);
const mockContract = {
  read: {
    balanceOf: vi.fn(),
    balanceOfBatch: vi.fn(),
  },
};

vi.mocked(viem.createPublicClient).mockReturnValue({} as viem.PublicClient);
vi.mocked(viem.http).mockReturnValue({} as ReturnType<typeof viem.http>);
vi.mocked(viem.getContract).mockReturnValue(
  mockContract as unknown as ReturnType<typeof viem.getContract>
);
vi.mocked(viem.isAddress).mockImplementation((addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr));

const mockBalanceOf = mockContract.read.balanceOf;
const mockBalanceOfBatch = mockContract.read.balanceOfBatch;

describe('Radius MCP SDK', () => {
  const config: RadiusConfig = {
    contractAddress: '0x1234567890123456789012345678901234567890',
    chainId: 1,
    rpcUrl: 'http://localhost:8545',
    debug: true,
  };

  const validProof: EVMAuthProof = {
    challenge: {
      domain: {
        name: 'EVMAuth',
        version: '1',
        chainId: 1,
        verifyingContract: '0x1234567890123456789012345678901234567890',
      },
      primaryType: 'EVMAuthRequest',
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        EVMAuthRequest: [
          { name: 'serverName', type: 'string' },
          { name: 'resourceName', type: 'string' },
          { name: 'requiredTokens', type: 'string' },
          { name: 'walletAddress', type: 'address' },
          { name: 'nonce', type: 'string' },
          { name: 'issuedAt', type: 'uint256' },
          { name: 'expiresAt', type: 'uint256' },
          { name: 'purpose', type: 'string' },
        ],
      },
      message: {
        serverName: 'test-server',
        resourceName: 'test_tool',
        requiredTokens: '[]',
        walletAddress: '0x1234567890123456789012345678901234567890' as `0x${string}`,
        nonce: `${Date.now()}-abcdef1234567890abcdef1234567890`,
        issuedAt: Date.now().toString(),
        expiresAt: (Date.now() + 30000).toString(),
        purpose: 'test',
      },
    },
    signature: `0x${'42'.repeat(65)}` as `0x${string}`,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock returns
    mockRecoverTypedDataAddress.mockResolvedValue(
      '0x1234567890123456789012345678901234567890' as `0x${string}`
    );
    mockBalanceOf.mockResolvedValue(1n);
    mockBalanceOfBatch.mockResolvedValue([1n, 1n, 1n]);
  });

  describe('Constructor', () => {
    it('should create instance with valid config', () => {
      const sdk = new RadiusMcpSdk(config);
      expect(sdk).toBeDefined();
    });

    it('should reject invalid contract address', () => {
      expect(
        () =>
          new RadiusMcpSdk({
            ...config,
            contractAddress: 'invalid' as `0x${string}`,
          })
      ).toThrow('Invalid contract address format');
    });

    it('should reject invalid chain ID', () => {
      expect(
        () =>
          new RadiusMcpSdk({
            ...config,
            chainId: -1,
          })
      ).toThrow('Chain ID must be a positive integer');
    });

    it('should reject invalid RPC URL', () => {
      expect(
        () =>
          new RadiusMcpSdk({
            ...config,
            rpcUrl: 'not-a-url',
          })
      ).toThrow('Invalid RPC URL format');
    });

    it('should use default chainId when not provided', () => {
      const sdkWithDefaults = new RadiusMcpSdk({
        contractAddress: config.contractAddress,
        // chainId omitted
        // rpcUrl omitted
      });
      expect(sdkWithDefaults).toBeDefined();
      // SDK should work with defaults (Radius Testnet)
    });

    it('should use default rpcUrl when not provided', () => {
      const sdkWithDefaults = new RadiusMcpSdk({
        contractAddress: config.contractAddress,
        chainId: 1223953, // Provide chainId but not rpcUrl
      });
      expect(sdkWithDefaults).toBeDefined();
    });

    it('should use only contractAddress with all defaults', () => {
      const sdkMinimal = new RadiusMcpSdk({
        contractAddress: config.contractAddress,
      });
      expect(sdkMinimal).toBeDefined();
    });
  });

  describe('Protect', () => {
    let sdk: RadiusMcpSdk;

    beforeEach(() => {
      sdk = new RadiusMcpSdk(config);
    });

    it('should reject request without proof', async () => {
      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      const result = (await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: {},
        },
      })) as EVMAuthErrorResponse;

      expect(handler).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('EVMAUTH_PROOF_MISSING');
    });

    it('should reject expired proof', async () => {
      const expiredProof: EVMAuthProof = {
        ...validProof,
        challenge: {
          ...validProof.challenge,
          message: {
            ...validProof.challenge.message,
            expiresAt: (Date.now() - 1000).toString(),
          },
        },
      };

      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      const result = (await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: expiredProof },
        },
      })) as EVMAuthErrorResponse;

      expect(handler).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('EVMAUTH_PROOF_EXPIRED');
    });

    it('should reject wrong chain ID', async () => {
      const wrongChainProof: EVMAuthProof = {
        ...validProof,
        challenge: {
          ...validProof.challenge,
          domain: {
            ...validProof.challenge.domain,
            chainId: 999,
          },
        },
      };

      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      const result = (await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: wrongChainProof },
        },
      })) as EVMAuthErrorResponse;

      expect(handler).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('EVMAUTH_CHAIN_MISMATCH');
    });

    it('should verify signature and check token ownership', async () => {
      const walletAddress = validProof.challenge.message.walletAddress;
      mockRecoverTypedDataAddress.mockResolvedValue(walletAddress);
      mockBalanceOf.mockResolvedValue(1n); // Has token

      const handler = vi.fn().mockResolvedValue({ success: true });
      const protectedHandler = sdk.protect(101, handler);

      const result = await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: validProof },
        },
      });

      expect(mockRecoverTypedDataAddress).toHaveBeenCalled();
      expect(mockBalanceOf).toHaveBeenCalledWith([walletAddress, 101n]);
      expect(handler).toHaveBeenCalledWith(
        { params: { arguments: {}, name: 'test_tool' } }, // Auth stripped
        undefined
      );
      expect(result).toEqual({ success: true });
    });

    it('should reject when signer does not match wallet', async () => {
      mockRecoverTypedDataAddress.mockResolvedValue(
        '0xdifferent1234567890123456789012345678901234'
      );

      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      const result = (await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: validProof },
        },
      })) as EVMAuthErrorResponse;

      expect(handler).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('EVMAUTH_SIGNER_MISMATCH');
    });

    it('should return payment required when user lacks tokens', async () => {
      const walletAddress = validProof.challenge.message.walletAddress;
      mockRecoverTypedDataAddress.mockResolvedValue(walletAddress);
      mockBalanceOf.mockResolvedValue(0n); // No tokens
      mockBalanceOfBatch.mockResolvedValue([0n, 0n]); // No tokens for batch query

      const handler = vi.fn();
      const protectedHandler = sdk.protect([101, 102], handler);

      const result = (await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: validProof },
        },
      })) as EVMAuthErrorResponse;

      expect(handler).not.toHaveBeenCalled();
      const error = JSON.parse(result.content[0].text);
      expect(error.error.code).toBe('PAYMENT_REQUIRED');
      expect(error.error.details.requiredTokens).toEqual([101, 102]);
    });

    it('should use batch check for multiple tokens', async () => {
      const walletAddress = validProof.challenge.message.walletAddress;
      mockRecoverTypedDataAddress.mockResolvedValue(walletAddress);
      mockBalanceOfBatch.mockResolvedValue([0n, 1n, 0n]); // Has token 102

      const handler = vi.fn().mockResolvedValue({ success: true });
      const protectedHandler = sdk.protect([101, 102, 103], handler);

      const result = await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: validProof },
        },
      });

      expect(mockBalanceOfBatch).toHaveBeenCalledWith([
        [walletAddress, walletAddress, walletAddress],
        [101n, 102n, 103n],
      ]);
      expect(handler).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should accept proof with prefixed resourceName if tool name matches', async () => {
      const prefixedProof: EVMAuthProof = {
        ...validProof,
        challenge: {
          ...validProof.challenge,
          message: {
            ...validProof.challenge.message,
            resourceName: 'ServerName:test_tool', // Prefixed with server name
          },
        },
      };

      const walletAddress = prefixedProof.challenge.message.walletAddress;
      mockRecoverTypedDataAddress.mockResolvedValue(walletAddress);
      mockBalanceOf.mockResolvedValue(1n); // Has token

      const handler = vi.fn().mockResolvedValue({ success: true });
      const protectedHandler = sdk.protect(101, handler);

      const result = await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: prefixedProof },
        },
      });

      expect(handler).toHaveBeenCalledWith(
        { params: { arguments: {}, name: 'test_tool' } },
        undefined
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('Nonce Validation', () => {
    let sdk: RadiusMcpSdk;

    beforeEach(() => {
      sdk = new RadiusMcpSdk(config);
    });

    it('should reject invalid nonce format', async () => {
      const badNonceProof: EVMAuthProof = {
        ...validProof,
        challenge: {
          ...validProof.challenge,
          message: {
            ...validProof.challenge.message,
            nonce: 'invalid-nonce',
          },
        },
      };

      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      const result = (await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: badNonceProof },
        },
      })) as EVMAuthErrorResponse;

      expect(result.content[0].text).toContain('EVMAUTH_NONCE_INVALID');
    });

    it('should reject old nonce', async () => {
      const oldTimestamp = Date.now() - 40000; // 40 seconds old (expired)
      const oldNonceProof: EVMAuthProof = {
        ...validProof,
        challenge: {
          ...validProof.challenge,
          message: {
            ...validProof.challenge.message,
            nonce: `${oldTimestamp}-abcdef1234567890abcdef1234567890`,
          },
        },
      };

      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      const result = (await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: oldNonceProof },
        },
      })) as EVMAuthErrorResponse;

      expect(result.content[0].text).toContain('EVMAUTH_PROOF_EXPIRED');
    });

    it('should reject future nonce (beyond 5s clock skew)', async () => {
      const futureTimestamp = Date.now() + 10000; // 10 seconds future (beyond 5s tolerance)
      const futureNonceProof: EVMAuthProof = {
        ...validProof,
        challenge: {
          ...validProof.challenge,
          message: {
            ...validProof.challenge.message,
            nonce: `${futureTimestamp}-abcdef1234567890abcdef1234567890`,
          },
        },
      };

      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      const result = (await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: futureNonceProof },
        },
      })) as EVMAuthErrorResponse;

      expect(result.content[0].text).toContain('EVMAUTH_NONCE_INVALID');
    });

    it('should accept nonce within 5s clock skew', async () => {
      const futureTimestamp = Date.now() + 3000; // 3 seconds future (within tolerance)
      const futureNonceProof: EVMAuthProof = {
        ...validProof,
        challenge: {
          ...validProof.challenge,
          message: {
            ...validProof.challenge.message,
            walletAddress: '0x1234567890123456789012345678901234567890' as `0x${string}`,
            nonce: `${futureTimestamp}-abcdef1234567890abcdef1234567890`,
            issuedAt: futureTimestamp.toString(),
            expiresAt: (futureTimestamp + 30000).toString(),
          },
        },
      };

      const walletAddress = futureNonceProof.challenge.message.walletAddress;
      mockRecoverTypedDataAddress.mockResolvedValue(walletAddress);
      mockBalanceOf.mockResolvedValue(1n); // Has token

      const handler = vi.fn().mockResolvedValue({ success: true });
      const protectedHandler = sdk.protect(101, handler);

      const result = await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: futureNonceProof },
        },
      });

      expect(handler).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should reject nonce with invalid timestamp format', async () => {
      const badTimestampProof: EVMAuthProof = {
        ...validProof,
        challenge: {
          ...validProof.challenge,
          message: {
            ...validProof.challenge.message,
            nonce: `not-a-number-abcdef1234567890abcdef1234567890`,
          },
        },
      };

      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      const result = (await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: badTimestampProof },
        },
      })) as EVMAuthErrorResponse;

      expect(result.content[0].text).toContain('EVMAUTH_NONCE_INVALID');
    });

    it('should reject nonce with invalid random component', async () => {
      const badRandomProof: EVMAuthProof = {
        ...validProof,
        challenge: {
          ...validProof.challenge,
          message: {
            ...validProof.challenge.message,
            nonce: `${Date.now()}-tooshort`, // Not 32 hex chars
          },
        },
      };

      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      const result = (await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: badRandomProof },
        },
      })) as EVMAuthErrorResponse;

      expect(result.content[0].text).toContain('EVMAUTH_NONCE_INVALID');
    });
  });

  describe('Proof Validation', () => {
    let sdk: RadiusMcpSdk;

    beforeEach(() => {
      sdk = new RadiusMcpSdk(config);
    });

    it('should reject proof with invalid signature format', async () => {
      const badSignatureProof: EVMAuthProof = {
        ...validProof,
        signature: '0xbadsig' as `0x${string}`, // Too short
      };

      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      const result = (await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: badSignatureProof },
        },
      })) as EVMAuthErrorResponse;

      expect(result.content[0].text).toContain('EVMAUTH_PROOF_MISSING');
    });

    it('should reject proof with invalid wallet address format', async () => {
      const badAddressProof: EVMAuthProof = {
        ...validProof,
        challenge: {
          ...validProof.challenge,
          message: {
            ...validProof.challenge.message,
            walletAddress: 'not-an-address' as `0x${string}`,
          },
        },
      };

      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      const result = (await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: badAddressProof },
        },
      })) as EVMAuthErrorResponse;

      expect(result.content[0].text).toContain('EVMAUTH_PROOF_MISSING');
    });

    it('should reject proof missing required fields', async () => {
      const incompleteProof = {
        challenge: {
          domain: validProof.challenge.domain,
          primaryType: validProof.challenge.primaryType,
          types: validProof.challenge.types,
          message: {
            // Missing required fields - only including walletAddress and nonce
            walletAddress: '0x1234567890123456789012345678901234567890',
            nonce: `${Date.now()}-abcdef1234567890abcdef1234567890`,
          } as any, // Type assertion needed since we're intentionally creating an invalid proof
        },
        signature: validProof.signature,
      };

      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      const result = (await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: incompleteProof },
        },
      })) as EVMAuthErrorResponse;

      expect(result.content[0].text).toContain('EVMAUTH_PROOF_MISSING');
    });
  });

  describe('Error Handling', () => {
    let sdk: RadiusMcpSdk;

    beforeEach(() => {
      sdk = new RadiusMcpSdk({ ...config, debug: false }); // Disable debug for error tests
    });

    it('should sanitize network errors', async () => {
      const walletAddress = validProof.challenge.message.walletAddress;
      mockRecoverTypedDataAddress.mockResolvedValue(walletAddress);
      mockBalanceOf.mockRejectedValue(new Error('ECONNREFUSED: Connection refused to node'));

      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      const result = (await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: validProof },
        },
      })) as EVMAuthErrorResponse;

      const error = JSON.parse(result.content[0].text);
      expect(error.error.code).toBe('NETWORK_ERROR');
      expect(error.error.message).toBe('Network error while verifying tokens');
      // Should not expose RPC URL when debug is false
      expect(error.error.details.rpcUrl).toBeUndefined();
    });

    it('should sanitize contract errors', async () => {
      const walletAddress = validProof.challenge.message.walletAddress;
      mockRecoverTypedDataAddress.mockResolvedValue(walletAddress);
      mockBalanceOf.mockRejectedValue(
        new Error('execution reverted: Ownable: caller is not the owner')
      );

      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      const result = (await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: validProof },
        },
      })) as EVMAuthErrorResponse;

      const error = JSON.parse(result.content[0].text);
      expect(error.error.code).toBe('CONTRACT_ERROR');
      expect(error.error.message).toBe('Contract interaction failed');
      // Should not expose revert reason
      expect(result.content[0].text).not.toContain('Ownable');
    });

    it('should include debug info when debug is enabled', async () => {
      // Spy must be created before SDK instantiation
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const debugSdk = new RadiusMcpSdk({ ...config, debug: true });

      const walletAddress = validProof.challenge.message.walletAddress;
      mockRecoverTypedDataAddress.mockResolvedValue(walletAddress);
      mockBalanceOf.mockRejectedValue(new Error('ETIMEDOUT'));

      const handler = vi.fn();
      const protectedHandler = debugSdk.protect(101, handler);

      const result = (await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: validProof },
        },
      })) as EVMAuthErrorResponse;

      // Should log both token check failure and unexpected error
      expect(consoleSpy).toHaveBeenCalled();

      // Check for error log (debug logger adds [ERROR] prefix)
      const errorCall = consoleSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('[ERROR]')
      );
      expect(errorCall).toBeDefined();
      
      // Check that error context is included
      const errorContext = errorCall?.[1] as Record<string, unknown>;
      expect(errorContext?.error).toMatchObject({
        message: 'ETIMEDOUT',
        name: 'Error',
      });

      const error = JSON.parse(result.content[0].text);
      // Should include RPC URL when debug is true
      expect(error.error.details.rpcUrl).toBe(config.rpcUrl);

      consoleSpy.mockRestore();
    });
  });

  describe('Caching', () => {
    it('should cache token balance results', async () => {
      const sdk = new RadiusMcpSdk(config);
      const walletAddress = validProof.challenge.message.walletAddress;

      mockRecoverTypedDataAddress.mockResolvedValue(walletAddress);
      mockBalanceOf.mockResolvedValue(1n);

      const handler = vi.fn().mockResolvedValue({ success: true });
      const protectedHandler = sdk.protect(101, handler);

      // First call
      await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: validProof },
        },
      });

      // Second call with new proof (same wallet)
      const newProof = {
        ...validProof,
        challenge: {
          ...validProof.challenge,
          message: {
            ...validProof.challenge.message,
            nonce: `${Date.now()}-fedcba9876543210fedcba9876543210`,
          },
        },
      };

      await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: newProof },
        },
      });

      // Should only call balanceOf once due to cache
      expect(mockBalanceOf).toHaveBeenCalledTimes(1);
    });

    it('should respect cache TTL', async () => {
      const sdk = new RadiusMcpSdk({
        ...config,
        cache: { ttl: 0.001, maxSize: 100 }, // Very short TTL
      });

      const walletAddress = validProof.challenge.message.walletAddress;
      mockRecoverTypedDataAddress.mockResolvedValue(walletAddress);
      mockBalanceOf.mockResolvedValue(1n);

      const handler = vi.fn().mockResolvedValue({ success: true });
      const protectedHandler = sdk.protect(101, handler);

      // First call
      await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: validProof },
        },
      });

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second call
      const newProof = {
        ...validProof,
        challenge: {
          ...validProof.challenge,
          message: {
            ...validProof.challenge.message,
            nonce: `${Date.now()}-fedcba9876543210fedcba9876543210`,
          },
        },
      };

      await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: newProof },
        },
      });

      // Should call twice due to cache expiry
      expect(mockBalanceOf).toHaveBeenCalledTimes(2);
    });
  });
});
