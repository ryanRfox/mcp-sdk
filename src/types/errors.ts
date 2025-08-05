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

export type RadiusErrorCode =
  | 'INVALID_CONFIG'
  | 'PROOF_INVALID'
  | 'PROOF_EXPIRED'
  | 'PROOF_MALFORMED'
  | 'CHAIN_MISMATCH'
  | 'CONTRACT_ERROR'
  | 'NETWORK_ERROR'
  | 'SIGNATURE_INVALID'
  | 'CONTRACT_MISMATCH'
  | 'SIGNER_MISMATCH'
  | 'NONCE_INVALID'
  | 'PROOF_MISSING';
