# Token-Gated Timestamp Example

This example shows how to protect MCP tools with ERC-1155 tokens using the Radius MCP SDK.

## Quick Start (60 seconds)

1. **Install dependencies:**

   ```bash
   npm install
   # or
   pnpm install
   ```

2. **Run the server:**

   ```bash
   npm start
   # or
   pnpm start
   ```

3. **Test with claude.ai (Recommended):**

   a. Install ngrok: <https://ngrok.com/download>

   b. In a new terminal, expose your server:

   ```bash
   ngrok http 3000
   ```

   c. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

   d. In claude.ai, connect to your MCP server:
   - Click the 🔌 icon
   - Enter your ngrok URL + `/mcp` (e.g., `https://abc123.ngrok.io/mcp`)
   - Try asking: "What's the current timestamp?"

4. **Or use Claude Desktop:**

   Add to your Claude Desktop config:

   ```json
   {
     "mcpServers": {
       "token-gated-timestamp": {
         "command": "node",
         "args": ["/path/to/this/example/node_modules/.bin/tsx", "/path/to/this/example/index.ts"]
       }
     }
   }
   ```

## What This Example Shows

With just **3 lines of code**, we've token-gated an MCP tool:

```typescript
// 1. Create SDK instance
const radius = new RadiusMcpSdk({ contractAddress: '0x...' });

// 2. Wrap your handler
handler: radius.protect(1, async (request) => { ... })

// 3. That's it! 🎉
```

## Testing the Token Gate

1. **Without a token:** Claude will receive an error with instructions to authenticate
2. **After authentication:** The tool works perfectly

## The Authentication Flow

1. Claude tries to use `get_timestamp` → Gets "auth required" error
2. Error includes instructions to call `authenticate_and_purchase` on the Radius MCP Server
3. Claude gets a proof and retries → Success!

## Ngrok Tips

- **Free tier** works perfectly for testing
- URL changes each time you restart ngrok (unless you have a paid account)
- Keep ngrok running in a separate terminal
- The server logs will show connections from claude.ai

## Customize It

- Change the token ID (currently 1)
- Modify the timestamp formats (unix, iso, readable, all)
- Add more tools with different token requirements

## Learn More

- [Radius MCP SDK Documentation](https://github.com/radiustechsystems/mcp-sdk)
- [FastMCP Documentation](https://github.com/jlowin/fastmcp)
- [Model Context Protocol](https://modelcontextprotocol.io)
