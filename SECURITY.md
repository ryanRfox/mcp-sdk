# Security Policy

## Reporting a Vulnerability

The Radius MCP SDK team takes security vulnerabilities seriously. If you discover a security vulnerability in this project, please report it to us as soon as possible. We appreciate your efforts to responsibly disclose your findings.

### How to Report

To report a vulnerability, please email **<opensource@radiustech.xyz>** with the following information:

- **Description**: A clear description of the vulnerability
- **Impact**: The potential impact and severity assessment
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Affected Versions**: Which versions of the SDK are affected
- **Proof of Concept**: If available, include code or screenshots
- **Suggested Mitigation**: Any potential fixes or workarounds you've identified

Please encrypt sensitive details using our PGP key if available.

Alternatively, you can use GitHub's private vulnerability reporting feature:

1. Navigate to the Security tab of this repository
2. Click "Report a vulnerability"
3. Fill out the vulnerability report form

## Response Process

We are committed to addressing security issues promptly:

- **Initial Response**: Within 48 hours of receipt
- **Issue Confirmation**: Within 5 business days
- **Status Updates**: Every 72 hours until resolved
- **Resolution Target**:
  - Critical: 7 days
  - High: 14 days
  - Medium: 30 days
  - Low: 60 days

## Coordinated Disclosure Process

We follow a coordinated disclosure process to protect our users:

1. **Validation**: We will work to quickly validate and reproduce the reported issue
2. **Fix Development**: We will develop fixes for all supported versions
3. **Reporter Coordination**: We will share the fix with the reporter for validation
4. **Patch Release**: We will release patched versions across all affected branches
5. **Public Disclosure**: We will publicly disclose the vulnerability details after users have had reasonable time to update

## Security Best Practices

When using the Radius MCP SDK:

- **Keep Dependencies Updated**: Regularly update to the latest version
- **Review Configuration**: Ensure proper chain ID and contract addresses
- **Monitor Security Advisories**: Watch this repository for security updates
- **Test Integrations**: Thoroughly test token-gating implementations
- **Validate Proofs**: Never bypass proof validation in production

## Out of Scope

The following are generally out of scope for our security policy:

- Vulnerabilities in dependencies (report to the dependency maintainer)
- Issues in the underlying blockchain or smart contracts
- Social engineering attacks
- Physical attacks on infrastructure

## Recognition

We appreciate security researchers who help keep our ecosystem safe. With your permission, we'd like to acknowledge your contribution in our release notes when the issue is resolved.

## Contact

For security-related inquiries and general issues:

- **Email**: [opensource@radiustech.xyz](mailto:opensource@radiustech.xyz)

For non-security bugs and feature requests, please use [GitHub Issues](https://github.com/radiustechsystems/mcp-sdk/issues).

Thank you for helping to keep the Radius MCP SDK and our users secure!
