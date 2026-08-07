//! Builds a minimal, integrity-only C2PA manifest (one `c2pa.actions`
//! assertion recording `c2pa.created`, one `c2pa.hash.data` hard-binding
//! assertion, one claim, one COSE_Sign1 signature) and embeds it into a PNG
//! as a `caBX` chunk after `IHDR`.
//!
//! Box-type/UUID constants and field layout are taken directly from
//! contentauth/c2pa-rs (`sdk/src/jumbf/{boxes.rs,labels.rs}`) and the
//! official C2PA CDDL schemas (c2pa-org/specifications, `cddl/claim.cddl`,
//! `cddl/data-hash.cddl`, `cddl/actions.cddl`, `cddl/hashed-uri.cddl`) —
//! not reverse-engineered from an example.

use jumbf::builder::{DataBoxBuilder, SuperBoxBuilder};
use jumbf::BoxType;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::Cursor;
use zeroize::Zeroizing;

use crate::png;

const CBOR_BOX_TYPE: BoxType = BoxType(*b"cbor");

// UUIDs are ASCII 4CC + the fixed 12-byte JUMBF extension suffix
// 00 11 00 10 80 00 00 AA 00 38 9B 71, verified against c2pa-rs's
// CAI_*_UUID constants (sdk/src/jumbf/boxes.rs).
const CAI_BLOCK_UUID: [u8; 16] = *b"c2pa\x00\x11\x00\x10\x80\x00\x00\xAA\x00\x38\x9B\x71";
const CAI_MANIFEST_UUID: [u8; 16] = *b"c2ma\x00\x11\x00\x10\x80\x00\x00\xAA\x00\x38\x9B\x71";
const CAI_ASSERTION_STORE_UUID: [u8; 16] = *b"c2as\x00\x11\x00\x10\x80\x00\x00\xAA\x00\x38\x9B\x71";
const CAI_CBOR_ASSERTION_UUID: [u8; 16] = *b"cbor\x00\x11\x00\x10\x80\x00\x00\xAA\x00\x38\x9B\x71";
const CAI_CLAIM_UUID: [u8; 16] = *b"c2cl\x00\x11\x00\x10\x80\x00\x00\xAA\x00\x38\x9B\x71";
const CAI_SIGNATURE_UUID: [u8; 16] = *b"c2cs\x00\x11\x00\x10\x80\x00\x00\xAA\x00\x38\x9B\x71";

const LABEL_MANIFEST_STORE: &str = "c2pa";
const LABEL_ASSERTIONS: &str = "c2pa.assertions";
const LABEL_CLAIM: &str = "c2pa.claim";
const LABEL_SIGNATURE: &str = "c2pa.signature";
const LABEL_ACTIONS: &str = "c2pa.actions";
const LABEL_HASH_DATA: &str = "c2pa.hash.data";

#[derive(Serialize)]
struct HashedUri {
    url: String,
    #[serde(with = "serde_bytes")]
    hash: Vec<u8>,
}

#[derive(Serialize)]
struct GeneratorInfo {
    name: String,
    version: String,
}

#[derive(Serialize)]
struct ClaimMap {
    claim_generator: String,
    claim_generator_info: Vec<GeneratorInfo>,
    signature: String,
    assertions: Vec<HashedUri>,
    #[serde(rename = "dc:format")]
    format: String,
    #[serde(rename = "instanceID")]
    instance_id: String,
}

#[derive(Serialize)]
struct ActionItem {
    action: String,
}

#[derive(Serialize)]
struct ActionsMap {
    actions: Vec<ActionItem>,
}

#[derive(Serialize)]
struct ExclusionRange {
    start: u64,
    length: u64,
}

#[derive(Serialize)]
struct DataHashMap {
    exclusions: Vec<ExclusionRange>,
    alg: String,
    #[serde(with = "serde_bytes")]
    hash: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pad: Vec<u8>,
}

fn cbor_bytes<T: Serialize>(value: &T) -> Vec<u8> {
    let mut out = Vec::new();
    ciborium::into_writer(value, &mut out).expect("in-memory CBOR encoding cannot fail");
    out
}

/// Builds a standalone assertion box (superbox: jumd desc + one cbor data
/// box) and returns both its serialized bytes (for hashing into the claim)
/// and the builder itself (for embedding into the assertion store).
fn assertion_box(label: &str, cbor_payload: Vec<u8>) -> (Vec<u8>, SuperBoxBuilder<'_>) {
    let make = || {
        SuperBoxBuilder::new(&CAI_CBOR_ASSERTION_UUID)
            .set_label(label)
            .add_child_box(DataBoxBuilder::from_owned(
                CBOR_BOX_TYPE,
                cbor_payload.clone(),
            ))
    };
    let bytes = write_box(&make());
    (bytes, make())
}

fn write_box(b: &SuperBoxBuilder) -> Vec<u8> {
    let mut out = Cursor::new(Vec::new());
    b.write_jumbf(&mut out)
        .expect("in-memory JUMBF write cannot fail");
    out.into_inner()
}

fn sha256(data: &[u8]) -> Vec<u8> {
    Sha256::digest(data).to_vec()
}

struct BuiltManifest {
    jumbf_bytes: Vec<u8>,
}

/// Fields constant across every pass of the [`sign_png`] fixed-point loop.
struct ManifestParams<'a> {
    generator: &'a str,
    generator_version: &'a str,
    format: &'a str,
    instance_id: &'a str,
    secret_key_hex: &'a str,
}

/// Builds the full manifest-store JUMBF tree given the already-computed data
/// hash (or a same-length placeholder — see [`sign_png`]) and signs it.
fn build_and_sign(
    params: &ManifestParams,
    data_hash: &[u8; 32],
    exclusion_start: u64,
    exclusion_length: u64,
) -> Result<BuiltManifest, String> {
    let ManifestParams {
        generator,
        generator_version,
        format,
        instance_id,
        secret_key_hex,
    } = *params;

    let actions_cbor = cbor_bytes(&ActionsMap {
        actions: vec![ActionItem {
            action: "c2pa.created".to_string(),
        }],
    });
    let (actions_bytes, actions_box) = assertion_box(LABEL_ACTIONS, actions_cbor);

    let data_hash_cbor = cbor_bytes(&DataHashMap {
        exclusions: vec![ExclusionRange {
            start: exclusion_start,
            length: exclusion_length,
        }],
        alg: "sha256".to_string(),
        hash: data_hash.to_vec(),
        pad: Vec::new(),
    });
    let (data_hash_bytes, data_hash_box) = assertion_box(LABEL_HASH_DATA, data_hash_cbor);

    let assertion_store = SuperBoxBuilder::new(&CAI_ASSERTION_STORE_UUID)
        .set_label(LABEL_ASSERTIONS)
        .add_child_box(actions_box)
        .add_child_box(data_hash_box);

    let claim_cbor = cbor_bytes(&ClaimMap {
        claim_generator: format!("{generator}/{generator_version}"),
        claim_generator_info: vec![GeneratorInfo {
            name: generator.to_string(),
            version: generator_version.to_string(),
        }],
        signature: format!("self#jumbf={LABEL_SIGNATURE}"),
        assertions: vec![
            HashedUri {
                url: format!("{LABEL_ASSERTIONS}/{LABEL_ACTIONS}"),
                hash: sha256(&actions_bytes),
            },
            HashedUri {
                url: format!("{LABEL_ASSERTIONS}/{LABEL_HASH_DATA}"),
                hash: sha256(&data_hash_bytes),
            },
        ],
        format: format.to_string(),
        instance_id: instance_id.to_string(),
    });
    let claim_box = SuperBoxBuilder::new(&CAI_CLAIM_UUID)
        .set_label(LABEL_CLAIM)
        .add_child_box(DataBoxBuilder::from_owned(
            CBOR_BOX_TYPE,
            claim_cbor.clone(),
        ));

    let cose = c2pa_text_binding::sign_cose(&claim_cbor, &*decode_secret_key(secret_key_hex)?)
        .map_err(|e| e.to_string())?;
    let signature_box = SuperBoxBuilder::new(&CAI_SIGNATURE_UUID)
        .set_label(LABEL_SIGNATURE)
        .add_child_box(DataBoxBuilder::from_owned(CBOR_BOX_TYPE, cose));

    let manifest_label = format!("{generator}_1");
    let manifest_box = SuperBoxBuilder::new(&CAI_MANIFEST_UUID)
        .set_label(manifest_label)
        .add_child_box(assertion_store)
        .add_child_box(claim_box)
        .add_child_box(signature_box);

    let manifest_store = SuperBoxBuilder::new(&CAI_BLOCK_UUID)
        .set_label(LABEL_MANIFEST_STORE)
        .add_child_box(manifest_box);

    Ok(BuiltManifest {
        jumbf_bytes: write_box(&manifest_store),
    })
}

fn decode_secret_key(secret_key_hex: &str) -> Result<Zeroizing<[u8; 32]>, String> {
    let bytes: Zeroizing<Vec<u8>> = Zeroizing::new(
        hex::decode(secret_key_hex.trim()).map_err(|e| format!("invalid secret key hex: {e}"))?,
    );
    let key: [u8; 32] = bytes
        .as_slice()
        .try_into()
        .map_err(|_| "secret key must decode to exactly 32 bytes".to_string())?;
    Ok(Zeroizing::new(key))
}

/// Signs `png` end to end: builds a same-size placeholder manifest to learn
/// the exact `caBX` chunk length, splices it in, hashes the resulting file
/// with that chunk excluded, then rebuilds the manifest with the real hash.
///
/// The exclusion `length` field is itself part of the manifest that gets
/// hashed, and CBOR integers are variable-width (0 encodes in 1 byte, values
/// over 255 need 3), so guessing a placeholder length can change the
/// manifest's own byte size and invalidate the guess. This converges to a
/// fixed point instead: keep rebuilding with the previous pass's exact size
/// as the next `length` guess until it stops changing (in practice 2-3
/// passes, since CBOR width only has a few discrete buckets).
pub fn sign_png(
    png_in: &[u8],
    generator: &str,
    generator_version: &str,
    format: &str,
    instance_id: &str,
    secret_key_hex: &str,
) -> Result<Vec<u8>, String> {
    png::validate_ihdr(png_in)?;
    let exclusion_start = png::insertion_offset() as u64;
    let placeholder_hash = [0u8; 32];
    let params = ManifestParams {
        generator,
        generator_version,
        format,
        instance_id,
        secret_key_hex,
    };

    let mut exclusion_length = 0u64;
    const MAX_PASSES: u32 = 8;
    for pass in 0..MAX_PASSES {
        let candidate = build_and_sign(
            &params,
            &placeholder_hash,
            exclusion_start,
            exclusion_length,
        )?;
        let candidate_length = (candidate.jumbf_bytes.len() + 12) as u64; // + length/type/crc framing
        if candidate_length == exclusion_length {
            break;
        }
        exclusion_length = candidate_length;
        if pass == MAX_PASSES - 1 {
            return Err("exclusion length did not converge after 8 passes".to_string());
        }
    }

    let placeholder = build_and_sign(
        &params,
        &placeholder_hash,
        exclusion_start,
        exclusion_length,
    )?;
    debug_assert_eq!(
        (placeholder.jumbf_bytes.len() + 12) as u64,
        exclusion_length
    );

    let with_placeholder = png::insert_chunk_after_ihdr(png_in, b"caBX", &placeholder.jumbf_bytes);
    let before = &with_placeholder[..exclusion_start as usize];
    let after = &with_placeholder[exclusion_start as usize + exclusion_length as usize..];
    let mut hasher = Sha256::new();
    hasher.update(before);
    hasher.update(after);
    let real_hash: [u8; 32] = hasher.finalize().into();

    let final_manifest = build_and_sign(&params, &real_hash, exclusion_start, exclusion_length)?;
    if (final_manifest.jumbf_bytes.len() + 12) as u64 != exclusion_length {
        return Err(format!(
            "internal error: manifest size changed after inserting the real hash ({} vs {} bytes) — the hash value itself must not affect CBOR width, but something did",
            exclusion_length,
            final_manifest.jumbf_bytes.len() + 12
        ));
    }

    Ok(png::insert_chunk_after_ihdr(
        png_in,
        b"caBX",
        &final_manifest.jumbf_bytes,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SK_HEX: &str = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";

    fn minimal_png() -> Vec<u8> {
        let mut png = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        png.extend_from_slice(&13u32.to_be_bytes());
        png.extend_from_slice(b"IHDR");
        png.extend_from_slice(&[0u8; 13]);
        png.extend_from_slice(&0u32.to_be_bytes());
        png.extend_from_slice(b"IEND trailer placeholder");
        png
    }

    #[test]
    fn signs_and_embeds_a_cabx_chunk_after_ihdr() {
        let out = sign_png(
            &minimal_png(),
            "guilloche",
            "1.0.0",
            "image/png",
            "xmp:iid:test",
            SK_HEX,
        )
        .unwrap();
        let off = png::insertion_offset();
        assert_eq!(&out[off + 4..off + 8], b"caBX");
    }

    #[test]
    fn rejects_malformed_png() {
        assert!(sign_png(
            b"not a png",
            "guilloche",
            "1.0.0",
            "image/png",
            "id",
            SK_HEX
        )
        .is_err());
    }

    #[test]
    fn embedded_manifest_round_trips_through_jumbf_parse() {
        let out = sign_png(
            &minimal_png(),
            "guilloche",
            "1.0.0",
            "image/png",
            "xmp:iid:test",
            SK_HEX,
        )
        .unwrap();
        let off = png::insertion_offset();
        let len = u32::from_be_bytes(out[off..off + 4].try_into().unwrap()) as usize;
        let chunk_data = &out[off + 8..off + 8 + len];
        // The manifest store's outer box must itself be a well-formed jumb
        // superbox spanning the whole chunk payload.
        assert_eq!(&chunk_data[4..8], b"jumb");
        let outer_len = u32::from_be_bytes(chunk_data[0..4].try_into().unwrap()) as usize;
        assert_eq!(outer_len, chunk_data.len());
    }
}
