/**
 * Marketplace Patterns API Endpoint
 * @module /api/marketplace/patterns
 * @description Public endpoint for browsing marketplace patterns. Supports search,
 * filtering by license type, sorting, and pagination.
 *
 * @see {@link https://guilloche.studio/static/openapi.json OpenAPI Specification}
 *
 * @example
 * // Browse popular patterns
 * GET /api/marketplace/patterns?sort=popular&limit=24
 *
 * // Search for free patterns
 * GET /api/marketplace/patterns?q=spiral&license=free
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { validate } from '$lib/utils/validation';
import { getCacheHeaders } from '$lib/utils/cache';

// =============================================================================
// Response Helpers
// =============================================================================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ path: string; message: string }>;
  };
  meta?: {
    limit: number;
    offset: number;
  };
}

function successResponse<T>(data: T, meta?: { limit: number; offset: number }): Response {
  const response: ApiResponse<T> = { success: true, data, meta };
  return json(response, {
    status: 200,
    headers: getCacheHeaders('PATTERNS'),
  });
}

function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Array<{ path: string; message: string }>
): never {
  throw error(
    status,
    JSON.stringify({
      success: false,
      error: { code, message, details },
    })
  );
}

// =============================================================================
// Validation Schema
// =============================================================================

const MarketplaceQuerySchema = z.object({
  q: z.string().max(200).optional(),
  sort: z.enum(['popular', 'recent', 'price_low', 'price_high']).default('popular'),
  license: z.enum(['all', 'free', 'personal', 'commercial', 'remix']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

// =============================================================================
// GET /api/marketplace/patterns - List marketplace patterns
// =============================================================================

/**
 * List marketplace patterns
 * @name GET /api/marketplace/patterns
 * @function
 * @description Returns publicly listed patterns available for purchase. Supports
 * text search, license filtering, multiple sort options, and cursor-based pagination.
 * Results are cached for performance.
 *
 * @param {Object} context - SvelteKit request context
 * @param {URL} context.url - Request URL with query parameters
 * @param {App.Locals} context.locals - Request-scoped locals
 *
 * @queryParam {string} [q] - Search query for name/description (max 200 chars)
 * @queryParam {('popular'|'recent'|'price_low'|'price_high')} [sort=popular] - Sort order
 * @queryParam {('all'|'free'|'personal'|'commercial'|'remix')} [license=all] - License filter
 * @queryParam {number} [limit=24] - Results per page (1-100)
 * @queryParam {number} [offset=0] - Pagination offset
 *
 * @returns {Response} JSON response with patterns and pagination metadata
 * @returns {boolean} response.success - Operation success status
 * @returns {Object[]} response.data.patterns - Array of marketplace patterns
 * @returns {string} response.data.patterns[].id - Pattern UUID
 * @returns {string} response.data.patterns[].name - Pattern name
 * @returns {string} response.data.patterns[].description - Pattern description
 * @returns {string} response.data.patterns[].thumbnail_url - Thumbnail image URL
 * @returns {number} response.data.patterns[].price_cents - Price in cents (0 = free)
 * @returns {string} response.data.patterns[].license_type - License type
 * @returns {number} response.data.patterns[].view_count - View count
 * @returns {number} response.data.patterns[].download_count - Download count
 * @returns {Object} response.data.patterns[].creator - Creator info
 * @returns {Object} response.meta - Pagination metadata
 * @returns {number} response.meta.limit - Current limit
 * @returns {number} response.meta.offset - Current offset
 *
 * @throws {400} VALIDATION_ERROR - Invalid query parameters
 * @throws {500} DATABASE_ERROR - Failed to fetch patterns
 * @throws {500} INTERNAL_ERROR - Unexpected error
 *
 * @example
 * // Request
 * GET /api/marketplace/patterns?q=spiral&sort=recent&limit=10
 *
 * // Response
 * {
 *   "success": true,
 *   "data": {
 *     "patterns": [
 *       {
 *         "id": "...",
 *         "name": "Golden Spiral",
 *         "price_cents": 499,
 *         "creator": { "username": "artist123" }
 *       }
 *     ]
 *   },
 *   "meta": { "limit": 10, "offset": 0 }
 * }
 */
export const GET: RequestHandler = async ({ url, locals }) => {
  // Extract and validate query parameters
  const queryParams = {
    q: url.searchParams.get('q') || undefined,
    sort: url.searchParams.get('sort') || undefined,
    license: url.searchParams.get('license') || undefined,
    limit: url.searchParams.get('limit') || undefined,
    offset: url.searchParams.get('offset') || undefined,
  };

  const validation = validate(MarketplaceQuerySchema, queryParams);
  if (!validation.success) {
    errorResponse('VALIDATION_ERROR', 'Invalid query parameters', 400, validation.errors);
  }

  const validatedData = validation.data!;
  const searchQuery = validatedData.q;
  const sortBy = validatedData.sort ?? 'popular';
  const license = validatedData.license ?? 'all';
  const limit: number = validatedData.limit ?? 24;
  const offset: number = validatedData.offset ?? 0;

  try {
    let query = locals.supabase
      .from('patterns')
      .select(
        `
        id,
        name,
        description,
        thumbnail_url,
        price_cents,
        license_type,
        view_count,
        download_count,
        created_at,
        profiles!inner (
          username,
          display_name
        )
      `
      )
      .eq('is_listed', true)
      .eq('is_public', true);

    // Apply search filter with proper escaping
    if (searchQuery) {
      // Escape special characters for ILIKE pattern matching
      const sanitizedQuery = searchQuery.replace(/[%_\\]/g, '\\$&').slice(0, 100);
      query = query.or(`name.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%`);
    }

    // Apply license filter
    if (license !== 'all') {
      if (license === 'free') {
        query = query.eq('price_cents', 0);
      } else {
        query = query.eq('license_type', license);
      }
    }

    // Apply sorting
    switch (sortBy) {
      case 'recent':
        query = query.order('created_at', { ascending: false });
        break;
      case 'price_low':
        query = query.order('price_cents', { ascending: true });
        break;
      case 'price_high':
        query = query.order('price_cents', { ascending: false });
        break;
      case 'popular':
      default:
        query = query.order('download_count', { ascending: false });
        break;
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: patterns, error: fetchError } = await query;

    if (fetchError) {
      console.error('Marketplace fetch error:', fetchError);
      errorResponse('DATABASE_ERROR', 'Failed to fetch patterns', 500);
    }

    // Transform the data to flatten the creator info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformed = (patterns || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      thumbnail_url: p.thumbnail_url,
      price_cents: p.price_cents,
      license_type: p.license_type,
      view_count: p.view_count,
      download_count: p.download_count,
      created_at: p.created_at,
      creator: {
        username: p.profiles?.username || 'anonymous',
        display_name: p.profiles?.display_name || null,
      },
    }));

    return successResponse({ patterns: transformed }, { limit, offset });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Marketplace patterns error:', err);
    errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
};
