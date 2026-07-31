import DOMPurify from 'dompurify';
import { browser } from '$app/environment';

/**
 * Sanitize untrusted SVG markup before it reaches an `{@html}` block.
 *
 * DOMPurify needs a real DOM, so on the server this returns an empty string
 * rather than pulling jsdom into the client bundle. Every caller is an
 * interactive preview panel, so there is nothing meaningful to render during SSR.
 */
export function sanitizeSvg(svg: string): string {
  if (!svg || !browser) return '';

  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Blocks <foreignObject>, which can smuggle arbitrary HTML past the SVG profile.
    FORBID_TAGS: ['foreignObject', 'script', 'iframe', 'object', 'embed'],
  });
}
