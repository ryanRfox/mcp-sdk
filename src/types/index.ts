export * from './errors.js';

/**
 * Debug logging levels for the Radius SDK
 * - 'none': No debug logging
 * - 'basic': Basic auth flow start/end (default for debug: true)
 * - 'verbose': Detailed step-by-step flow
 * - 'transport': Includes raw request/response data (sanitized)
 * - 'trace': Everything including internal state changes
 */
export type DebugLevel = 'none' | 'basic' | 'verbose' | 'transport' | 'trace';

/**
 * Debug configuration for granular logging control
 */
export interface DebugConfig {
  /**
   * Debug logging level
   * @default 'none'
   */
  level: DebugLevel;
  
  /**
   * Include timestamps in debug output
   * @default true
   */
  timestamps?: boolean;
  
  /**
   * Custom logger function (defaults to console.log)
   */
  logger?: (message: string, context?: Record<string, unknown>) => void;
}

export interface RadiusConfig {
  /**
   * ERC-1155 contract address for token ownership verification
   * @example "0x5448Dc20ad9e0cDb5Dd0db25e814545d1aa08D96"
   */
  contractAddress: `0x${string}`;

  /**
   * Chain ID of the blockchain network
   * @default 1223953 // Radius Testnet
   * @example 1223953 // Radius Testnet
   */
  chainId?: number;

  /**
   * RPC endpoint URL for on-chain queries
   * @default "https://rpc.testnet.radiustech.xyz"
   * @example "https://rpc.testnet.radiustech.xyz"
   */
  rpcUrl?: string;

  /**
   * Cache configuration for token balance queries
   * @default { ttl: 60, maxSize: 1000 }
   */
  cache?: CacheConfig;

  /**
   * Debug logging configuration
   * - boolean: true maps to 'basic' level, false to 'none'
   * - DebugLevel: string literal for specific level
   * - DebugConfig: object for full control
   * @default false
   */
  debug?: boolean | DebugLevel | DebugConfig;
}

export interface CacheConfig {
  /**
   * Time-to-live in seconds for cached balances
   * @default 60
   */
  ttl: number;

  /**
   * Maximum number of cached entries
   * @default 1000
   */
  maxSize: number;

  /**
   * Disable caching entirely
   * @default false
   */
  disabled?: boolean;
}

/**
 * Generic MCP handler function signature
 * Compatible with FastMCP, raw MCP protocol, and other implementations
 */
export type MCPHandler = (request: MCPRequest, extra?: unknown) => Promise<MCPResponse>;

/**
 * MCP request structure with EVMAuth proof support
 */
export interface MCPRequest {
  method?: string;
  params?: {
    arguments?: Record<string, unknown> & {
      __evmauth?: EVMAuthProof;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * MCP response structure
 */
export interface MCPResponse {
  content?: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface EVMAuthProof {
  challenge: {
    domain: {
      name: 'EVMAuth';
      version: '1';
      chainId: number;
      verifyingContract: `0x${string}`;
    };
    primaryType: 'EVMAuthRequest';
    types: {
      EIP712Domain: Array<{ name: string; type: string }>;
      EVMAuthRequest: Array<{ name: string; type: string }>;
    };
    message: {
      serverName: string;
      resourceName: string;
      requiredTokens: string;
      walletAddress: `0x${string}`;
      nonce: string;
      issuedAt: string;
      expiresAt: string;
      purpose?: string;
      requestHash?: string;
    };
  };
  signature: `0x${string}`;
}


export interface EVMAuthErrorResponse {
  content: Array<{
    type: 'text';
    text: string; // JSON-stringified error object
  }>;
  [key: string]: unknown;
}

export type ProofErrorCode =
  | 'PROOF_MISSING'
  | 'PROOF_EXPIRED'
  | 'PROOF_INVALID'
  | 'CHAIN_MISMATCH'
  | 'CONTRACT_MISMATCH'
  | 'SIGNATURE_INVALID'
  | 'SIGNER_MISMATCH'
  | 'NONCE_INVALID';
