//! Minimal PNG chunk handling: just enough to find the C2PA insertion point
//! (immediately after IHDR, per the c2pa-rs reference implementation) and
//! splice a chunk in. Not a general PNG parser.

const PNG_SIGNATURE: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
/// PNG signature (8) + IHDR chunk (length 4 + type 4 + 13-byte fixed payload + crc 4).
const IHDR_CHUNK_END: usize = 8 + 4 + 4 + 13 + 4;

pub fn validate_ihdr(png: &[u8]) -> Result<(), String> {
    if png.len() < IHDR_CHUNK_END {
        return Err("file too short to contain a valid IHDR chunk".to_string());
    }
    if png[0..8] != PNG_SIGNATURE {
        return Err("not a PNG file (bad signature)".to_string());
    }
    let ihdr_len = u32::from_be_bytes(png[8..12].try_into().unwrap());
    if ihdr_len != 13 {
        return Err(format!("IHDR length must be 13, got {ihdr_len}"));
    }
    if &png[12..16] != b"IHDR" {
        return Err("first chunk after signature must be IHDR".to_string());
    }
    Ok(())
}

/// Splices `chunk_data` (the caBX chunk's data field only, without its own
/// length/type/CRC framing) into `png`, right after IHDR, writing a
/// complete PNG chunk record around it.
pub fn insert_chunk_after_ihdr(png: &[u8], chunk_type: &[u8; 4], chunk_data: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(png.len() + 12 + chunk_data.len());
    out.extend_from_slice(&png[..IHDR_CHUNK_END]);
    out.extend_from_slice(&(chunk_data.len() as u32).to_be_bytes());
    out.extend_from_slice(chunk_type);
    out.extend_from_slice(chunk_data);
    let crc = png_crc32(chunk_type, chunk_data);
    out.extend_from_slice(&crc.to_be_bytes());
    out.extend_from_slice(&png[IHDR_CHUNK_END..]);
    out
}

/// Byte offset where a chunk inserted via [`insert_chunk_after_ihdr`] starts
/// (the offset of its length field) — the exclusion range's `start`.
pub fn insertion_offset() -> usize {
    IHDR_CHUNK_END
}

fn png_crc32(chunk_type: &[u8; 4], data: &[u8]) -> u32 {
    let mut crc = 0xFFFF_FFFFu32;
    for &byte in chunk_type.iter().chain(data.iter()) {
        crc ^= byte as u32;
        for _ in 0..8 {
            crc = if crc & 1 != 0 { (crc >> 1) ^ 0xEDB8_8320 } else { crc >> 1 };
        }
    }
    crc ^ 0xFFFF_FFFF
}

#[cfg(test)]
mod tests {
    use super::*;

    fn minimal_png() -> Vec<u8> {
        let mut png = PNG_SIGNATURE.to_vec();
        png.extend_from_slice(&13u32.to_be_bytes());
        png.extend_from_slice(b"IHDR");
        png.extend_from_slice(&[0u8; 13]);
        png.extend_from_slice(&0u32.to_be_bytes()); // crc, unchecked by validate_ihdr
        png.extend_from_slice(b"rest of file");
        png
    }

    #[test]
    fn validates_well_formed_ihdr() {
        assert!(validate_ihdr(&minimal_png()).is_ok());
    }

    #[test]
    fn rejects_bad_signature() {
        let mut png = minimal_png();
        png[0] = 0;
        assert!(validate_ihdr(&png).is_err());
    }

    #[test]
    fn rejects_non_ihdr_first_chunk() {
        let mut png = minimal_png();
        png[12..16].copy_from_slice(b"IDAT");
        assert!(validate_ihdr(&png).is_err());
    }

    #[test]
    fn insert_preserves_bytes_before_and_after() {
        let png = minimal_png();
        let out = insert_chunk_after_ihdr(&png, b"caBX", b"payload");
        assert_eq!(&out[..IHDR_CHUNK_END], &png[..IHDR_CHUNK_END]);
        assert_eq!(&out[out.len() - b"rest of file".len()..], b"rest of file");
    }

    #[test]
    fn insert_produces_valid_chunk_framing() {
        let png = minimal_png();
        let out = insert_chunk_after_ihdr(&png, b"caBX", b"payload");
        let off = insertion_offset();
        let len = u32::from_be_bytes(out[off..off + 4].try_into().unwrap());
        assert_eq!(len as usize, b"payload".len());
        assert_eq!(&out[off + 4..off + 8], b"caBX");
        assert_eq!(&out[off + 8..off + 8 + 7], b"payload");
    }

    #[test]
    fn crc_matches_known_test_vector() {
        // Standard PNG CRC test vector: CRC32 of "IEND" chunk type + empty data.
        assert_eq!(png_crc32(b"IEND", b""), 0xAE42_6082);
    }
}
