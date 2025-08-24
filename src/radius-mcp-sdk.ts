
import {
  type Address,
  createPublicClient,
  type GetContractReturnType,
  getContract,
  http,
  isAddress,
  type PublicClient,
  recoverTypedDataAddress,
  type TypedData,
} from 'viem';
import type { 
  CacheConfig, 
  RadiusConfig, 
  MCPRequest, 
  EVMAuthErrorResponse, 
  EVMAuthProof, 
  ProofErrorCode,
  RequestHandlerExtra,
  CallToolResult,
  FastMcpContext
} from './types/index.js';
import { RadiusError } from './types/errors.js';

const ERC1155_ABI = [
  {
    inputs: [
      { name: 'account', type: 'address' as const },
      { name: 'id', type: 'uint256' as const },
    ],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' as const }],
    stateMutability: 'view' as const,
    type: 'function' as const,
  },
  {
    inputs: [
      { name: 'accounts', type: 'address[]' as const },
      { name: 'ids', type: 'uint256[]' as const },
    ],
    name: 'balanceOfBatch',
    outputs: [{ name: '', type: 'uint256[]' as const }],
    stateMutability: 'view' as const,
    type: 'function' as const,
  },
] as const;

class TokenCache {
  private cache = new Map<string, { value: boolean; timestamp: number }>();

  constructor(private config: CacheConfig) {}

  get(wallet: string, tokenId: number): boolean | undefined {
    if (this.config.disabled) return undefined;

    const key = `${wallet.toLowerCase()}-${tokenId}`;
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    const age = Date.now() - entry.timestamp;
    if (age > this.config.ttl * 1000) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(wallet: string, tokenId: number, value: boolean): void {
    if (this.config.disabled) return;

    const key = `${wallet.toLowerCase()}-${tokenId}`;

    // Enforce max size
    if (this.cache.size >= this.config.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

export class RadiusMcpSdk {
  private publicClient: PublicClient;
  private contract: GetContractReturnType<typeof ERC1155_ABI, PublicClient>;
  private cache: TokenCache;
  private config: Required<RadiusConfig>;
  // @deprecated Pattern cache no longer needed with overload resolution
  // private handlerPatternCache = new WeakMap<Function, DetectionResult>();

  constructor(config: RadiusConfig) {
    const configWithDefaults = {
      ...config,
      chainId: config.chainId ?? 1223953, // Default to Radius Testnet
      rpcUrl: config.rpcUrl ?? 'https://rpc.testnet.radiustech.xyz',
    };

    if (!isAddress(configWithDefaults.contractAddress)) {
      throw new RadiusError('INVALID_CONFIG', 'Invalid contract address format');
    }

    if (!Number.isInteger(configWithDefaults.chainId) || configWithDefaults.chainId <= 0) {
      throw new RadiusError('INVALID_CONFIG', 'Chain ID must be a positive integer');
    }

    try {
      new URL(configWithDefaults.rpcUrl);
    } catch {
      throw new RadiusError('INVALID_CONFIG', 'Invalid RPC URL format');
    }

    this.config = {
      ...configWithDefaults,
      cache: {
        ttl: 60,
        maxSize: 1000,
        disabled: false,
        ...configWithDefaults.cache,
      },
      debug: configWithDefaults.debug || false,
    } as Required<RadiusConfig>;

    this.publicClient = createPublicClient({
      transport: http(configWithDefaults.rpcUrl, {
        batch: true,
        retryCount: 3,
        timeout: 10000,
      }),
    });

    this.contract = getContract({
      address: configWithDefaults.contractAddress,
      abi: ERC1155_ABI,
      client: this.publicClient,
    });

    this.cache = new TokenCache(this.config.cache);

    // Warn if debug mode is enabled
    if (config.debug) {
      console.warn(
        '\n⚠️  WARNING: Debug mode is enabled in Radius MCP SDK\n' +
        '   Debug mode may expose sensitive information in logs.\n' +
        '   DO NOT use debug mode in production environments!\n'
      );
    }
  }

  /* @deprecated Now using TypeScript overload resolution instead
  private _detectHandlerPattern(handler: Function, firstArg: any): DetectionResult {
    // Check for decorator hint first
    if ((handler as any).__pattern) {
      const pattern = (handler as any).__pattern as 'fastmcp' | 'standard';
      return { pattern, confidence: 1.0, signals: ['decorator-hint'] };
    }

    // Check cache
    // const cached = this.handlerPatternCache.get(handler);
    // if (cached && cached.confidence > 0.8) {
    //   return cached;
    // }

    const signals: string[] = [];
    let standardScore = 0;
    let fastmcpScore = 0;

    // Signal 1: Parameter count (most reliable)
    const paramCount = handler.length;
    if (paramCount === 1) {
      standardScore += 40;
      signals.push('single-param');
    } else if (paramCount === 2) {
      fastmcpScore += 40;
      signals.push('dual-param');
    }

    // Signal 2: Function signature analysis
    const funcStr = handler.toString();
    if (funcStr.includes('request.params') || funcStr.includes('request?.params')) {
      fastmcpScore += 30;
      signals.push('request-access');
    }
    if (funcStr.includes('request.method') || funcStr.includes('request?.method')) {
      fastmcpScore += 10;
      signals.push('method-access');
    }

    // Signal 3: First argument structure analysis
    if (firstArg && typeof firstArg === 'object') {
      if ('method' in firstArg || 'params' in firstArg) {
        fastmcpScore += 20;
        signals.push('request-shape');
      } else if (!('method' in firstArg) && !('params' in firstArg)) {
        standardScore += 20;
        signals.push('args-shape');
      }
    }

    const pattern: 'fastmcp' | 'standard' = standardScore > fastmcpScore ? 'standard' : 'fastmcp';
    const confidence = Math.max(standardScore, fastmcpScore) / 100;
    
    const result: DetectionResult = { pattern, confidence, signals };
    
    // Cache high-confidence results
    // if (confidence > 0.7) {
    //   this.handlerPatternCache.set(handler, result);
    // }
    
    if (this.config.debug) {
      console.log('[Radius] Pattern detection', {
        pattern,
        confidence: `${Math.round(confidence * 100)}%`,
        signals,
        standardScore,
        fastmcpScore
      });
    }
    
    return result;
  } */

  /* @deprecated No longer needed with overload-based implementation
   * Check if an error is due to pattern mismatch
   *
  private isPatternMismatchError(error: any): boolean {
    const errorMessage = error?.message || '';
    return errorMessage.includes('Cannot read properties') || 
           errorMessage.includes('is not a function') ||
           errorMessage.includes('Expected') ||
           errorMessage.includes('undefined');
  }

   * Execute handler with specific pattern
   *
  private async executePattern(
    pattern: 'standard' | 'fastmcp',
    handler: any,
    requestOrArgs: any,
    extra?: unknown
  ): Promise<any> {
    if (pattern === 'fastmcp') {
      // FastMCP pattern - pass full request
      return await handler(requestOrArgs, extra);
    } else {
      // Standard MCP pattern - pass just arguments
      const args = requestOrArgs?.params?.arguments || requestOrArgs;
      return await handler(args, extra);
    }
  }
  */

  /* @deprecated Now using direct handler invocation in overloads
  private async _handleWithFallback(
    primaryPattern: 'standard' | 'fastmcp',
    handler: any,
    requestOrArgs: any,
    extra?: unknown
  ): Promise<any> {
    try {
      return await this.executePattern(primaryPattern, handler, requestOrArgs, extra);
    } catch (error) {
      if (this.isPatternMismatchError(error)) {
        const fallbackPattern = primaryPattern === 'standard' ? 'fastmcp' : 'standard';
        if (this.config.debug) {
          console.log(`[Radius] Pattern mismatch detected, trying fallback: ${fallbackPattern}`);
        }
        try {
          return await this.executePattern(fallbackPattern, handler, requestOrArgs, extra);
        } catch (fallbackError) {
          // If fallback also fails, throw original error with helpful message
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(
            `Handler pattern detection failed.\n` +
            `Tried: ${primaryPattern} (failed), ${fallbackPattern} (failed)\n` +
            `Hint: Use explicit pattern option or check handler signature\n` +
            `Original error: ${errorMessage}`
          );
        }
      }
      throw error;
    }
  } */

  /**
   * Overload 1: MCP SDK Pattern - MOST SPECIFIC
   * Matches handlers with RequestHandlerExtra parameter returning Promise<CallToolResult>
   */
  protect<TArgs>(
    tokenId: number | number[],
    handler: (args: TArgs, extra: RequestHandlerExtra) => Promise<CallToolResult>
  ): (args: TArgs, extra: RequestHandlerExtra) => Promise<CallToolResult>;

  /**
   * Overload 2: FastMCP Pattern - SPECIFIC
   * Matches handlers with FastMcpContext parameter (any return type)
   */
  protect<TArgs, TResult>(
    tokenId: number | number[],
    handler: (args: TArgs, context: FastMcpContext) => TResult
  ): (args: TArgs, context: FastMcpContext) => TResult;

  /**
   * Overload 3: Generic Fallback - LEAST SPECIFIC
   * Catches all other function patterns
   */
  protect<T extends Function>(
    tokenId: number | number[],
    handler: T
  ): T;

  /**
   * Implementation for all three overload patterns
   * Uses TypeScript's assignability rules to match patterns correctly
   */
  protect(
    tokenId: number | number[],
    handler: any
  ): any {
    const tokenIds = Array.isArray(tokenId) ? tokenId : [tokenId];

    // Determine the pattern based on handler characteristics
    // This is a runtime check since TypeScript's overload resolution happens at compile time
    const handlerStr = handler.toString();
    const paramCount = handler.length;
    
    // Pattern detection based on function signature
    const isMcpSdkPattern = paramCount === 2 || handlerStr.includes('extra') || handlerStr.includes('RequestHandlerExtra');
    const isFastMcpPattern = handlerStr.includes('context') || handlerStr.includes('FastMcpContext');
    
    // Return wrapped handler based on detected pattern
    const self = this;
    return async function(...args: any[]): Promise<any> {
      const authFlowId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      
      // Determine which pattern we're handling at runtime
      let pattern: 'mcp-sdk' | 'fastmcp' | 'generic';
      let argsToCheck: any;
      let extraParam: any;
      
      if (args.length >= 2 && (isMcpSdkPattern || args[1] && typeof args[1] === 'object' && 'request' in args[1])) {
        // MCP SDK pattern: (args, extra)
        pattern = 'mcp-sdk';
        argsToCheck = args[0];
        extraParam = args[1];
      } else if (args.length >= 2 && (isFastMcpPattern || args[1] && typeof args[1] === 'object')) {
        // FastMCP pattern: (args, context)
        pattern = 'fastmcp';
        argsToCheck = args[0];
        extraParam = args[1];
      } else {
        // Generic pattern: single argument or other
        pattern = 'generic';
        argsToCheck = args[0];
        extraParam = args[1];
      }

      // Extract proof from arguments
      let proof: EVMAuthProof | null = null;
      let toolName: string | undefined;
      
      // For generic pattern, check if args[0] is already a request object
      let request: MCPRequest;
      if (pattern === 'generic' && argsToCheck?.params?.arguments) {
        // It's already a request object (like in tests)
        request = argsToCheck as MCPRequest;
        toolName = argsToCheck.params?.name || undefined;
      } else {
        // Create a synthetic request for proof extraction
        request = {
          params: {
            arguments: argsToCheck || {}
          }
        };
        // Don't set toolName yet - will extract from proof if present
      }
      
      proof = self.extractProof(request);
      
      // If we don't have a toolName yet but have a proof, use the resource name from the proof
      if (!toolName && proof) {
        toolName = proof.challenge.message.resourceName;
      }
      
      // Fallback to pattern name if still no toolName
      if (!toolName) {
        toolName = pattern;
      }

      if (self.config.debug) {
        console.log('[Radius] Auth flow started', {
          step: 'auth_flow_start',
          authFlowId,
          pattern,
          requiredTokens: tokenIds,
          hasProof: !!proof,
          hint: '__evmauth parameter is accepted on ALL protected tools regardless of schema',
        });
      }

      try {
        if (self.config.debug) {
          console.log('[Radius] Request inspection', {
            step: 'request_inspection',
            authFlowId,
            pattern,
            toolName,
          });
        }

        // Check for proof
        if (!proof) {
          if (self.config.debug) {
            console.log('[Radius] Auth flow', {
              step: 'proof_missing',
              authFlowId,
              success: false,
              reason: 'No proof provided in request',
            });
          }
          return self.errorResponse('PROOF_MISSING', tokenIds, toolName);
        }

        if (self.config.debug) {
          console.log('[Radius] Auth flow', {
            step: 'proof_verification_start',
            authFlowId,
            proofPurpose: proof.challenge.message.purpose,
            proofExpiry: new Date(parseInt(proof.challenge.message.expiresAt)).toISOString(),
          });
        }

        // Extract arguments for verification
        const params = request?.params as { arguments?: Record<string, unknown> };
        const toolArguments = params?.arguments || {};
        const argsForVerification = { ...toolArguments };
        delete argsForVerification.__evmauth;

        const walletAddress = await self.verifyProof(proof, toolName, argsForVerification);

        if (self.config.debug) {
          console.log('[Radius] Auth flow', {
            step: 'proof_verification_success',
            authFlowId,
            wallet: walletAddress,
            success: true,
          });
        }

        if (self.config.debug) {
          console.log('[Radius] Auth flow', {
            step: 'token_check_start',
            authFlowId,
            wallet: walletAddress,
            requiredTokens: tokenIds,
          });
        }

        const hasAccess = await self.checkAccess(walletAddress, tokenIds);

        if (!hasAccess) {
          if (self.config.debug) {
            console.log('[Radius] Auth flow', {
              step: 'token_check_failed',
              authFlowId,
              wallet: walletAddress,
              requiredTokens: tokenIds,
              success: false,
              reason: 'User does not own required tokens',
            });
          }
          return self.paymentRequiredResponse(tokenIds, walletAddress, toolName);
        }

        if (self.config.debug) {
          console.log('[Radius] Auth flow', {
            step: 'auth_flow_complete',
            authFlowId,
            wallet: walletAddress,
            success: true,
            grantedAccess: true,
          });
        }

        // Clean the arguments by removing __evmauth
        let cleanedFirstArg: any;
        
        if (pattern === 'generic' && argsToCheck?.params?.arguments) {
          // For request objects, clean the nested arguments
          cleanedFirstArg = {
            ...argsToCheck,
            params: {
              ...argsToCheck.params,
              arguments: (() => {
                const cleanArgs = { ...argsToCheck.params.arguments };
                delete cleanArgs.__evmauth;
                return cleanArgs;
              })()
            }
          };
        } else {
          // For direct arguments, clean at top level
          cleanedFirstArg = { ...argsToCheck };
          delete cleanedFirstArg.__evmauth;
        }
        
        // Call the original handler with cleaned arguments
        if (pattern === 'mcp-sdk') {
          // MCP SDK: pass cleaned args and RequestHandlerExtra
          return await handler(cleanedFirstArg, extraParam);
        } else if (pattern === 'fastmcp') {
          // FastMCP: pass cleaned args and context
          return await handler(cleanedFirstArg, extraParam);
        } else {
          // Generic: pass cleaned first argument plus any additional arguments
          // For compatibility with tests expecting (request, undefined)
          return await handler(cleanedFirstArg, extraParam);
        }
      } catch (error) {
        if (self.config.debug) {
          console.log('[Radius] Auth flow', {
            step: 'auth_flow_error',
            authFlowId,
            success: false,
            error: (error as Error).message,
            errorCode: (error as RadiusError).code || 'UNKNOWN',
          });
        }
        return self.handleError(error as Error, tokenIds, toolName);
      }
    };
  }

  private extractProof(request: MCPRequest): EVMAuthProof | null {
    const args = request?.params?.arguments;
    if (!args || typeof args !== 'object') return null;

    let auth = (args as Record<string, unknown>).__evmauth;
    if (!auth) return null;

    if (typeof auth === 'string') {
      try {
        auth = JSON.parse(auth);
        if (this.config.debug) {
          console.log('[Radius] Parsed stringified proof', {
            step: 'proof_extraction',
            wasStringified: true,
            success: true,
          });
        }
      } catch (error) {
        if (this.config.debug) {
          console.log('[Radius] Failed to parse stringified proof', {
            step: 'proof_extraction',
            error: (error as Error).message,
            success: false,
          });
        }
        return null;
      }
    }

    if (typeof auth !== 'object') return null;

    if (this.isValidProof(auth)) {
      return auth as EVMAuthProof;
    }

    return null;
  }

  private isValidProof(obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') return false;

    try {
      const proof = obj as Record<string, unknown>;

      if (!proof.challenge || typeof proof.challenge !== 'object') return false;
      if (!proof.signature || typeof proof.signature !== 'string') return false;

      if (!/^0x[0-9a-f]{130}$/i.test(proof.signature)) {
        return false;
      }

      const challenge = proof.challenge as Record<string, unknown>;

      if (!challenge.domain || typeof challenge.domain !== 'object') return false;
      if (!challenge.message || typeof challenge.message !== 'object') return false;
      if (!challenge.types || typeof challenge.types !== 'object') return false;
      if (!challenge.primaryType || typeof challenge.primaryType !== 'string') return false;

      const message = challenge.message as Record<string, unknown>;

      const requiredStringFields = [
        'walletAddress',
        'nonce',
        'issuedAt',
        'expiresAt',
        'resourceName',
        'serverName',
        'requiredTokens',
      ];

      for (const field of requiredStringFields) {
        if (typeof message[field] !== 'string') return false;
      }

      if (!/^0x[0-9a-f]{40}$/i.test(message.walletAddress as string)) {
        return false;
      }

      const issuedAt = parseInt(message.issuedAt as string, 10);
      const expiresAt = parseInt(message.expiresAt as string, 10);
      if (Number.isNaN(issuedAt) || Number.isNaN(expiresAt)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private async verifyProof(
    proof: EVMAuthProof,
    toolName: string,
    toolArguments: Record<string, unknown>
  ): Promise<string> {
    const { challenge, signature } = proof;
    const { domain, message } = challenge;

    const expiresAt = parseInt(message.expiresAt);
    if (Date.now() > expiresAt) {
      if (this.config.debug) {
        console.log('[Radius] Proof verification failed', {
          step: 'proof_verification',
          reason: 'expired',
          expiresAt: new Date(expiresAt).toISOString(),
          now: new Date().toISOString(),
          success: false,
        });
      }
      throw new RadiusError('PROOF_EXPIRED', 'Proof has expired');
    }

    if (domain.name !== 'EVMAuth' || domain.version !== '1') {
      if (this.config.debug) {
        console.log('[Radius] Proof verification failed', {
          step: 'proof_verification',
          reason: 'invalid_domain',
          expected: { name: 'EVMAuth', version: '1' },
          actual: { name: domain.name, version: domain.version },
          success: false,
        });
      }
      throw new RadiusError('PROOF_INVALID', 'Invalid domain name or version');
    }

    if (domain.chainId !== this.config.chainId) {
      if (this.config.debug) {
        console.log('[Radius] Proof verification failed', {
          step: 'proof_verification',
          reason: 'chain_mismatch',
          expectedChainId: this.config.chainId,
          actualChainId: domain.chainId,
          success: false,
        });
      }
      throw new RadiusError(
        'CHAIN_MISMATCH',
        `Expected chain ${this.config.chainId}, got ${domain.chainId}`
      );
    }

    if (domain.verifyingContract.toLowerCase() !== this.config.contractAddress.toLowerCase()) {
      if (this.config.debug) {
        console.log('[Radius] Proof verification failed', {
          step: 'proof_verification',
          reason: 'contract_mismatch',
          expectedContract: this.config.contractAddress,
          actualContract: domain.verifyingContract,
          success: false,
        });
      }
      throw new RadiusError('CONTRACT_MISMATCH', 'Wrong contract address');
    }

    this.validateNonce(message.nonce);

    const resourceToolName = message.resourceName.includes(':')
      ? message.resourceName.split(':').pop() || message.resourceName
      : message.resourceName;

    if (resourceToolName !== toolName) {
      if (this.config.debug) {
        console.log('[Radius] Proof verification failed', {
          step: 'proof_verification',
          reason: 'tool_mismatch',
          expectedTool: toolName,
          proofResourceName: message.resourceName,
          extractedToolName: resourceToolName,
          success: false,
        });
      }
      throw new RadiusError(
        'PROOF_INVALID',
        `Proof is for tool '${resourceToolName}' (from '${message.resourceName}'), not '${toolName}'`
      );
    }

    if (
      message.requestHash &&
      message.requestHash !== '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      const sortedArgs = Object.keys(toolArguments)
        .filter((key) => key !== '__evmauth') // Exclude auth parameter
        .sort()
        .reduce(
          (acc, key) => {
            acc[key] = toolArguments[key];
            return acc;
          },
          {} as Record<string, unknown>
        );

      if (Object.keys(sortedArgs).length > 0) {
        const argString = JSON.stringify(sortedArgs);
        const { createHash } = await import('node:crypto');
        const expectedHash = `0x${createHash('sha256').update(argString).digest('hex')}`;

        if (expectedHash !== message.requestHash) {
          if (this.config.debug) {
            console.log('[Radius] Proof verification failed', {
              step: 'proof_verification',
              reason: 'request_hash_mismatch',
              expectedHash,
              proofHash: message.requestHash,
              toolName,
              success: false,
            });
          }
          throw new RadiusError('PROOF_INVALID', 'Request arguments do not match proof');
        }
      }
    }

    const signerAddress = await recoverTypedDataAddress({
      domain: {
        name: domain.name,
        version: domain.version,
        chainId: BigInt(domain.chainId),
        verifyingContract: domain.verifyingContract as Address,
      },
      types: challenge.types as TypedData,
      primaryType: challenge.primaryType,
      message: message as unknown as Record<string, unknown>,
      signature: signature as `0x${string}`,
    });

    const signerLower = signerAddress.toLowerCase();
    const expectedLower = message.walletAddress.toLowerCase();

    if (!constantTimeEqual(signerLower, expectedLower)) {
      if (this.config.debug) {
        console.log('[Radius] Proof verification failed', {
          step: 'proof_verification',
          reason: 'signer_mismatch',
          expectedWallet: message.walletAddress,
          actualSigner: signerAddress,
          success: false,
        });
      }
      throw new RadiusError('SIGNER_MISMATCH', 'Signature does not match expected wallet');
    }

    if (this.config.debug) {
      console.log('[Radius] Proof verification succeeded', {
        step: 'proof_verification',
        wallet: signerAddress,
        chainId: domain.chainId,
        contract: domain.verifyingContract,
        purpose: message.purpose,
        expiresIn: `${Math.floor((expiresAt - Date.now()) / 1000)}s`,
        success: true,
      });
    }

    return signerAddress.toLowerCase();
  }

  private validateNonce(nonce: string): void {
    const parts = nonce.split('-');
    if (parts.length !== 2) {
      throw new RadiusError('NONCE_INVALID', 'Invalid nonce format');
    }

    const timestampStr = parts[0];
    const random = parts[1];

    if (!timestampStr || !/^\d+$/.test(timestampStr)) {
      throw new RadiusError('NONCE_INVALID', 'Invalid nonce timestamp');
    }

    const timestamp = parseInt(timestampStr, 10);

    if (!random || !/^[0-9a-f]{32}$/i.test(random)) {
      throw new RadiusError('NONCE_INVALID', 'Invalid nonce random component');
    }

    const now = Date.now();
    const age = now - timestamp;

    if (age > 30000) {
      throw new RadiusError('PROOF_EXPIRED', 'Nonce too old (proofs expire after 30 seconds)');
    }

    if (timestamp > now + 5000) {
      throw new RadiusError('NONCE_INVALID', 'Nonce timestamp too far in future');
    }
  }

  async checkAccess(wallet: string, tokenIds: number[]): Promise<boolean> {
    for (const tokenId of tokenIds) {
      const cached = this.cache.get(wallet, tokenId);
      if (cached === true) return true;
    }

    try {
      if (tokenIds.length === 1) {
        const tokenId = tokenIds[0];
        if (tokenId === undefined) return false;

        const balance = await this.contract.read.balanceOf([wallet as Address, BigInt(tokenId)]);
        const hasToken = balance > 0n;
        this.cache.set(wallet, tokenId, hasToken);
        return hasToken;
      } else {
        const accounts = new Array(tokenIds.length).fill(wallet);
        const ids = tokenIds.map((id) => BigInt(id));

        const balances = await this.contract.read.balanceOfBatch([accounts as Address[], ids]);

        let hasAccess = false;
        const tokenOwnership: Record<number, boolean> = {};

        for (let i = 0; i < tokenIds.length; i++) {
          const balance = balances[i];
          const tokenId = tokenIds[i];
          if (balance === undefined || tokenId === undefined) continue;

          const hasToken = balance > 0n;
          tokenOwnership[tokenId] = hasToken;
          this.cache.set(wallet, tokenId, hasToken);
          if (hasToken) hasAccess = true;
        }

        if (this.config.debug) {
          console.log('[Radius] Token ownership check', {
            step: 'token_check',
            wallet,
            tokenOwnership,
            hasAccess,
            method: 'batch',
            success: true,
          });
        }

        return hasAccess;
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('[Radius SDK] Token check failed', {
          step: 'token_check',
          wallet,
          tokenIds,
          error: (error as Error).message,
          success: false,
          failClosed: true,
        });
      }
      throw error;
    }
  }

  /* @deprecated Now stripping auth directly in protect implementation
  private _stripAuth(request: MCPRequest): MCPRequest {
    const clean = JSON.parse(JSON.stringify(request));
    if (clean?.params?.arguments?.__evmauth) {
      delete clean.params.arguments.__evmauth;
    }
    return clean;
  }
  */

  private errorResponse(
    code: ProofErrorCode,
    tokenIds?: number[],
    toolName?: string
  ): EVMAuthErrorResponse {
    const descriptions: Record<ProofErrorCode, string> = {
      PROOF_MISSING: 'You need to authenticate with Radius MCP Server first',
      PROOF_EXPIRED: 'Your authentication proof has expired. Proofs are valid for 30 seconds.',
      PROOF_INVALID: 'The proof format is invalid',
      CHAIN_MISMATCH: 'Wrong blockchain network',
      CONTRACT_MISMATCH: 'Wrong contract address',
      SIGNATURE_INVALID: 'Invalid signature',
      SIGNER_MISMATCH: 'Signature does not match wallet',
      NONCE_INVALID: 'Invalid or expired nonce',
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: {
                code: `EVMAUTH_${code}`,
                message: descriptions[code],
                details: {
                  contractAddress: this.config.contractAddress,
                  chainId: this.config.chainId,
                  requiredTokens: tokenIds || [], // NEW: Always include required tokens
                },
                claude_action: {
                  description: 'Authenticate and automatically purchase any required tokens',
                  steps: [
                    'Call the "authenticate_and_purchase" tool on Radius MCP Server',
                    'Pass the requiredTokens array from this error',
                    `MUST include targetTool: '${toolName}' - this is now required`,
                    'Use the returned proof to retry this tool call',
                  ],
                  important_note:
                    "The __evmauth parameter is ALWAYS accepted by Radius MCP SDK-protected tools, even if not shown in the tool's schema. This is a special parameter that gets stripped before your actual tool logic runs.",
                  example: {
                    comment: 'Step 1: Call authenticate_and_purchase with required tokens',
                    tool_call: {
                      name: 'authenticate_and_purchase',
                      arguments: {
                        tokenIds: tokenIds || [],
                        targetTool: toolName,
                      },
                    },
                    comment2: 'Step 2: Use the returned proof to retry this tool',
                    retry_call: {
                      name: toolName,
                      arguments: {
                        your_param: 'your_value',
                        __evmauth: {
                          challenge: { '...': '...' },
                          signature: '0x...',
                        },
                      },
                    },
                  },
                  tool: {
                    server: 'radius-mcp-server',
                    name: 'authenticate_and_purchase',
                    arguments: {
                      tokenIds: tokenIds || [],
                      targetTool: toolName,
                    },
                  },
                },
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private paymentRequiredResponse(
    tokenIds: number[],
    wallet: string,
    toolName?: string
  ): EVMAuthErrorResponse {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: {
                code: 'PAYMENT_REQUIRED',
                message: 'Token ownership required',
                details: {
                  requiredTokens: tokenIds,
                  walletAddress: wallet,
                  contractAddress: this.config.contractAddress,
                  chainId: this.config.chainId,
                },
                claude_action: {
                  description:
                    'Your authentication proof is valid but you need tokens. Use authenticate_and_purchase to handle everything in one step.',
                  steps: [
                    'You already have a valid proof but lack the required tokens',
                    'Call "authenticate_and_purchase" with the required tokens',
                    'It will purchase tokens and return a fresh proof',
                    'Retry this tool with the new proof',
                  ],
                  tool: {
                    server: 'radius-mcp-server',
                    name: 'authenticate_and_purchase',
                    arguments: {
                      tokenIds: tokenIds,
                      targetTool: toolName,
                    },
                  },
                },
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private handleError(error: Error, tokenIds?: number[], toolName?: string): EVMAuthErrorResponse {
    if (this.config.debug) {
      console.error('[Radius SDK] Unexpected error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }

    if (error instanceof RadiusError) {
      return this.errorResponse(error.code as ProofErrorCode, tokenIds, toolName);
    }

    const errorMessage = error.message.toLowerCase();

    if (
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('etimedout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('fetch')
    ) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: {
                  code: 'NETWORK_ERROR',
                  message: 'Network error while verifying tokens',
                  details: {
                    retryable: true,
                    ...(this.config.debug ? { rpcUrl: this.config.rpcUrl } : {}),
                  },
                  claude_action: {
                    description: 'Network connectivity issue',
                    steps: ['Wait a moment and retry', 'If persistent, contact administrator'],
                  },
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (
      errorMessage.includes('revert') ||
      errorMessage.includes('contract') ||
      errorMessage.includes('execution')
    ) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: {
                  code: 'CONTRACT_ERROR',
                  message: 'Contract interaction failed',
                  details: {
                    contractAddress: this.config.contractAddress,
                    chainId: this.config.chainId,
                  },
                  claude_action: {
                    description: 'Contract verification failed',
                    steps: [
                      'Ensure you are on the correct network',
                      'Verify contract is accessible',
                    ],
                  },
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return this.errorResponse('PROOF_INVALID', tokenIds, toolName);
  }
}

/**
 * Decorator utility to explicitly mark a handler as FastMCP pattern
 * Useful for edge cases where detection might be ambiguous
 */
export function asFastMCP<T extends Function>(handler: T): T & { __pattern?: 'fastmcp' } {
  (handler as any).__pattern = 'fastmcp';
  return handler;
}

/**
 * Decorator utility to explicitly mark a handler as Standard MCP pattern
 * Useful for edge cases where detection might be ambiguous
 */
export function asStandard<T extends Function>(handler: T): T & { __pattern?: 'standard' } {
  (handler as any).__pattern = 'standard';
  return handler;
}
