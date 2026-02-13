/**
 * DNA Page Server Load
 *
 * SSR endpoint for DNA share pages. Provides:
 * - OG/Twitter meta tags for social sharing
 * - Pattern data for rendering
 * - QR code and embed snippets
 * - Rate limiting at edge
 */

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { PatternDNA } from '@guilloche/core';

export const load: PageServerLoad = async ({ params, locals, setHeaders, getClientAddress }) => {
  const { code } = params;

  // Validate DNA code format
  if (!code || !/^[A-Za-z0-9]{8}$/.test(code)) {
    throw error(400, {
      message: 'Invalid DNA code format',
      code: 'INVALID_DNA_FORMAT',
    });
  }

  // Set cache headers for edge caching (Cloudflare)
  setHeaders({
    'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    'CDN-Cache-Control': 'max-age=86400',
  });

  // Try database lookup first (versioned DNA)
  const { data: dnaResult } = await locals.supabase.rpc('resolve_dna', {
    p_dna_code: code,
  });

  const record = dnaResult?.[0];

  if (record) {
    // Found in database - record view
    if (record.pattern_id) {
      const clientIp = getClientAddress();
      const viewerHash = await hashViewerIdentity(clientIp);

      // Non-blocking view recording
      locals.supabase
        .rpc('record_pattern_view', {
          p_pattern_id: record.pattern_id,
          p_viewer_hash: viewerHash,
          p_referrer: null,
          p_device_type: null,
        })
        .then(
          () => {
            // View recorded successfully
          },
          () => {
            // Ignore view recording errors
          }
        );
    }

    const baseUrl = 'https://guilloche.studio';
    const shareUrl = `${baseUrl}/dna/${code}`;
    const thumbnailUrl = record.thumbnail_url || `${baseUrl}/api/og/pattern/${code}`;

    return {
      code,
      found: true,
      pattern: {
        id: record.pattern_id,
        name: record.pattern_name || 'Shared Pattern',
        thumbnailUrl,
        params: record.parameters,
      },
      creator: record.creator_id
        ? {
            id: record.creator_id,
            displayName: record.creator_name,
          }
        : null,
      meta: {
        title: `${record.pattern_name || 'Pattern'} | Guilloché Studio`,
        description: `View and remix this geometric pattern. Created with Guilloché Studio.`,
        image: thumbnailUrl,
        url: shareUrl,
      },
      shareUrl,
      embedCode: generateEmbedCode(code),
    };
  }

  // Try direct DNA decoding (stateless sharing)
  try {
    const params = PatternDNA.decode(code);

    if (params) {
      const baseUrl = 'https://guilloche.studio';
      const shareUrl = `${baseUrl}/dna/${code}`;

      return {
        code,
        found: true,
        pattern: {
          id: null,
          name: 'Shared Pattern',
          thumbnailUrl: `${baseUrl}/api/og/pattern/${code}`,
          params,
        },
        creator: null,
        meta: {
          title: 'Shared Pattern | Guilloché Studio',
          description: 'View and remix this geometric pattern. Created with Guilloché Studio.',
          image: `${baseUrl}/api/og/pattern/${code}`,
          url: shareUrl,
        },
        shareUrl,
        embedCode: generateEmbedCode(code),
      };
    }
  } catch {
    // Invalid DNA - fall through to error
  }

  // Not found
  return {
    code,
    found: false,
    pattern: null,
    creator: null,
    meta: {
      title: 'Pattern Not Found | Guilloché Studio',
      description:
        'This pattern could not be found. It may have been deleted or the link is invalid.',
      image: 'https://guilloche.studio/og-default.png',
      url: `https://guilloche.studio/dna/${code}`,
    },
    shareUrl: null,
    embedCode: null,
  };
};

/**
 * Hash viewer identity for deduplication
 */
async function hashViewerIdentity(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + new Date().toISOString().slice(0, 10)); // IP + date for daily uniqueness
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

/**
 * Generate iframe embed code
 */
function generateEmbedCode(code: string): string {
  return `<iframe
  src="https://guilloche.studio/embed/${code}"
  width="400"
  height="400"
  frameborder="0"
  allowfullscreen
  title="Guilloché Pattern"
></iframe>`;
}
