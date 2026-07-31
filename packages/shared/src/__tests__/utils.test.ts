/**
 * Unit tests for @guilloche/shared utility functions
 * Tests the actual exported functions from the package
 */
import { describe, it, expect, test } from 'vitest';
import {
  gcd,
  getTMax,
  rotate,
  pointFor,
  clamp,
  lerp,
  hexToRgb,
  rgbToHex,
  rgbToCmyk,
  cmykToRgb,
  lerpColor,
  getCubicBezierPoint,
  getBezierAngle,
  getPathLength,
  deepClone,
  getDefaultParams,
} from '../utils/index.js';

const PI = Math.PI;
const TAU = 2 * PI;

// =============================================================================
// GCD (Greatest Common Divisor) Tests
// =============================================================================
describe('gcd', () => {
  it('should calculate GCD for positive integers', () => {
    expect(gcd(12, 8)).toBe(4);
    expect(gcd(100, 35)).toBe(5);
    expect(gcd(7, 13)).toBe(1); // Coprime
    expect(gcd(48, 18)).toBe(6);
  });

  it('should handle equal numbers', () => {
    expect(gcd(5, 5)).toBe(5);
    expect(gcd(100, 100)).toBe(100);
  });

  it('should handle one being multiple of other', () => {
    expect(gcd(12, 4)).toBe(4);
    expect(gcd(4, 12)).toBe(4);
    expect(gcd(100, 25)).toBe(25);
  });

  it('should handle negative numbers', () => {
    expect(gcd(-12, 8)).toBe(4);
    expect(gcd(12, -8)).toBe(4);
    expect(gcd(-12, -8)).toBe(4);
  });

  it('should handle zero values', () => {
    expect(gcd(0, 5)).toBe(5);
    expect(gcd(5, 0)).toBe(5);
    expect(gcd(0, 0)).toBe(1); // Edge case: returns 1
  });

  it('should handle large numbers', () => {
    expect(gcd(1000000, 500000)).toBe(500000);
    expect(gcd(123456, 789)).toBe(3);
  });

  it('should be commutative', () => {
    expect(gcd(24, 36)).toBe(gcd(36, 24));
    expect(gcd(17, 23)).toBe(gcd(23, 17));
  });
});

// =============================================================================
// getTMax Tests
// =============================================================================
describe('getTMax', () => {
  it('should return 2*PI for rose, liss, and liss3d', () => {
    expect(getTMax('rose', 100, 50, 3, 1)).toBeCloseTo(TAU);
    expect(getTMax('liss', 100, 50, 3, 1)).toBeCloseTo(TAU);
    expect(getTMax('liss3d', 100, 50, 3, 1)).toBeCloseTo(TAU);
  });

  it('should return 2*PI*k for spiral and fermat', () => {
    expect(getTMax('spiral', 100, 50, 3, 1)).toBeCloseTo(TAU * 3);
    expect(getTMax('fermat', 100, 50, 5, 1)).toBeCloseTo(TAU * 5);
  });

  it('should calculate correct tMax for trochoids', () => {
    // For R=100, r=50: gcd=50, tMax = 2*PI * (50/50) = 2*PI
    expect(getTMax('hypotrochoid', 100, 50, 1, 1)).toBeCloseTo(TAU);
    expect(getTMax('hypo', 100, 50, 1, 1)).toBeCloseTo(TAU);
    expect(getTMax('epitrochoid', 100, 50, 1, 1)).toBeCloseTo(TAU);
    expect(getTMax('epi', 100, 50, 1, 1)).toBeCloseTo(TAU);

    // For R=100, r=33: gcd=1, tMax = 2*PI * (33/1) = 66*PI
    expect(getTMax('hypotrochoid', 100, 33, 1, 1)).toBeCloseTo(TAU * 33);
  });

  it('should handle r=0 edge case without returning 0 or NaN', () => {
    const result = getTMax('hypotrochoid', 100, 0, 1, 1);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it('should handle R=0 edge case', () => {
    const result = getTMax('hypotrochoid', 0, 50, 1, 1);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it('should handle k=0 edge case for spiral', () => {
    const result = getTMax('spiral', 100, 50, 0, 1);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it('should return default for unknown family', () => {
    expect(getTMax('unknown', 100, 50, 1, 1)).toBeCloseTo(TAU * 10);
  });
});

// =============================================================================
// rotate Tests
// =============================================================================
describe('rotate', () => {
  it('should rotate point 90 degrees', () => {
    const [x, y] = rotate(1, 0, PI / 2);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
  });

  it('should rotate point 180 degrees', () => {
    const [x, y] = rotate(1, 2, PI);
    expect(x).toBeCloseTo(-1);
    expect(y).toBeCloseTo(-2);
  });

  it('should return same point for full rotation', () => {
    const [x, y] = rotate(3, 4, TAU);
    expect(x).toBeCloseTo(3);
    expect(y).toBeCloseTo(4);
  });

  it('should return same point for zero rotation', () => {
    const [x, y] = rotate(5, 7, 0);
    expect(x).toBeCloseTo(5);
    expect(y).toBeCloseTo(7);
  });

  it('should handle negative angles', () => {
    const [x, y] = rotate(1, 0, -PI / 2);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(-1);
  });

  it('should handle point at origin', () => {
    const [x, y] = rotate(0, 0, PI / 3);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
  });
});

// =============================================================================
// pointFor Tests
// =============================================================================
describe('pointFor', () => {
  const defaultParams = {
    R: 100,
    r: 50,
    d: 30,
    k: 3,
    m: 0,
    mf: 1,
    phase: 0,
  };

  describe('hypotrochoid family', () => {
    it('should compute valid points for hypo', () => {
      const [x, y] = pointFor(0, { ...defaultParams, family: 'hypo' });
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });

    it('should compute valid points for hypotrochoid', () => {
      const [x, y] = pointFor(PI, { ...defaultParams, family: 'hypotrochoid' });
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });

    it('should handle r=0 edge case without NaN', () => {
      const [x, y] = pointFor(PI, { ...defaultParams, r: 0, family: 'hypotrochoid' });
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });
  });

  describe('epitrochoid family', () => {
    it('should compute valid points for epi', () => {
      const [x, y] = pointFor(0, { ...defaultParams, family: 'epi' });
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });

    it('should handle r=0 edge case without NaN', () => {
      const [x, y] = pointFor(PI, { ...defaultParams, r: 0, family: 'epitrochoid' });
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });
  });

  describe('rose curve', () => {
    it('should compute valid points', () => {
      const [x, y] = pointFor(PI / 4, { ...defaultParams, family: 'rose' });
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });

    it('should handle k=0', () => {
      const [x, y] = pointFor(PI / 4, { ...defaultParams, k: 0, family: 'rose' });
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });
  });

  describe('lissajous', () => {
    it('should compute valid points', () => {
      const [x, y] = pointFor(PI / 3, { ...defaultParams, family: 'liss' });
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });
  });

  describe('spiral', () => {
    it('should compute valid points', () => {
      const [x, y] = pointFor(TAU, { ...defaultParams, family: 'spiral' });
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });
  });

  describe('fermat spiral', () => {
    it('should compute valid points', () => {
      const [x, y] = pointFor(PI, { ...defaultParams, family: 'fermat' });
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });

    it('should handle t=0', () => {
      const [x, y] = pointFor(0, { ...defaultParams, family: 'fermat' });
      expect(x).toBeCloseTo(0);
      expect(y).toBeCloseTo(0);
    });

    it('should handle negative t gracefully', () => {
      const [x, y] = pointFor(-PI, { ...defaultParams, family: 'fermat' });
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });
  });

  describe('lissajous 3D', () => {
    it('should compute valid points', () => {
      const [x, y] = pointFor(PI / 2, { ...defaultParams, family: 'liss3d' });
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });
  });

  describe('default (circle)', () => {
    it('should fall back to circle for unknown family', () => {
      const [x, y] = pointFor(0, { ...defaultParams, family: 'unknown' as any });
      expect(x).toBeCloseTo(100); // R * cos(0)
      expect(y).toBeCloseTo(0); // R * sin(0)
    });
  });

  describe('modulation', () => {
    it('should apply modulation when m > 0', () => {
      // Use t=PI/4 where sin(mf*t) won't be zero
      const withMod = pointFor(PI / 4, { ...defaultParams, m: 0.5, mf: 2, family: 'hypo' });
      const withoutMod = pointFor(PI / 4, { ...defaultParams, m: 0, mf: 2, family: 'hypo' });
      // Points should be different when modulation is applied
      // The modulation factor is 1 + m*sin(mf*t + phase), at t=PI/4 and mf=2, sin(PI/2)=1
      // So modulation factor = 1 + 0.5*1 = 1.5, meaning coords should be 1.5x larger
      const ratio =
        Math.sqrt(withMod[0] ** 2 + withMod[1] ** 2) /
        Math.sqrt(withoutMod[0] ** 2 + withoutMod[1] ** 2);
      expect(ratio).toBeCloseTo(1.5, 1);
    });
  });
});

// =============================================================================
// clamp Tests
// =============================================================================
describe('clamp', () => {
  it('should return value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('should return min when value is below', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(-100, 0, 1)).toBe(0);
  });

  it('should return max when value is above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(100, 0, 1)).toBe(1);
  });

  it('should handle boundary values', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('should handle negative ranges', () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(-15, -10, -1)).toBe(-10);
    expect(clamp(0, -10, -1)).toBe(-1);
  });

  it('should handle min === max', () => {
    expect(clamp(5, 10, 10)).toBe(10);
    expect(clamp(15, 10, 10)).toBe(10);
  });
});

// =============================================================================
// lerp Tests
// =============================================================================
describe('lerp', () => {
  it('should return a when t=0', () => {
    expect(lerp(0, 100, 0)).toBe(0);
    expect(lerp(50, 100, 0)).toBe(50);
  });

  it('should return b when t=1', () => {
    expect(lerp(0, 100, 1)).toBe(100);
    expect(lerp(50, 100, 1)).toBe(100);
  });

  it('should return midpoint when t=0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(-50, 50, 0.5)).toBe(0);
  });

  it('should extrapolate beyond 0-1', () => {
    expect(lerp(0, 100, 2)).toBe(200);
    expect(lerp(0, 100, -1)).toBe(-100);
  });

  it('should handle equal a and b', () => {
    expect(lerp(50, 50, 0.5)).toBe(50);
    expect(lerp(50, 50, 0)).toBe(50);
    expect(lerp(50, 50, 1)).toBe(50);
  });
});

// =============================================================================
// hexToRgb Tests
// =============================================================================
describe('hexToRgb', () => {
  it('should parse 6-character hex', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0, a: 1 });
    expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255, a: 1 });
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('should parse 6-character hex without #', () => {
    expect(hexToRgb('FF0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it('should parse 3-character hex shorthand', () => {
    expect(hexToRgb('#FFF')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(hexToRgb('#F00')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(hexToRgb('#0F0')).toEqual({ r: 0, g: 255, b: 0, a: 1 });
    expect(hexToRgb('ABC')).toEqual({ r: 170, g: 187, b: 204, a: 1 });
  });

  it('should parse 8-character hex with alpha', () => {
    expect(hexToRgb('#FF000080')).toEqual({ r: 255, g: 0, b: 0, a: 128 / 255 });
    expect(hexToRgb('#FFFFFFFF')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(hexToRgb('#00000000')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('should parse 4-character hex shorthand with alpha', () => {
    expect(hexToRgb('#FFFF')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(hexToRgb('#F008')).toEqual({ r: 255, g: 0, b: 0, a: 136 / 255 });
  });

  it('should return null for invalid input', () => {
    expect(hexToRgb('not-a-color')).toBeNull();
    expect(hexToRgb('')).toBeNull();
    expect(hexToRgb('#GGG')).toBeNull();
    expect(hexToRgb('#12345')).toBeNull(); // 5 chars invalid
  });

  it('should return null for null/undefined input', () => {
    expect(hexToRgb(null as any)).toBeNull();
    expect(hexToRgb(undefined as any)).toBeNull();
  });

  it('should be case insensitive', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(hexToRgb('#Ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });
});

// =============================================================================
// rgbToHex Tests
// =============================================================================
describe('rgbToHex', () => {
  it('should convert RGB to hex', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
    expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
    expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
  });

  it('should include alpha when < 1', () => {
    expect(rgbToHex(255, 0, 0, 0.5)).toBe('#ff000080');
    expect(rgbToHex(255, 255, 255, 0)).toBe('#ffffff00');
  });

  it('should clamp values to 0-255', () => {
    expect(rgbToHex(300, 0, 0)).toBe('#ff0000');
    expect(rgbToHex(-50, 0, 0)).toBe('#000000');
  });

  it('should round floating point values', () => {
    expect(rgbToHex(127.5, 127.5, 127.5)).toBe('#808080');
  });
});

// =============================================================================
// rgbToCmyk Tests
// =============================================================================
describe('rgbToCmyk', () => {
  it('should convert RGB to CMYK', () => {
    // Pure red
    const red = rgbToCmyk(255, 0, 0);
    expect(red.c).toBe(0);
    expect(red.m).toBe(100);
    expect(red.y).toBe(100);
    expect(red.k).toBe(0);

    // Pure white
    const white = rgbToCmyk(255, 255, 255);
    expect(white.c).toBe(0);
    expect(white.m).toBe(0);
    expect(white.y).toBe(0);
    expect(white.k).toBe(0);

    // Pure black
    const black = rgbToCmyk(0, 0, 0);
    expect(black.k).toBe(100);
  });
});

// =============================================================================
// cmykToRgb Tests
// =============================================================================
describe('cmykToRgb', () => {
  it('should convert CMYK to RGB', () => {
    // Pure red in CMYK
    const red = cmykToRgb(0, 100, 100, 0);
    expect(red.r).toBe(255);
    expect(red.g).toBe(0);
    expect(red.b).toBe(0);

    // Pure white
    const white = cmykToRgb(0, 0, 0, 0);
    expect(white.r).toBe(255);
    expect(white.g).toBe(255);
    expect(white.b).toBe(255);

    // Pure black
    const black = cmykToRgb(0, 0, 0, 100);
    expect(black.r).toBe(0);
    expect(black.g).toBe(0);
    expect(black.b).toBe(0);
  });
});

// =============================================================================
// lerpColor Tests
// =============================================================================
describe('lerpColor', () => {
  it('should return first color when t=0', () => {
    expect(lerpColor('#FF0000', '#00FF00', 0)).toBe('#ff0000');
  });

  it('should return second color when t=1', () => {
    expect(lerpColor('#FF0000', '#00FF00', 1)).toBe('#00ff00');
  });

  it('should interpolate at midpoint', () => {
    const result = lerpColor('#000000', '#FFFFFF', 0.5);
    expect(result).toBe('#808080');
  });

  it('should handle invalid colors gracefully', () => {
    expect(lerpColor('invalid', '#00FF00', 0.5)).toBe('invalid');
    expect(lerpColor('#FF0000', 'invalid', 0.5)).toBe('#FF0000');
  });
});

// =============================================================================
// getCubicBezierPoint Tests
// =============================================================================
describe('getCubicBezierPoint', () => {
  const p0 = { x: 0, y: 0 };
  const cp1 = { x: 0, y: 100 };
  const cp2 = { x: 100, y: 100 };
  const p1 = { x: 100, y: 0 };

  it('should return start point at t=0', () => {
    const result = getCubicBezierPoint(0, p0, cp1, cp2, p1);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  it('should return end point at t=1', () => {
    const result = getCubicBezierPoint(1, p0, cp1, cp2, p1);
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(0);
  });

  it('should compute valid midpoint', () => {
    const result = getCubicBezierPoint(0.5, p0, cp1, cp2, p1);
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
    expect(result.x).toBeCloseTo(50);
  });
});

// =============================================================================
// getBezierAngle Tests
// =============================================================================
describe('getBezierAngle', () => {
  const p0 = { x: 0, y: 0 };
  const cp1 = { x: 100, y: 0 };
  const cp2 = { x: 100, y: 0 };
  const p1 = { x: 100, y: 0 };

  it('should return horizontal angle for horizontal line', () => {
    const angle = getBezierAngle(0, p0, cp1, cp2, p1);
    expect(angle).toBeCloseTo(0);
  });

  it('should return valid angle at midpoint', () => {
    const angle = getBezierAngle(0.5, p0, cp1, cp2, p1);
    expect(Number.isFinite(angle)).toBe(true);
  });
});

// =============================================================================
// getPathLength Tests
// =============================================================================
describe('getPathLength', () => {
  it('should calculate length of straight line', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 3, y: 4 },
    ];
    expect(getPathLength(points)).toBeCloseTo(5);
  });

  it('should calculate length of multi-segment path', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 4 },
    ];
    expect(getPathLength(points)).toBeCloseTo(7);
  });

  it('should return 0 for single point', () => {
    expect(getPathLength([{ x: 0, y: 0 }])).toBe(0);
  });

  it('should return 0 for empty array', () => {
    expect(getPathLength([])).toBe(0);
  });
});

// =============================================================================
// deepClone Tests
// =============================================================================
describe('deepClone', () => {
  it('should create independent copy of object', () => {
    const original = { a: 1, b: { c: 2 } };
    const clone = deepClone(original);
    clone.b.c = 999;
    expect(original.b.c).toBe(2);
  });

  it('should clone arrays', () => {
    const original = [1, 2, [3, 4]];
    const clone = deepClone(original);
    (clone[2] as number[])[0] = 999;
    expect((original[2] as number[])[0]).toBe(3);
  });

  it('should handle null and undefined', () => {
    expect(deepClone(null)).toBeNull();
  });
});

// =============================================================================
// getDefaultParams Tests
// =============================================================================
describe('getDefaultParams', () => {
  it('should return valid PatternParams object', () => {
    const params = getDefaultParams();
    expect(params.mode).toBe('curve');
    expect(params.family).toBe('hypo');
    expect(params.R).toBe(240);
    expect(params.r).toBe(79);
    expect(params.d).toBe(140);
    expect(params.steps).toBe(16000);
  });

  it('should return independent copies', () => {
    const params1 = getDefaultParams();
    const params2 = getDefaultParams();
    params1.R = 999;
    expect(params2.R).toBe(240);
  });
});
