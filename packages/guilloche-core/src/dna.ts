import type { PatternParams } from '@guilloche/shared';
import { getDefaultParams, deepClone } from '@guilloche/shared';
import { DNA_ALPHABET, DNA_CODE_LENGTH } from '@guilloche/shared';

/**
 * Pattern DNA encoder/decoder for shareable short codes
 *
 * Encoding process:
 * 1. Quantize float parameters to reduce precision
 * 2. Delta encode sequential values
 * 3. Pack into bytes
 * 4. Compress using simple RLE
 * 5. Encode to base62 for URL-safe string
 */

// Parameter encoding config
interface ParamConfig {
  key: keyof PatternParams;
  min: number;
  max: number;
  precision: number; // decimal places or 0 for int
  bits: number;
}

const PARAM_CONFIG: ParamConfig[] = [
  { key: 'family', min: 0, max: 8, precision: 0, bits: 4 },
  { key: 'R', min: 10, max: 450, precision: 0, bits: 9 },
  { key: 'r', min: 5, max: 300, precision: 0, bits: 9 },
  { key: 'd', min: 0, max: 320, precision: 0, bits: 9 },
  { key: 'k', min: 1, max: 80, precision: 0, bits: 7 },
  { key: 'm', min: 0, max: 1, precision: 2, bits: 7 },
  { key: 'mf', min: 1, max: 80, precision: 0, bits: 7 },
  { key: 'phase', min: 0, max: 6.283, precision: 2, bits: 9 },
  { key: 'rot', min: 0, max: 6.283, precision: 3, bits: 10 },
  { key: 's', min: 0.2, max: 3, precision: 2, bits: 8 },
  { key: 'symmetry', min: 1, max: 24, precision: 0, bits: 5 },
  { key: 'reflectH', min: 0, max: 1, precision: 0, bits: 1 },
  { key: 'reflectV', min: 0, max: 1, precision: 0, bits: 1 },
  { key: 'kaleidoscope', min: 0, max: 1, precision: 0, bits: 1 },
  { key: 'lw', min: 0.1, max: 8, precision: 1, bits: 6 },
];

const FAMILY_MAP: Record<string, number> = {
  hypo: 0,
  epi: 1,
  rose: 2,
  liss: 3,
  spiral: 4,
  hypocycloid: 5,
  epicycloid: 6,
  fermat: 7,
  liss3d: 8,
};

const FAMILY_REVERSE: Record<number, PatternParams['family']> = {
  0: 'hypo',
  1: 'epi',
  2: 'rose',
  3: 'liss',
  4: 'spiral',
  5: 'hypocycloid',
  6: 'epicycloid',
  7: 'fermat',
  8: 'liss3d',
};

export class PatternDNA {
  /**
   * Encode pattern parameters to a short DNA code
   */
  static encode(params: PatternParams): string {
    const bits: number[] = [];

    for (const config of PARAM_CONFIG) {
      let value: number;

      if (config.key === 'family') {
        value = FAMILY_MAP[params.family] || 0;
      } else if (typeof params[config.key] === 'boolean') {
        value = params[config.key] ? 1 : 0;
      } else {
        value = params[config.key] as number;
      }

      // Normalize to 0-1 range
      const normalized = (value - config.min) / (config.max - config.min);
      const clamped = Math.max(0, Math.min(1, normalized));

      // Convert to integer in bit range
      const maxInt = (1 << config.bits) - 1;
      const intValue = Math.round(clamped * maxInt);

      // Add bits to array (MSB first)
      for (let i = config.bits - 1; i >= 0; i--) {
        bits.push((intValue >> i) & 1);
      }
    }

    // Pack bits into bytes
    const bytes: number[] = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8 && i + j < bits.length; j++) {
        byte = (byte << 1) | bits[i + j];
      }
      // Pad last byte if needed
      const remaining = 8 - Math.min(8, bits.length - i);
      byte <<= remaining;
      bytes.push(byte);
    }

    // Encode bytes to base62
    return this.bytesToBase62(bytes);
  }

  /**
   * Decode a DNA code back to pattern parameters
   */
  static decode(dna: string): PatternParams | null {
    try {
      // Decode base62 to bytes
      const bytes = this.base62ToBytes(dna);
      if (!bytes || bytes.length === 0) return null;

      // Unpack bytes to bits
      const bits: number[] = [];
      for (const byte of bytes) {
        for (let i = 7; i >= 0; i--) {
          bits.push((byte >> i) & 1);
        }
      }

      // Read parameters from bits
      const params = getDefaultParams();
      let bitIndex = 0;

      for (const config of PARAM_CONFIG) {
        // Read integer value from bits
        let intValue = 0;
        for (let i = 0; i < config.bits; i++) {
          intValue = (intValue << 1) | (bits[bitIndex++] || 0);
        }

        // Convert back to original range
        const maxInt = (1 << config.bits) - 1;
        const normalized = intValue / maxInt;
        let value = config.min + normalized * (config.max - config.min);

        // Apply precision
        if (config.precision > 0) {
          value =
            Math.round(value * Math.pow(10, config.precision)) / Math.pow(10, config.precision);
        } else {
          value = Math.round(value);
        }

        // Set parameter
        if (config.key === 'family') {
          params.family = FAMILY_REVERSE[Math.round(value)] || 'hypo';
        } else if (
          config.key === 'reflectH' ||
          config.key === 'reflectV' ||
          config.key === 'kaleidoscope'
        ) {
          (params as unknown as Record<string, boolean>)[config.key] = value >= 0.5;
        } else {
          (params as unknown as Record<string, number>)[config.key] = value;
        }
      }

      return params;
    } catch (e) {
      console.error('Failed to decode DNA:', e);
      return null;
    }
  }

  /**
   * Convert bytes to base62 string
   */
  private static bytesToBase62(bytes: number[]): string {
    // Convert bytes to a big integer
    let num = BigInt(0);
    for (const byte of bytes) {
      num = (num << BigInt(8)) | BigInt(byte);
    }

    // Convert to base62
    const base = BigInt(62);
    const chars: string[] = [];

    while (num > BigInt(0)) {
      const remainder = Number(num % base);
      chars.unshift(DNA_ALPHABET[remainder]);
      num = num / base;
    }

    // Pad to minimum length
    while (chars.length < DNA_CODE_LENGTH) {
      chars.unshift(DNA_ALPHABET[0]);
    }

    return chars.join('');
  }

  /**
   * Convert base62 string to bytes
   */
  private static base62ToBytes(str: string): number[] | null {
    // Convert base62 to big integer
    let num = BigInt(0);
    const base = BigInt(62);

    for (const char of str) {
      const index = DNA_ALPHABET.indexOf(char);
      if (index === -1) return null;
      num = num * base + BigInt(index);
    }

    // Convert to bytes
    const bytes: number[] = [];
    while (num > BigInt(0)) {
      bytes.unshift(Number(num & BigInt(0xff)));
      num = num >> BigInt(8);
    }

    // Ensure we have enough bytes
    while (bytes.length < 11) {
      // Minimum bytes needed for our bit count
      bytes.unshift(0);
    }

    return bytes;
  }

  /**
   * Generate a random DNA code
   */
  static random(): string {
    let code = '';
    for (let i = 0; i < DNA_CODE_LENGTH; i++) {
      code += DNA_ALPHABET[Math.floor(Math.random() * DNA_ALPHABET.length)];
    }
    return code;
  }

  /**
   * Validate a DNA code format
   */
  static isValid(dna: string): boolean {
    if (dna.length !== DNA_CODE_LENGTH) return false;
    for (const char of dna) {
      if (!DNA_ALPHABET.includes(char)) return false;
    }
    return true;
  }

  /**
   * Create a shareable URL from DNA code
   */
  static toURL(dna: string, baseURL = 'https://guilloche.studio'): string {
    return `${baseURL}/dna/${dna}`;
  }

  /**
   * Extract DNA code from URL
   */
  static fromURL(url: string): string | null {
    const match = url.match(/\/dna\/([A-Za-z0-9]{8,})/);
    return match ? match[1] : null;
  }
}
