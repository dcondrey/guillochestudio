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
/// Ed25519 secret key). `cert_der` is an X.509 cert (DER) for that key,
/// embedded as the COSE_Sign1's x5chain; pass an empty slice to sign without
/// one (structurally valid, but no C2PA validator will accept it).
#[wasm_bindgen]
pub fn sign_png(
    png: &[u8],
    generator: &str,
    generator_version: &str,
    format: &str,
    instance_id: &str,
    secret_key_hex: &str,
    cert_der: &[u8],
) -> Result<Vec<u8>, JsError> {
    let cert_der = if cert_der.is_empty() {
        None
    } else {
        Some(cert_der)
    };
    manifest::sign_png(
        png,
        generator,
        generator_version,
        format,
        instance_id,
        secret_key_hex,
        cert_der,
    )
    .map_err(|e| JsError::new(&e))
}
