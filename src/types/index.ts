export * from './errors.js';

// MCP SDK Types (from @modelcontextprotocol/sdk)
export interface RequestHandlerExtra {
  request?: {
    method: string;
    params?: unknown;
  };
  sessionId?: string;
  signal?: AbortSignal;
  meta?: Record<string, unknown>;
}

export interface CallToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: unknown;
  }>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

// FastMCP Context Type
export interface FastMcpContext {
  log?: {
    debug?: (message: string, data?: unknown) => void;
    error?: (message: string, data?: unknown) => void;
    info?: (message: string, data?: unknown) => void;
    warn?: (message: string, data?: unknown) => void;
  };
  reportProgress?: (progress: { progress: number; total: number }) => Promise<void>;
  streamContent?: (content: unknown) => Promise<void>;
  session?: Record<string, unknown>;
  [key: string]: unknown;
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
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
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
 * FastMCP handler pattern - receives full request object
 * This is an alias for the existing MCPHandler for clarity
 */
export type FastMCPHandler = MCPHandler;

/**
 * Standard MCP handler pattern - receives parsed arguments
 * @template TArgs - Type of the handler arguments
 * @template TResult - Type of the handler result
 */
export type StandardMCPHandler<TArgs = any, TResult = any> = 
  (args: TArgs, extra?: unknown) => Promise<TResult> | TResult;

/**
 * Universal MCP handler supporting both patterns
 * @template TArgs - Type of the handler arguments (for Standard pattern)
 * @template TResult - Type of the handler result (for Standard pattern)
 */
export type UniversalMCPHandler<TArgs = any, TResult = any> = 
  | StandardMCPHandler<TArgs, TResult>
  | FastMCPHandler;

/**
 * Pattern detection result with confidence scoring
 */
export interface DetectionResult {
  pattern: 'fastmcp' | 'standard';
  confidence: number; // 0-1 scale
  signals: string[]; // Detection signals used
}

/**
 * Optional pattern hint for explicit pattern specification
 */
export interface PatternHint {
  pattern?: 'fastmcp' | 'standard';
}

/**
 * Options for the protect method
 */
export interface ProtectOptions extends PatternHint {
  // Future options can be added here
}

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
