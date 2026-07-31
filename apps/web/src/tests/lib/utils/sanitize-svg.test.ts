import { describe, it, expect } from 'vitest';
import { sanitizeSvg } from '$lib/utils/sanitize-svg';

describe('sanitizeSvg', () => {
  it('returns an empty string for empty input', () => {
    expect(sanitizeSvg('')).toBe('');
  });

  it('preserves ordinary SVG drawing markup', () => {
    const out = sanitizeSvg(
      '<svg viewBox="0 0 10 10"><path d="M0 0 L10 10" stroke="#f00" fill="none"/></svg>'
    );
    expect(out).toContain('<path');
    expect(out).toContain('d="M0 0 L10 10"');
    expect(out).toContain('stroke="#f00"');
  });

  it('strips script elements', () => {
    const out = sanitizeSvg('<svg><script>alert(1)</script><circle r="5"/></svg>');
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('<circle');
  });

  it('strips event handler attributes', () => {
    const out = sanitizeSvg('<svg><circle r="5" onload="alert(1)" onclick="alert(2)"/></svg>');
    expect(out).not.toMatch(/onload/i);
    expect(out).not.toMatch(/onclick/i);
    expect(out).toContain('<circle');
  });

  it('strips foreignObject, which can smuggle arbitrary HTML', () => {
    const out = sanitizeSvg(
      '<svg><foreignObject><body><img src=x onerror="alert(1)"></body></foreignObject></svg>'
    );
    expect(out).not.toMatch(/foreignobject/i);
    expect(out).not.toMatch(/onerror/i);
  });

  // The previous regex sanitizer only matched the literal string "javascript:",
  // so entity-encoded and whitespace-split variants slipped straight through.
  it.each([
    ['literal', '<svg><a href="javascript:alert(1)"><text>x</text></a></svg>'],
    ['entity-encoded', '<svg><a href="&#106;avascript:alert(1)"><text>x</text></a></svg>'],
    ['whitespace-split', '<svg><a href="java\tscript:alert(1)"><text>x</text></a></svg>'],
    ['case-mixed', '<svg><a href="JaVaScRiPt:alert(1)"><text>x</text></a></svg>'],
  ])('neutralises %s javascript: URLs', (_label, input) => {
    expect(sanitizeSvg(input).toLowerCase()).not.toContain('javascript:');
  });

  it('strips nested-tag obfuscation that defeats naive string removal', () => {
    const out = sanitizeSvg('<svg><scr<script>ipt>alert(1)</script></svg>');
    // Any leftover payload survives only as escaped text, never as a live element.
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toContain('<scr');
    expect(out).not.toContain('ipt>alert');
  });

  it('strips iframe, object and embed elements', () => {
    const out = sanitizeSvg(
      '<svg><iframe src="evil"></iframe><object data="evil"></object><embed src="evil"></svg>'
    );
    expect(out).not.toMatch(/<iframe/i);
    expect(out).not.toMatch(/<object/i);
    expect(out).not.toMatch(/<embed/i);
  });
});
