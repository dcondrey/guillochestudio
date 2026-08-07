//! Server-only. Built with `wasm-pack build --target bundler` and loaded via
//! the Cloudflare Workers wasm-bindgen glue pattern inside a SvelteKit server
//! route — never imported from client code. The secret key never leaves this
//! call: it is passed in per-invocation from a Cloudflare Pages secret and is
//! not retained.

mod manifest;
mod png;

use wasm_bindgen::prelude::*;

/// Signs a PNG's bytes with a minimal C2PA manifest (integrity-only: one
/// `c2pa.created` action, one hard-binding data hash, no ingredients) and
/// returns the signed PNG. `secret_key_hex` must be 64 hex chars (32-byte
/// Ed25519 secret key).
#[wasm_bindgen]
pub fn sign_png(
    png: &[u8],
    generator: &str,
    generator_version: &str,
    format: &str,
    instance_id: &str,
    secret_key_hex: &str,
) -> Result<Vec<u8>, JsError> {
    manifest::sign_png(png, generator, generator_version, format, instance_id, secret_key_hex)
        .map_err(|e| JsError::new(&e))
}
