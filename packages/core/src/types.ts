/**
 * x402.NanoSession Rev 8 Types
 * 
 * Simplified single-track binding using nanoMacaroon mechanism.
 * Clean break from Rev 6/7 - no backward compatibility.
 */

import type {
  Network,
  Challenge,
  SettlementProof,
  SettlementResult,
  AccessProof,
  MacaroonCredential,
} from '@nanomacaroon/core';

/**
 * Re-export core types for x402 compatibility
 */
export type { Network, Challenge, SettlementProof, SettlementResult, AccessProof, MacaroonCredential };

/**
 * x402 V2 Payment Required response (Rev 8)
 */
export interface PaymentRequired {
  /** Protocol version */
  x402Version: 2;
  
  /** Resource information */
  resource: ResourceInfo;
  
  /** Accepted payment options */
  accepts: PaymentRequirements[];
  
  /** Optional extensions */
  extensions?: Record<string, unknown>;
}

/**
 * Resource information
 */
export interface ResourceInfo {
  /** URL of the protected resource */
  url: string;
  
  /** Human-readable description */
  description?: string;
  
  /** Content type */
  mimeType?: string;
}

/**
 * Payment requirements for x402 V2
 */
export interface PaymentRequirements {
  /** Scheme identifier - always "exact" */
  scheme: 'exact';
  
  /** Network identifier (e.g., "nano:mainnet") */
  network: `${string}:${string}`;
  
  /** Asset identifier (e.g., "XNO") */
  asset: string;
  
  /** Amount in raw */
  amount: string;
  
  /** Destination address */
  payTo: string;
  
  /** Maximum timeout in seconds */
  maxTimeoutSeconds: number;
  
  /** nanoMacaroon-specific data */
  extra: {
    /** Full nanoMacaroon challenge envelope */
    challenge: Challenge;
  };
}

/**
 * x402 V2 payment submission using settlement proof
 */
export interface PaymentSettlementPayload {
  /** Protocol version */
  x402Version: 2;
  
  /** Resource being accessed */
  resource?: ResourceInfo;
  
  /** Accepted requirements */
  accepted: PaymentRequirements;

  /** Settlement proof */
  payload: SettlementProof;
  
  /** Optional extensions */
  extensions?: Record<string, unknown>;
}

/**
 * x402 V2 access request using a previously issued credential
 */
export interface PaymentAccessPayload {
  /** Protocol version */
  x402Version: 2;

  /** Resource being accessed */
  resource?: ResourceInfo;

  /** Access proof */
  payload: AccessProof;

  /** Optional extensions */
  extensions?: Record<string, unknown>;
}

/**
 * x402 V2 payment response
 */
export interface PaymentResponse {
  /** Protocol version */
  x402Version: 2;

  /** Settlement result */
  result: SettlementResult;

  /** Optional status indicator for UI clients */
  success?: boolean;

  /** Optional error */
  error?: string;
}

export type PaymentPayload = PaymentSettlementPayload | PaymentAccessPayload;

/**
 * HTTP header names for x402
 */
export const HEADERS = {
  PAYMENT_REQUIRED: 'PAYMENT-REQUIRED',
  PAYMENT_SIGNATURE: 'PAYMENT-SIGNATURE',
  PAYMENT_RESPONSE: 'PAYMENT-RESPONSE',
} as const;

/**
 * Scheme identifier for x402.NanoSession
 */
export const SCHEME = 'exact' as const;

/**
 * Network identifier
 */
export const NETWORK = 'nano:mainnet' as const;

/**
 * Asset identifier
 */
export const ASSET = 'XNO' as const;
