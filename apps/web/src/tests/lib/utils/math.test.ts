/**
 * Math Utility Tests
 */

import { describe, it, expect } from 'vitest';

// Math utilities for pattern generation
const PI = Math.PI;
const TAU = 2 * PI;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function inverseLerp(a: number, b: number, value: number): number {
  return (value - a) / (b - a);
}

function remap(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = inverseLerp(inMin, inMax, value);
  return lerp(outMin, outMax, t);
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

function rotationsForClosure(R: number, r: number): number {
  // Number of rotations needed for pattern to close
  const g = gcd(R, r);
  return r / g;
}

interface Point {
  x: number;
  y: number;
}

function rotatePoint(p: Point, angle: number, cx = 0, cy = 0): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p.x - cx;
  const dy = p.y - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

describe('Clamp', () => {
  it('should return value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('should return min when value is below range', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('should return max when value is above range', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('should handle edge cases', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('Lerp', () => {
  it('should return a when t is 0', () => {
    expect(lerp(0, 100, 0)).toBe(0);
  });

  it('should return b when t is 1', () => {
    expect(lerp(0, 100, 1)).toBe(100);
  });

  it('should return midpoint when t is 0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });

  it('should handle negative values', () => {
    expect(lerp(-100, 100, 0.5)).toBe(0);
  });

  it('should extrapolate beyond 0-1', () => {
    expect(lerp(0, 100, 2)).toBe(200);
    expect(lerp(0, 100, -1)).toBe(-100);
  });
});

describe('Inverse Lerp', () => {
  it('should return 0 when value equals a', () => {
    expect(inverseLerp(0, 100, 0)).toBe(0);
  });

  it('should return 1 when value equals b', () => {
    expect(inverseLerp(0, 100, 100)).toBe(1);
  });

  it('should return 0.5 at midpoint', () => {
    expect(inverseLerp(0, 100, 50)).toBe(0.5);
  });
});

describe('Remap', () => {
  it('should remap values between ranges', () => {
    expect(remap(5, 0, 10, 0, 100)).toBe(50);
    expect(remap(0, 0, 10, 0, 100)).toBe(0);
    expect(remap(10, 0, 10, 0, 100)).toBe(100);
  });

  it('should handle inverse ranges', () => {
    expect(remap(5, 0, 10, 100, 0)).toBe(50);
  });
});

describe('GCD and LCM', () => {
  it('should calculate GCD correctly', () => {
    expect(gcd(12, 8)).toBe(4);
    expect(gcd(100, 35)).toBe(5);
    expect(gcd(7, 13)).toBe(1);
  });

  it('should calculate LCM correctly', () => {
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(3, 5)).toBe(15);
    expect(lcm(7, 7)).toBe(7);
  });

  it('should handle edge cases', () => {
    expect(gcd(0, 5)).toBe(5);
    expect(gcd(5, 0)).toBe(5);
  });
});

describe('Rotations for Closure', () => {
  it('should calculate rotations needed for spirograph closure', () => {
    // R=100, r=33: needs 33/gcd(100,33) = 33/1 = 33 rotations
    expect(rotationsForClosure(100, 33)).toBe(33);

    // R=100, r=50: needs 50/gcd(100,50) = 50/50 = 1 rotation
    expect(rotationsForClosure(100, 50)).toBe(1);

    // R=100, r=25: needs 25/gcd(100,25) = 25/25 = 1 rotation
    expect(rotationsForClosure(100, 25)).toBe(1);

    // R=96, r=36: needs 36/gcd(96,36) = 36/12 = 3 rotations
    expect(rotationsForClosure(96, 36)).toBe(3);
  });
});

describe('Point Rotation', () => {
  it('should rotate point around origin', () => {
    const p = { x: 1, y: 0 };
    const rotated = rotatePoint(p, PI / 2);
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.y).toBeCloseTo(1);
  });

  it('should rotate point around custom center', () => {
    const p = { x: 2, y: 1 };
    const rotated = rotatePoint(p, PI, 1, 1);
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.y).toBeCloseTo(1);
  });

  it('should return same point for full rotation', () => {
    const p = { x: 3, y: 4 };
    const rotated = rotatePoint(p, TAU);
    expect(rotated.x).toBeCloseTo(3);
    expect(rotated.y).toBeCloseTo(4);
  });
});

describe('Distance', () => {
  it('should calculate distance between points', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });

  it('should handle negative coordinates', () => {
    expect(distance({ x: -3, y: -4 }, { x: 0, y: 0 })).toBe(5);
    expect(distance({ x: -1, y: -1 }, { x: 1, y: 1 })).toBeCloseTo(Math.sqrt(8));
  });

  it('should be symmetric', () => {
    const p1 = { x: 2, y: 3 };
    const p2 = { x: 5, y: 7 };
    expect(distance(p1, p2)).toBe(distance(p2, p1));
  });
});

// =============================================================================
// Additional Edge Case Tests
// =============================================================================

describe('Clamp Edge Cases', () => {
  it('should handle when min equals max', () => {
    expect(clamp(5, 10, 10)).toBe(10);
    expect(clamp(15, 10, 10)).toBe(10);
  });

  it('should handle floating point values', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(0.0001, 0, 1)).toBeCloseTo(0.0001);
  });

  it('should handle very large values', () => {
    expect(clamp(Number.MAX_VALUE, 0, 100)).toBe(100);
    expect(clamp(Number.MIN_VALUE, 0, 100)).toBeCloseTo(0);
  });

  it('should handle negative ranges', () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(-15, -10, -1)).toBe(-10);
    expect(clamp(0, -10, -1)).toBe(-1);
  });
});

describe('Lerp Edge Cases', () => {
  it('should handle equal start and end values', () => {
    expect(lerp(50, 50, 0.5)).toBe(50);
    expect(lerp(50, 50, 0)).toBe(50);
    expect(lerp(50, 50, 1)).toBe(50);
  });

  it('should handle very small t values', () => {
    expect(lerp(0, 100, 0.001)).toBeCloseTo(0.1);
  });

  it('should handle very large extrapolation', () => {
    expect(lerp(0, 1, 1000)).toBe(1000);
    expect(lerp(0, 1, -1000)).toBe(-1000);
  });
});

describe('Inverse Lerp Edge Cases', () => {
  it('should handle values outside range', () => {
    expect(inverseLerp(0, 100, 150)).toBe(1.5);
    expect(inverseLerp(0, 100, -50)).toBe(-0.5);
  });

  it('should handle negative ranges', () => {
    expect(inverseLerp(-100, 0, -50)).toBe(0.5);
  });

  it('should return Infinity when a equals b', () => {
    expect(inverseLerp(50, 50, 75)).toBe(Infinity);
  });
});

describe('Remap Edge Cases', () => {
  it('should handle values outside input range', () => {
    expect(remap(15, 0, 10, 0, 100)).toBe(150);
    expect(remap(-5, 0, 10, 0, 100)).toBe(-50);
  });

  it('should handle negative output ranges', () => {
    expect(remap(5, 0, 10, 0, -100)).toBe(-50);
  });

  it('should handle negative input ranges', () => {
    expect(remap(-5, -10, 0, 0, 100)).toBe(50);
  });
});

describe('GCD and LCM Edge Cases', () => {
  it('should handle negative numbers', () => {
    expect(gcd(-12, 8)).toBe(4);
    expect(gcd(12, -8)).toBe(4);
    expect(gcd(-12, -8)).toBe(4);
  });

  it('should handle equal numbers', () => {
    expect(gcd(5, 5)).toBe(5);
    expect(lcm(5, 5)).toBe(5);
  });

  it('should handle coprime numbers', () => {
    expect(gcd(17, 23)).toBe(1);
    expect(lcm(17, 23)).toBe(391);
  });

  it('should handle one being multiple of other', () => {
    expect(gcd(12, 4)).toBe(4);
    expect(gcd(4, 12)).toBe(4);
    expect(lcm(12, 4)).toBe(12);
  });

  it('should handle large numbers', () => {
    expect(gcd(1000000, 500000)).toBe(500000);
  });
});

describe('Rotations for Closure Edge Cases', () => {
  it('should handle equal R and r', () => {
    expect(rotationsForClosure(100, 100)).toBe(1);
  });

  it('should handle r being multiple of R', () => {
    expect(rotationsForClosure(50, 100)).toBe(2);
  });

  it('should handle prime numbers', () => {
    // For primes, gcd will be 1, so rotations = r
    expect(rotationsForClosure(97, 89)).toBe(89);
  });
});

describe('Point Rotation Edge Cases', () => {
  it('should handle zero angle', () => {
    const p = { x: 5, y: 3 };
    const rotated = rotatePoint(p, 0);
    expect(rotated.x).toBeCloseTo(5);
    expect(rotated.y).toBeCloseTo(3);
  });

  it('should handle negative angles', () => {
    const p = { x: 1, y: 0 };
    const rotated = rotatePoint(p, -PI / 2);
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.y).toBeCloseTo(-1);
  });

  it('should handle point at origin', () => {
    const p = { x: 0, y: 0 };
    const rotated = rotatePoint(p, PI / 4);
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.y).toBeCloseTo(0);
  });

  it('should handle half rotation', () => {
    const p = { x: 1, y: 2 };
    const rotated = rotatePoint(p, PI);
    expect(rotated.x).toBeCloseTo(-1);
    expect(rotated.y).toBeCloseTo(-2);
  });

  it('should handle quarter rotation with custom center', () => {
    const p = { x: 3, y: 0 };
    const rotated = rotatePoint(p, PI / 2, 2, 0);
    expect(rotated.x).toBeCloseTo(2);
    expect(rotated.y).toBeCloseTo(1);
  });

  it('should handle multiple full rotations', () => {
    const p = { x: 3, y: 4 };
    const rotated = rotatePoint(p, TAU * 5);
    expect(rotated.x).toBeCloseTo(3);
    expect(rotated.y).toBeCloseTo(4);
  });
});
