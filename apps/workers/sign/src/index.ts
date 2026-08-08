/**
 * Guilloché C2PA Signing Worker
 *
 * Signs already-rendered PNG export bytes with a C2PA provenance manifest
 * (COSE_Sign1 / Ed25519) and returns the signed PNG. Holds the signing key
 * as a Worker secret and is reachable only via the [[services]] binding
 * from apps/web — see apps/workers/sign/wrangler.toml.
 */
import { sign_png } from './wasm-sign/index.js';
import { MAX_PNG_BYTES, validateSignRequest } from './validate.js';

export interface Env {
  EXPORT_SIGNING_KEY: string;
  ENVIRONMENT: string;
}

const GENERATOR = 'guilloche-studio';
const GENERATOR_VERSION = '1.0.0';
const PNG_FORMAT = 'image/png';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const validation = validateSignRequest({
      method: request.method,
      pathname: url.pathname,
      hasSigningKey: Boolean(env.EXPORT_SIGNING_KEY),
      instanceId: request.headers.get('X-Instance-Id'),
      contentLength: Number(request.headers.get('Content-Length') ?? '0'),
    });
    if (!validation.ok) {
      if (validation.status === 500) console.error('EXPORT_SIGNING_KEY secret is not provisioned');
      return Response.json({ error: validation.error }, { status: validation.status });
    }
    const { instanceId } = validation;

    const png = new Uint8Array(await request.arrayBuffer());
    if (png.length === 0) {
      return Response.json({ error: 'Empty request body' }, { status: 400 });
    }
    if (png.length > MAX_PNG_BYTES) {
      return Response.json({ error: 'PNG exceeds maximum size' }, { status: 413 });
    }

    try {
      const signed = sign_png(
        png,
        GENERATOR,
        GENERATOR_VERSION,
        PNG_FORMAT,
        instanceId,
        env.EXPORT_SIGNING_KEY
      );
      return new Response(signed, { headers: { 'Content-Type': 'image/png' } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed';
      console.error('C2PA signing failed:', message);
      return Response.json({ error: message }, { status: 400 });
    }
  },
};
