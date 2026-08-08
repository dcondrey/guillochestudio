import { describe, expect, it } from 'vitest';
import { MAX_PNG_BYTES, validateSignRequest } from './validate';

const BASE = {
  method: 'POST',
  pathname: '/sign-png',
  hasSigningKey: true,
  instanceId: 'xmp:iid:test',
  contentLength: 1024,
};

describe('validateSignRequest', () => {
  it('accepts a well-formed request', () => {
    const result = validateSignRequest(BASE);
    expect(result).toEqual({ ok: true, instanceId: 'xmp:iid:test' });
  });

  it('rejects non-POST methods', () => {
    const result = validateSignRequest({ ...BASE, method: 'GET' });
    expect(result).toEqual({ ok: false, status: 405, error: 'Method not allowed' });
  });

  it('rejects unknown paths', () => {
    const result = validateSignRequest({ ...BASE, pathname: '/other' });
    expect(result).toEqual({ ok: false, status: 404, error: 'Not found' });
  });

  it('rejects when the signing key is not provisioned', () => {
    const result = validateSignRequest({ ...BASE, hasSigningKey: false });
    expect(result).toEqual({ ok: false, status: 500, error: 'Signing is not configured' });
  });

  it('rejects a missing instance id', () => {
    const result = validateSignRequest({ ...BASE, instanceId: null });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'X-Instance-Id header is required',
    });
  });

  it('rejects a body over the size limit', () => {
    const result = validateSignRequest({ ...BASE, contentLength: MAX_PNG_BYTES + 1 });
    expect(result).toEqual({ ok: false, status: 413, error: 'PNG exceeds maximum size' });
  });
});
