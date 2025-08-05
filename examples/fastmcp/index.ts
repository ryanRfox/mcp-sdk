import { FastMCP } from 'fastmcp';
import { RadiusMcpSdk } from '@radiustechsystems/mcp-sdk';
import { z } from 'zod';

// Environment configuration (optional - can override via env vars)
// IMPORTANT: This is the official Radius Testnet contract address
// For production deployments, always use environment variables
const EVMAUTH_CONTRACT_ADDRESS = process.env.EVMAUTH_CONTRACT_ADDRESS || "0x9f2B42FB651b75CC3db4ef9FEd913A22BA4629Cf";
const EVMAUTH_TOKEN_ID = parseInt(process.env.EVMAUTH_TOKEN_ID || "1");

// Initialize the Radius MCP SDK with your contract
const radius = new RadiusMcpSdk({
  contractAddress: EVMAUTH_CONTRACT_ADDRESS as `0x${string}`,
  debug: true // Set to false in production!
});

// Create your MCP server
const server = new FastMCP({
  name: 'Token-Gated Timestamp',
  version: '1.0.0'
});

// Create a wrapper function that handles the authentication
const authenticatedTimestamp = async (args: any) => {
  // Debug: Log what we receive
  console.log('[FastMCP Example] Tool called with args:', JSON.stringify(args, null, 2));
  
  // Check if __evmauth is present and log its structure
  if (args.__evmauth) {
    try {
      const authProof = typeof args.__evmauth === 'string' ? JSON.parse(args.__evmauth) : args.__evmauth;
      console.log('[FastMCP Example] Auth proof signature length:', authProof.signature?.length);
      console.log('[FastMCP Example] Auth proof signature:', authProof.signature);
    } catch (e) {
      console.log('[FastMCP Example] Failed to parse auth proof:', e);
    }
  }
  
  // Create MCP request structure expected by Radius SDK
  const mcpRequest = {
    method: 'tools/call',
    params: {
      name: 'get_timestamp',
      arguments: args
    }
  };
  
  // Create the protected handler
  const protectedHandler = radius.protect(EVMAUTH_TOKEN_ID, async (request: any) => {
    // Extract args from request
    const args = request.params?.arguments as { format?: "unix" | "iso" | "readable" | "all" };
    const format = args?.format || "all";
    
    const now = new Date();
    const unix = Math.floor(now.getTime() / 1000);
    
    let result: string;
    switch (format) {
      case "unix":
        result = String(unix);
        break;
      
      case "iso":
        result = now.toISOString();
        break;
      
      case "readable":
        result = now.toLocaleString();
        break;
      
      case "all":
      default:
        result = `Current Timestamp:\n` +
                 `Unix: ${unix}\n` +
                 `ISO: ${now.toISOString()}\n` +
                 `Readable: ${now.toLocaleString()}\n` +
                 `UTC: ${now.toUTCString()}`;
    }
    
    // Return in MCP format
    return {
      content: [{
        type: "text",
        text: result
      }]
    };
  });
  
  // Call the protected handler
  const response = await protectedHandler(mcpRequest);
  
  // Handle the response
  if (response && typeof response === 'object') {
    if ('content' in response && Array.isArray(response.content)) {
      // Check if this is an error response from Radius
      const firstContent = response.content[0];
      if (firstContent && typeof firstContent === 'object' && 'text' in firstContent) {
        try {
          // Try to parse as JSON error
          const parsed = JSON.parse(firstContent.text as string);
          if (parsed.error) {
            // This is a Radius error - throw it properly so Claude gets the full error info
            throw new Error(firstContent.text as string);
          }
        } catch (e) {
          // Not JSON, it's the actual result
          return firstContent.text;
        }
      }
    } else if ('error' in response && response.error) {
      // Error - throw with proper message
      const error = response.error as any;
      throw new Error(error.message || 'Authentication failed');
    }
  }
  
  // Default error
  throw new Error('Unexpected response from authentication');
};

// Add the timestamp tool
server.addTool({
  name: "get_timestamp",
  description: `Get the current timestamp in various formats. Requires Token #${EVMAUTH_TOKEN_ID}. IMPORTANT: Call this tool directly without checking wallet first! If you lack authentication, you'll receive clear error instructions. The auth flow is: 1) Call this directly, 2) Get error with required tokens, 3) Use authenticate_and_purchase, 4) Retry with proof.`,
  parameters: z.object({
    format: z.enum(["unix", "iso", "readable", "all"]).default("all").describe("Timestamp format to return"),
    __evmauth: z.any().optional().describe("Authentication proof (automatically provided)")
  }),
  execute: authenticatedTimestamp
});

// Start server
const PORT = process.env.PORT || 3000;
server.start({
  transportType: 'httpStream',
  httpStream: {
    port: Number(PORT),
    endpoint: '/mcp'
  }
});

console.log(`🚀 Token-gated MCP server running on port ${PORT}!`);
console.log(`🔐 Tool "get_timestamp" requires Token #${EVMAUTH_TOKEN_ID}`);
console.log('\n📡 To test with claude.ai:');
console.log('1. Install ngrok: https://ngrok.com/download');
console.log(`2. Run: ngrok http ${PORT}`);
console.log('3. Use the ngrok URL in claude.ai');

// Handle common FastMCP/ngrok connection errors gracefully
process.on('uncaughtException', (err) => {
  if (err.message.includes('write after end') || err.message.includes('ERR_STREAM_WRITE_AFTER_END')) {
    console.log('[FastMCP] Connection closed by client (this is normal with ngrok)');
  } else {
    console.error('[FastMCP] Unexpected error:', err);
    process.exit(1);
  }
});