export const RadiusErrorCode = {
  INVALID_CONFIG: 'INVALID_CONFIG',
  PROOF_INVALID: 'PROOF_INVALID',
  PROOF_EXPIRED: 'PROOF_EXPIRED',
  PROOF_MALFORMED: 'PROOF_MALFORMED',
  CHAIN_MISMATCH: 'CHAIN_MISMATCH',
  CONTRACT_ERROR: 'CONTRACT_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SIGNATURE_INVALID: 'SIGNATURE_INVALID',
  CONTRACT_MISMATCH: 'CONTRACT_MISMATCH',
  SIGNER_MISMATCH: 'SIGNER_MISMATCH',
  NONCE_INVALID: 'NONCE_INVALID',
  PROOF_MISSING: 'PROOF_MISSING',
  AUTH_PROOF_MISSING: 'AUTH_PROOF_MISSING',
  AUTH_INVALID: 'AUTH_INVALID',
  TOKEN_MISSING: 'TOKEN_MISSING'
} as const;

export type RadiusErrorCode = typeof RadiusErrorCode[keyof typeof RadiusErrorCode];

export class RadiusError extends Error {
  constructor(
    public code: RadiusErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'RadiusError';
  }
}
