export const MAX_PNG_BYTES = 20 * 1024 * 1024;

export interface SignRequestInput {
  method: string;
  pathname: string;
  hasSigningKey: boolean;
  instanceId: string | null;
  contentLength: number;
}

export type SignRequestValidation =
  | { ok: true; instanceId: string }
  | { ok: false; status: number; error: string };

export function validateSignRequest(input: SignRequestInput): SignRequestValidation {
  if (input.method !== 'POST') {
    return { ok: false, status: 405, error: 'Method not allowed' };
  }
  if (input.pathname !== '/sign-png') {
    return { ok: false, status: 404, error: 'Not found' };
  }
  if (!input.hasSigningKey) {
    return { ok: false, status: 500, error: 'Signing is not configured' };
  }
  if (!input.instanceId) {
    return { ok: false, status: 400, error: 'X-Instance-Id header is required' };
  }
  if (input.contentLength > MAX_PNG_BYTES) {
    return { ok: false, status: 413, error: 'PNG exceeds maximum size' };
  }
  return { ok: true, instanceId: input.instanceId };
}
