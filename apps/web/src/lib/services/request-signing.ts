/**
 * Request Signing Service
 *
 * Provides HMAC-based request signing to prevent:
 * - Request tampering/modification
 * - Replay attacks
 * - Request interception and reuse
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

// =============================================================================
// Types
// =============================================================================

export interface SignedRequest {
  signature: string;
  timestamp: number;
  nonce: string;
}

export interface SignatureValidationResult {
  valid: boolean;
  reason?: string;
  code?:
    | 'VALID'
    | 'EXPIRED'
    | 'INVALID_SIGNATURE'
    | 'REPLAY_DETECTED'
    | 'MISSING_FIELDS'
    | 'FUTURE_TIMESTAMP';
}

export interface RequestToSign {
  method: string;
  path: string;
  body?: unknown;
  userId?: string;
  timestamp: number;
  nonce: string;
}

// Configuration
const SIGNATURE_VALIDITY_SECONDS = 300; // 5 minutes
const FUTURE_TOLERANCE_SECONDS = 60; // Allow 1 minute clock drift

// =============================================================================
// Request Signing Service
// =============================================================================

export class RequestSigningService {
  private supabase: SupabaseClient;
  private signingSecret: string;

  constructor(supabase: SupabaseClient, signingSecret?: string) {
    this.supabase = supabase;
    this.signingSecret = signingSecret || env.PRIVATE_SIGNING_SECRET || 'default-dev-secret';
  }

  /**
   * Sign a request (server-side, for generating tokens for client)
   */
  async signRequest(request: RequestToSign): Promise<string> {
    const payload = this.createSignaturePayload(request);
    return this.createHmacSignature(payload);
  }

  /**
   * Validate a signed request
   */
  async validateSignature(
    request: RequestToSign,
    providedSignature: string,
    ipAddress?: string
  ): Promise<SignatureValidationResult> {
    const now = Math.floor(Date.now() / 1000);

    // Check for missing fields
    if (!request.timestamp || !request.nonce || !providedSignature) {
      return {
        valid: false,
        reason: 'Missing required signature fields',
        code: 'MISSING_FIELDS',
      };
    }

    // Check timestamp is not too far in the future
    if (request.timestamp > now + FUTURE_TOLERANCE_SECONDS) {
      return {
        valid: false,
        reason: 'Timestamp is in the future',
        code: 'FUTURE_TIMESTAMP',
      };
    }

    // Check timestamp is not expired
    if (request.timestamp < now - SIGNATURE_VALIDITY_SECONDS) {
      return {
        valid: false,
        reason: 'Signature has expired',
        code: 'EXPIRED',
      };
    }

    // Generate expected signature
    const payload = this.createSignaturePayload(request);
    const expectedSignature = await this.createHmacSignature(payload);

    // Timing-safe comparison
    if (!this.timingSafeEqual(expectedSignature, providedSignature)) {
      return {
        valid: false,
        reason: 'Invalid signature',
        code: 'INVALID_SIGNATURE',
      };
    }

    // Check for replay attack using database
    const signatureHash = await this.hashString(providedSignature);
    const { data: validation } = await this.supabase.rpc('validate_request_signature', {
      p_signature_hash: signatureHash,
      p_user_id: request.userId || null,
      p_endpoint: request.path,
      p_timestamp: new Date(request.timestamp * 1000).toISOString(),
      p_ip_address: ipAddress || null,
    });

    if (validation && !validation.valid) {
      return {
        valid: false,
        reason:
          validation.reason === 'signature_already_used'
            ? 'This request has already been processed (replay attack detected)'
            : validation.reason,
        code: 'REPLAY_DETECTED',
      };
    }

    return { valid: true, code: 'VALID' };
  }

  /**
   * Create signature payload from request
   */
  private createSignaturePayload(request: RequestToSign): string {
    const parts = [
      request.method.toUpperCase(),
      request.path,
      request.timestamp.toString(),
      request.nonce,
      request.userId || '',
    ];

    // Add body hash if present
    if (request.body !== undefined) {
      const bodyStr =
        typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
      parts.push(bodyStr);
    }

    return parts.join('\n');
  }

  /**
   * Create HMAC-SHA256 signature
   */
  private async createHmacSignature(payload: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.signingSecret);
    const messageData = encoder.encode(payload);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Hash string using SHA-256
   */
  private async hashString(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate a nonce for request signing
   */
  generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get current timestamp for signing
   */
  getTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }
}

// =============================================================================
// Client-side Signing Helper
// =============================================================================

/**
 * Client-side request signing
 * Note: This provides defense-in-depth but the secret must be unique per user session
 */
export class ClientRequestSigner {
  private sessionSecret: string;

  constructor(sessionSecret: string) {
    this.sessionSecret = sessionSecret;
  }

  /**
   * Sign a request before sending to server
   */
  async signRequest(method: string, path: string, body?: unknown): Promise<SignedRequest> {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = this.generateNonce();

    const payload = this.createPayload(method, path, body, timestamp, nonce);
    const signature = await this.createSignature(payload);

    return { signature, timestamp, nonce };
  }

  private createPayload(
    method: string,
    path: string,
    body: unknown,
    timestamp: number,
    nonce: string
  ): string {
    const parts = [method.toUpperCase(), path, timestamp.toString(), nonce];
    if (body !== undefined) {
      parts.push(typeof body === 'string' ? body : JSON.stringify(body));
    }
    return parts.join('\n');
  }

  private async createSignature(payload: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.sessionSecret);
    const messageData = encoder.encode(payload);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}

// =============================================================================
// Middleware Helper
// =============================================================================

/**
 * Extract signature data from request headers
 */
export function extractSignatureFromRequest(request: Request): SignedRequest | null {
  const signature = request.headers.get('X-Signature');
  const timestamp = request.headers.get('X-Timestamp');
  const nonce = request.headers.get('X-Nonce');

  if (!signature || !timestamp || !nonce) {
    return null;
  }

  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum)) {
    return null;
  }

  return {
    signature,
    timestamp: timestampNum,
    nonce,
  };
}

/**
 * Create signed request headers for fetch
 */
export function createSignedHeaders(signedRequest: SignedRequest): HeadersInit {
  return {
    'X-Signature': signedRequest.signature,
    'X-Timestamp': signedRequest.timestamp.toString(),
    'X-Nonce': signedRequest.nonce,
  };
}

// =============================================================================
// Sensitive Operations Configuration
// =============================================================================

/**
 * Operations that require request signing
 */
export const SIGNED_OPERATIONS = new Set([
  // Export operations (high value)
  'POST:/api/export/svg',
  'POST:/api/export/pdf',
  'POST:/api/export/dxf',
  'POST:/api/export/gcode',

  // AI operations (costly)
  'POST:/api/ai/suggest',
  'POST:/api/ai/generate',

  // Account operations
  'POST:/api/account/upgrade',
  'POST:/api/account/cancel',
  'DELETE:/api/account',

  // Payment operations
  'POST:/api/stripe/checkout',
  'POST:/api/stripe/portal',

  // Pattern operations with value
  'POST:/api/marketplace/purchase',
  'POST:/api/marketplace/list',
]);

/**
 * Check if an operation requires signing
 */
export function requiresSignature(method: string, path: string): boolean {
  return SIGNED_OPERATIONS.has(`${method.toUpperCase()}:${path}`);
}
