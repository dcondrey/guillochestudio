//! Server-only. Built with `wasm-pack build --target bundler` and loaded via
//! the Cloudflare Workers wasm-bindgen glue pattern inside a SvelteKit server
//! route — never imported from client code. The secret key never leaves this
//! call: it is passed in per-invocation from a Cloudflare Pages secret and is
//! not retained.

use wasm_bindgen::prelude::*;
use zeroize::Zeroizing;

/// Plain-Rust core, runnable under `cargo test` on the native target.
/// `#[wasm_bindgen]` functions that return `JsError` panic if invoked
/// outside a wasm runtime, so the wasm export below is a thin wrapper
/// around this rather than the tested surface itself.
fn sign_manifest_core(payload: &[u8], secret_key_hex: &str) -> Result<Vec<u8>, String> {
    let key_bytes: Zeroizing<Vec<u8>> = Zeroizing::new(
        hex::decode(secret_key_hex.trim()).map_err(|e| format!("invalid secret key hex: {e}"))?,
    );
    let secret_key: Zeroizing<[u8; 32]> = Zeroizing::new(
        key_bytes
            .as_slice()
            .try_into()
            .map_err(|_| "secret key must decode to exactly 32 bytes".to_string())?,
    );
    c2pa_text_binding::sign_cose(payload, &secret_key).map_err(|e| e.to_string())
}

/// Sign `payload` (arbitrary bytes, e.g. a CBOR-encoded C2PA claim) as a
/// tagged COSE_Sign1/EdDSA envelope. `secret_key_hex` must be 64 hex chars
/// (32-byte Ed25519 secret key), matching c2pa-text-binding's own wasm
/// convention.
#[wasm_bindgen]
pub fn sign_manifest(payload: &[u8], secret_key_hex: &str) -> Result<Vec<u8>, JsError> {
    sign_manifest_core(payload, secret_key_hex).map_err(|e| JsError::new(&e))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SK_HEX: &str = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";

    #[test]
    fn round_trips_through_verify_cose() {
        let cose = sign_manifest_core(b"claim bytes", SK_HEX).unwrap();
        let secret_key: [u8; 32] = hex::decode(SK_HEX).unwrap().try_into().unwrap();
        let public_key = c2pa_text_binding::public_key(&secret_key);
        let recovered = c2pa_text_binding::verify_cose(&cose, &public_key).unwrap();
        assert_eq!(recovered, b"claim bytes");
    }

    #[test]
    fn rejects_non_hex_key() {
        assert!(sign_manifest_core(b"payload", "not hex").is_err());
    }

    #[test]
    fn rejects_wrong_length_key() {
        assert!(sign_manifest_core(b"payload", "aabb").is_err());
    }
}
