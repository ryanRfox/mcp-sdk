# Testing the Universal Adapter Feature

This document provides step-by-step instructions for QA teams to test the Universal Adapter feature on the `feature/add-universal-adaptor` branch.

## Prerequisites

- Node.js 16.0.0 or higher
- pnpm 8.15.0
- Git
- Access to the Radius MCP SDK repository

## Setup Instructions

### 1. Clone and Setup the Feature Branch

```bash
# Clone the repository
git clone https://github.com/ryanRfox/mcp-sdk.git
cd mcp-sdk

# Switch to the feature branch
git checkout feature/add-universal-adaptor

# Install dependencies using pnpm
pnpm install

# Build the SDK
pnpm run build
```

### 2. Verify Build Success

After building, you should see:
- `dist/esm/` directory with compiled JavaScript files
- `dist/types/` directory with TypeScript declaration files
- No build errors in the console

## Testing the Universal Adapter

### 3. Run Automated Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test -- --coverage

# Run tests in watch mode for development
pnpm run test:watch
```

Expected results:
- All existing tests should pass (backward compatibility)
- New Universal Adapter tests should pass
- Coverage should remain above 80%

### 4. Test with FastMCP Example

The SDK includes a FastMCP example that should continue working without changes:

```bash
# Navigate to the FastMCP example
cd examples/fastmcp

# Install dependencies
pnpm install

# Link the local SDK build
pnpm link ../../

# Run the example server
pnpm run dev
```

Test the FastMCP example:
1. The server should start without errors
2. Existing FastMCP handlers should work unchanged
3. Authentication should function as before

### 5. Test Pattern Detection

Create a test file `test-universal.js` in the project root:

```javascript
import { RadiusMcpSdk } from './dist/esm/index.js';

// Initialize SDK
const sdk = new RadiusMcpSdk({
  contractAddress: '0x1234567890123456789012345678901234567890',
  debug: true // Enable debug logging
});

// Test 1: FastMCP pattern (should auto-detect)
const fastHandler = sdk.protect(123, async (request, extra) => {
  const args = request.params?.arguments || {};
  return { content: [{ type: 'text', text: 'FastMCP pattern' }] };
});

// Test 2: Standard MCP pattern (should auto-detect)
const standardHandler = sdk.protect(456, async (args) => {
  return { content: [{ type: 'text', text: 'Standard MCP pattern' }] };
});

// Test 3: Explicit pattern hint (edge case)
const explicitHandler = sdk.protect(789, async (request) => {
  return { content: [{ type: 'text', text: 'Explicit pattern' }] };
}, { pattern: 'fastmcp' });

console.log('✅ All handlers created successfully');
```

Run the test:
```bash
node test-universal.js
```

Expected output:
- Debug logs showing pattern detection
- "✅ All handlers created successfully"
- No errors or warnings

### 6. Integration Testing Checklist

#### Pattern Detection
- [ ] FastMCP handlers detected correctly (2 parameters)
- [ ] Standard MCP handlers detected correctly (1 parameter)
- [ ] Mixed patterns work in same application
- [ ] Pattern hints work when provided
- [ ] Debug mode shows detection confidence scores

#### Backward Compatibility
- [ ] All existing FastMCP code works unchanged
- [ ] No breaking changes in API
- [ ] Error messages remain AI-friendly
- [ ] Authentication flow unchanged

#### Error Handling
- [ ] Pattern mismatch triggers fallback
- [ ] Clear error messages with debugging info
- [ ] Failed detection provides actionable guidance
- [ ] Security remains fail-closed

#### Performance
- [ ] No noticeable latency increase
- [ ] Pattern caching works (check debug logs)
- [ ] Memory usage remains stable

### 7. Code Quality Checks

Run all quality checks before approving:

```bash
# Type checking
pnpm run typecheck

# Linting
pnpm run lint

# Formatting check
pnpm run format

# Combined check
pnpm run check

# Final build
pnpm run build
```

All commands should pass without errors.

## Troubleshooting

### Common Issues

1. **Build fails**: Ensure you're using pnpm 8.15.0 and Node.js 16+
2. **Tests fail**: Check that you're on the correct branch
3. **Pattern detection issues**: Enable debug mode to see detection logs
4. **Type errors**: Run `pnpm run typecheck` to identify issues

### Debug Mode

Enable debug logging to see pattern detection details:

```javascript
const sdk = new RadiusMcpSdk({
  contractAddress: '0x...',
  debug: true // Shows detection confidence and signals
});
```

### Getting Help

- Check implementation status: `IMPLEMENTATION_STATUS.md`
- Review implementation plan: `IMPLEMENTATION_PLAN.md`
- Check critique and improvements: `CRITIQUE.md`

## Approval Criteria

The feature is ready for merge when:

1. ✅ All automated tests pass
2. ✅ FastMCP example works unchanged
3. ✅ Pattern detection works for both patterns
4. ✅ No breaking changes detected
5. ✅ Error handling works correctly
6. ✅ Code quality checks pass
7. ✅ Documentation is complete

## Reporting Issues

If you find issues during testing:

1. Note the specific test case that failed
2. Include debug logs if available
3. Provide steps to reproduce
4. Check if it's a known issue in IMPLEMENTATION_STATUS.md

## Next Steps

After successful QA testing:

1. Document any findings in this file
2. Update IMPLEMENTATION_STATUS.md with test results
3. Prepare for PR review
4. Ensure all commits follow conventional commit format