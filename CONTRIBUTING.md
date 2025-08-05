# Contributing to Radius MCP SDK

Thank you for your interest in contributing to the Radius MCP SDK! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Core Design Principles](#core-design-principles)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Documentation](#documentation)
- [Questions](#questions)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to: [opensource@radiustech.xyz](mailto:opensource@radiustech.xyz).

## Development Setup

### Prerequisites

- Node.js 16.0.0 or higher
- pnpm 8.15.0 (specified in package.json)

### Installation

1. Fork the repository
2. Clone your fork:

   ```bash
   git clone https://github.com/your-username/mcp-sdk.git
   cd mcp-sdk
   ```

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Build the project:

   ```bash
   pnpm run build
   ```

5. Run tests to verify setup:

   ```bash
   pnpm test
   ```

## Project Structure

```bash
radius-mcp-sdk/
├── src/                     # Source code
│   ├── index.ts            # Main exports
│   ├── radius-mcp-sdk.ts   # Core SDK implementation
│   ├── types/              # TypeScript type definitions
│   │   ├── index.ts        # Type exports
│   │   └── errors.ts       # Error types and classes
│   └── __tests__/          # Test files
│       ├── radius-mcp-sdk.test.ts
│       └── radius-mcp-server-integration.test.ts
├── dist/                    # Built output (gitignored)
├── package.json            # Package configuration
├── tsconfig.json           # TypeScript configuration
├── biome.json              # Code formatter/linter config
├── vitest.config.ts        # Test configuration
└── README.md               # Documentation
```

## Core Design Principles

The Radius MCP SDK follows these core design principles:

### 1. Security First

- EIP-712 signature verification for cryptographic security
- Constant-time comparison for signature validation
- Fail-closed design - deny access on any validation failure
- No sensitive data in error messages

### 2. Developer Experience

- Simple 3-line integration
- Clear, actionable error messages that guide AI agents
- Comprehensive TypeScript types
- Minimal dependencies

### 3. Performance

- Intelligent caching with TTL
- Request deduplication
- Connection pooling for RPC calls

### 4. MCP Compatibility

- Framework-agnostic design
- Works with FastMCP, raw MCP protocol, and other implementations
- Reserved `__evmauth` namespace for clean separation

## Development Workflow

1. Create a new branch from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our code style

3. Write/update tests for your changes

4. Run the test suite:

   ```bash
   pnpm test
   ```

5. Check TypeScript types:

   ```bash
   pnpm run typecheck
   ```

6. Lint your code:

   ```bash
   pnpm run lint
   ```

7. Format your code:

   ```bash
   pnpm run format
   ```

8. Build to ensure no compilation errors:

   ```bash
   pnpm run build
   ```

9. Commit your changes using conventional commits

10. Push to your fork and create a pull request

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run with coverage
pnpm test -- --coverage
```

### Writing Tests

- Place tests in `src/__tests__/`
- Use descriptive test names
- Cover edge cases and error conditions
- Mock external dependencies (RPC calls, etc.)
- Follow existing test patterns

Example test structure:

```typescript
describe('RadiusMcpSdk', () => {
  describe('Constructor', () => {
    it('should create instance with valid config', () => {
      // test implementation
    });
  });
});
```

## Code Style

We use [Biome](https://biomejs.dev/) for code formatting and linting.

### Key Style Guidelines

- Use TypeScript for all code
- Prefer `const` over `let`
- Use async/await over callbacks
- Add JSDoc comments for public APIs
- Keep functions focused and small
- Use meaningful variable names

### Automated Formatting

```bash
# Check formatting
pnpm run check

# Auto-fix formatting and linting issues
pnpm run check:ci
```

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```plaintext
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test updates
- `chore:` Build process, dependencies, etc.
- `perf:` Performance improvements

### Examples

```bash
feat(sdk): add support for batch token validation
fix(cache): resolve TTL calculation error
docs(readme): update installation instructions
test(integration): add test for multi-token access
```

## Pull Requests

### PR Requirements

1. **Clear title** following conventional commits format
2. **Detailed description** including:
   - What changed and why
   - Any breaking changes
   - Related issues (use `Fixes #123` to auto-close)
3. **Tests** for new features and bug fixes
4. **Documentation** updates if needed
5. **Clean commit history** (squash if needed)
6. **All CI checks passing**

### PR Template

When you create a PR, please fill out the provided template with:

- Description of changes
- Type of change (feature, fix, etc.)
- Testing performed
- Checklist completion

## Documentation

### Code Documentation

- Add JSDoc comments for all public APIs
- Include parameter descriptions and return types
- Add usage examples for complex functions

### README Updates

Update the README.md when:

- Adding new features
- Changing configuration options
- Modifying the public API
- Adding new examples

### Changelog

For significant changes, update the CHANGELOG.md following the Keep a Changelog format.

## Questions?

If you have questions:

1. Check existing [issues](https://github.com/radiustechsystems/mcp-sdk/issues)
2. Search the [documentation](README.md)
3. Create a new issue with the `question` label
4. Ask in your PR if you're already working on code

## License

By contributing to the Radius MCP SDK, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing to the Radius MCP SDK!
