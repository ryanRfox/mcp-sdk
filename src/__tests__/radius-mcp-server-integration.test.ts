import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RadiusMcpSdk } from '../radius-mcp-sdk';
import type { RadiusConfig, MCPResponse, EVMAuthErrorResponse, EVMAuthProof } from '../types';

const {
  mockIsAddress,
  mockCreatePublicClient,
  mockHttp,
  mockGetContract,
  mockBalanceOf,
  mockBalanceOfBatch,
  mockRecoverTypedDataAddress,
} = vi.hoisted(() => {
  const mockBalanceOf = vi.fn();
  const mockBalanceOfBatch = vi.fn();

  const mockContract = {
    read: {
      balanceOf: mockBalanceOf,
      balanceOfBatch: mockBalanceOfBatch,
    },
  };

  const mockPublicClient = {};
  const mockCreatePublicClient = vi.fn(() => mockPublicClient);
  const mockHttp = vi.fn(() => ({}));
  const mockGetContract = vi.fn(() => mockContract);
  const mockIsAddress = vi.fn(() => true);
  const mockRecoverTypedDataAddress = vi.fn();

  return {
    mockIsAddress,
    mockCreatePublicClient,
    mockHttp,
    mockGetContract,
    mockBalanceOf,
    mockBalanceOfBatch,
    mockContract,
    mockPublicClient,
    mockRecoverTypedDataAddress,
  };
});

vi.mock('viem', () => ({
  createPublicClient: mockCreatePublicClient,
  http: mockHttp,
  getContract: mockGetContract,
  isAddress: mockIsAddress,
  recoverTypedDataAddress: mockRecoverTypedDataAddress,
}));

describe('Radius MCP Server Integration', () => {
  const mockConfig: RadiusConfig = {
    contractAddress: '0x1234567890123456789012345678901234567890',
    chainId: 1223953,
    rpcUrl: 'https://rpc.testnet.radiustech.xyz',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockRecoverTypedDataAddress.mockResolvedValue(
      '0x742d35Cc6634C0532925a3b844Bc9e7Ed1A0aC0E' as `0x${string}`
    );
    mockBalanceOf.mockResolvedValue(1n);
    mockBalanceOfBatch.mockResolvedValue([1n, 1n, 1n]);
  });

  function setupSuccessfulAuth(
    walletAddress: string = '0x742d35Cc6634C0532925a3b844Bc9e7Ed1A0aC0E'
  ) {
    mockRecoverTypedDataAddress.mockResolvedValue(walletAddress);
    mockBalanceOf.mockResolvedValue(1n);
  }

  function createServerProof(options?: {
    walletAddress?: string;
    serverName?: string;
    resourceName?: string;
    requiredTokens?: number[];
    chainId?: number;
  }): EVMAuthProof {
    const walletAddress = options?.walletAddress || '0x742d35Cc6634C0532925a3b844Bc9e7Ed1A0aC0E';
    const now = Date.now();

    return {
      challenge: {
        domain: {
          name: 'EVMAuth',
          version: '1',
          chainId: options?.chainId || 1223953,
          verifyingContract: mockConfig.contractAddress,
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
            { name: 'issuedAt', type: 'string' },
            { name: 'expiresAt', type: 'string' },
            { name: 'purpose', type: 'string' },
          ],
        },
        message: {
          serverName: options?.serverName || 'Test Server',
          resourceName: options?.resourceName || 'test_tool',
          requiredTokens: JSON.stringify(options?.requiredTokens || []),
          walletAddress: walletAddress as `0x${string}`,
          nonce: `${now}-${Math.random().toString(16).slice(2).padEnd(32, '0')}`,
          issuedAt: now.toString(),
          expiresAt: (now + 30000).toString(),
          purpose: 'test',
        },
      },
      signature: `0x${'42'.repeat(65)}` as `0x${string}`,
    };
  }

  describe('Server Proof Format', () => {
    it('should handle server-generated proof with correct format', async () => {
      const sdk = new RadiusMcpSdk(mockConfig);
      const handler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'Success' }] });
      const protectedHandler = sdk.protect(101, handler);

      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7Ed1A0aC0E';
      const serverProof = createServerProof({ walletAddress });

      setupSuccessfulAuth(walletAddress);

      const result = await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: serverProof },
        },
      });

      expect(handler).toHaveBeenCalledWith(
        { params: { arguments: {}, name: 'test_tool' } },
        undefined
      );
      expect((result as MCPResponse).content?.[0]?.text).toBe('Success');
    });

    it('should handle server proof without top-level chainId', async () => {
      const sdk = new RadiusMcpSdk(mockConfig);
      const handler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'Success' }] });
      const protectedHandler = sdk.protect(101, handler);

      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7Ed1A0aC0E';
      const proof = createServerProof({ walletAddress });
      delete (proof as Partial<EVMAuthProof & { chainId?: number }>).chainId;

      setupSuccessfulAuth(walletAddress);

      const result = await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: proof },
        },
      });

      expect(handler).toHaveBeenCalledWith(
        { params: { arguments: {}, name: 'test_tool' } },
        undefined
      );
      expect((result as MCPResponse).content?.[0]?.text).toBe('Success');
    });
  });

  describe('Error Response Guidance', () => {
    it('should guide Claude to connect Radius MCP Server when proof is missing', async () => {
      const sdk = new RadiusMcpSdk(mockConfig);
      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      const result = await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: {},
        },
      });

      const errorObj = JSON.parse((result as EVMAuthErrorResponse).content?.[0]?.text || '{}');
      expect(errorObj.error.claude_action.steps[0]).toBe(
        'Call the "authenticate_and_purchase" tool on Radius MCP Server'
      );
      expect(errorObj.error.claude_action.tool.server).toBe('radius-mcp-server');
      expect(errorObj.error.claude_action.tool.name).toBe('authenticate_and_purchase');

      // Verify requiredTokens is included
      expect(errorObj.error.details.requiredTokens).toEqual([101]);

      // Verify enhanced messaging
      expect(errorObj.error.claude_action.important_note).toContain(
        '__evmauth parameter is ALWAYS accepted'
      );
      expect(errorObj.error.claude_action.example).toBeDefined();
      expect(errorObj.error.claude_action.example.retry_call.arguments.__evmauth).toBeDefined();
    });

    it('should provide clear purchase instructions with token IDs', async () => {
      const sdk = new RadiusMcpSdk(mockConfig);
      const handler = vi.fn();
      const protectedHandler = sdk.protect([101, 102, 103], handler);

      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7Ed1A0aC0E';
      const proof = createServerProof({ walletAddress, requiredTokens: [101, 102, 103] });

      mockRecoverTypedDataAddress.mockResolvedValue(walletAddress);
      mockBalanceOf.mockResolvedValue(0n);
      mockBalanceOfBatch.mockResolvedValue([0n, 0n, 0n]);

      const result = await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: proof },
        },
      });

      const errorObj = JSON.parse((result as EVMAuthErrorResponse).content?.[0]?.text || '{}');
      expect(errorObj.error.code).toBe('PAYMENT_REQUIRED');
      expect(errorObj.error.claude_action.tool.name).toBe('authenticate_and_purchase');
      expect(errorObj.error.claude_action.tool.arguments.tokenIds).toEqual([101, 102, 103]);
      expect(errorObj.error.claude_action.steps).toContain(
        'Call "authenticate_and_purchase" with the required tokens'
      );
    });
  });

  describe('Multi-token Support', () => {
    it('should allow access if user owns ANY of the required tokens', async () => {
      const sdk = new RadiusMcpSdk(mockConfig);
      const handler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'Success' }] });
      const protectedHandler = sdk.protect([101, 102, 103], handler);

      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7Ed1A0aC0E';
      const proof = createServerProof({ walletAddress });

      mockRecoverTypedDataAddress.mockResolvedValue(walletAddress);
      mockBalanceOfBatch.mockResolvedValue([0n, 1n, 0n]);

      const result = await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: proof },
        },
      });

      expect(handler).toHaveBeenCalledWith(
        { params: { arguments: {}, name: 'test_tool' } },
        undefined
      );
      expect((result as MCPResponse).content?.[0]?.text).toBe('Success');
    });

    it('should use batch queries for multiple tokens', async () => {
      const sdk = new RadiusMcpSdk(mockConfig);
      const handler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'Success' }] });
      const protectedHandler = sdk.protect([101, 102, 103, 104, 105], handler);

      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7Ed1A0aC0E';
      const proof = createServerProof({ walletAddress });

      mockRecoverTypedDataAddress.mockResolvedValue(walletAddress);
      mockBalanceOfBatch.mockResolvedValue([0n, 0n, 1n, 0n, 0n]);

      await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: proof },
        },
      });

      expect(mockBalanceOfBatch).toHaveBeenCalledTimes(1);
      expect(mockBalanceOf).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith(
        { params: { arguments: {}, name: 'test_tool' } },
        undefined
      );
    });
  });

  describe('Real Server Proof Format', () => {
    it('should handle actual server-generated proof structure', async () => {
      const sdk = new RadiusMcpSdk(mockConfig);
      const handler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'Success' }] });
      const protectedHandler = sdk.protect(101, handler);

      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7Ed1A0aC0E';

      const serverResponse = {
        proof: createServerProof({
          walletAddress,
          serverName: 'radius-mcp-server',
          resourceName: 'mcp_tool',
        }),
      };

      setupSuccessfulAuth(walletAddress);

      const result = await protectedHandler({
        params: {
          name: 'mcp_tool',
          arguments: { __evmauth: serverResponse.proof },
        },
      });

      expect(handler).toHaveBeenCalledWith(
        { params: { arguments: {}, name: 'mcp_tool' } },
        undefined
      );
      expect((result as MCPResponse).content?.[0]?.text).toBe('Success');
    });

    it('should reject malformed server proofs', async () => {
      const sdk = new RadiusMcpSdk(mockConfig);
      const handler = vi.fn();
      const protectedHandler = sdk.protect(101, handler);

      const malformedProof = {
        someField: 'value',
        anotherField: 123,
      };

      const result = await protectedHandler({
        params: {
          name: 'test_tool',
          arguments: { __evmauth: malformedProof as any },
        },
      });

      expect(handler).not.toHaveBeenCalled();
      const errorObj = JSON.parse((result as EVMAuthErrorResponse).content?.[0]?.text || '{}');
      expect(errorObj.error.code).toBe('EVMAUTH_PROOF_MISSING');
    });
  });
});
