/**
 * Patterns API Endpoint
 * @module /api/patterns
 * @description Handles pattern listing and creation for authenticated users.
 * Patterns are mathematical guilloche designs with configurable parameters.
 *
 * @see {@link https://guilloche.studio/static/openapi.json OpenAPI Specification}
 * @see {@link CreatePatternSchema} Zod validator for pattern creation
 * @see {@link PatternParamsSchema} Zod validator for pattern parameters
 *
 * @example
 * // List user's patterns
 * GET /api/patterns
 *
 * // Create new pattern
 * POST /api/patterns
 * { "name": "My Pattern", "parameters": { "family": "spirograph", ... } }
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createHash } from 'crypto';
import { CreatePatternSchema, validate } from '$lib/utils/validation';
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
}

function successResponse<T>(data: T, status = 200, cacheType?: 'USER_DATA' | 'API'): Response {
  const response: ApiResponse<T> = { success: true, data };
  return json(response, {
    status,
    headers: cacheType ? getCacheHeaders(cacheType) : undefined,
  });
}

function errorResponse(code: string, message: string, status: number, details?: Array<{ path: string; message: string }>): never {
  throw error(status, JSON.stringify({
    success: false,
    error: { code, message, details },
  }));
}

// =============================================================================
// Constants
// =============================================================================

const PATTERN_LIMITS: Record<string, number> = {
  free: 3,
  pro: 100,
  enterprise: Infinity,
};

// =============================================================================
// GET /api/patterns - List user's patterns
// =============================================================================

/**
 * List user's patterns
 * @name GET /api/patterns
 * @function
 * @description Returns all patterns owned by the authenticated user,
 * sorted by last updated date (most recent first).
 *
 * @requires Authentication - Supabase session token in cookie
 *
 * @param {Object} context - SvelteKit request context
 * @param {App.Locals} context.locals - Request-scoped locals with session data
 *
 * @returns {Response} JSON response with patterns array
 * @returns {boolean} response.success - Operation success status
 * @returns {Object[]} response.data.patterns - Array of pattern objects
 * @returns {string} response.data.patterns[].id - Pattern UUID
 * @returns {string} response.data.patterns[].name - Pattern name
 * @returns {string} response.data.patterns[].description - Pattern description
 * @returns {Object} response.data.patterns[].parameters - Pattern render parameters
 * @returns {boolean} response.data.patterns[].is_public - Public visibility flag
 * @returns {boolean} response.data.patterns[].is_listed - Marketplace listing flag
 * @returns {string[]} response.data.patterns[].tags - Pattern tags
 * @returns {string} response.data.patterns[].created_at - ISO 8601 creation timestamp
 * @returns {string} response.data.patterns[].updated_at - ISO 8601 update timestamp
 *
 * @throws {401} UNAUTHORIZED - Authentication required
 * @throws {500} DATABASE_ERROR - Failed to fetch patterns
 * @throws {500} INTERNAL_ERROR - Unexpected error
 *
 * @example
 * // Response
 * {
 *   "success": true,
 *   "data": {
 *     "patterns": [
 *       { "id": "...", "name": "Golden Spiral", "parameters": { ... } }
 *     ]
 *   }
 * }
 */
export const GET: RequestHandler = async ({ locals }) => {
  const { session, user } = await locals.safeGetSession();

  if (!session || !user) {
    errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  }

  try {
    const { data: patterns, error: fetchError } = await locals.supabase
      .from('patterns')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (fetchError) {
      console.error('Patterns fetch error:', fetchError);
      errorResponse('DATABASE_ERROR', 'Failed to fetch patterns', 500);
    }

    return successResponse({ patterns: patterns || [] }, 200, 'USER_DATA');
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Patterns GET error:', err);
    errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
};

// =============================================================================
// POST /api/patterns - Create a new pattern
// =============================================================================

/**
 * Create a new pattern
 * @name POST /api/patterns
 * @function
 * @description Creates a new pattern with the specified parameters. Pattern limits
 * apply based on subscription tier: Free (3), Pro (100), Enterprise (unlimited).
 * Duplicate patterns (same parameters) are detected via SHA-256 hash.
 *
 * @requires Authentication - Supabase session token in cookie
 *
 * @param {Object} context - SvelteKit request context
 * @param {Request} context.request - HTTP request with JSON body
 * @param {App.Locals} context.locals - Request-scoped locals with session data
 *
 * @requestBody {Object} body - Pattern creation data
 * @requestBody {string} body.name - Pattern name (1-100 chars, required)
 * @requestBody {string} [body.description] - Pattern description (max 1000 chars)
 * @requestBody {Object} body.parameters - Pattern render parameters (required)
 * @requestBody {string} body.parameters.family - Curve family type
 * @requestBody {number} body.parameters.R - Outer radius (10-500)
 * @requestBody {number} body.parameters.r - Inner radius (5-400)
 * @requestBody {number} body.parameters.d - Distance parameter (0-400)
 * @requestBody {boolean} [body.isPublic=false] - Make pattern publicly viewable
 * @requestBody {boolean} [body.isListed=false] - List on marketplace
 * @requestBody {string[]} [body.tags] - Pattern tags (max 10, each max 50 chars)
 *
 * @returns {Response} JSON response with created pattern
 * @returns {boolean} response.success - Operation success status
 * @returns {Object} response.data.pattern - Created pattern object
 *
 * @throws {400} INVALID_JSON - Request body is not valid JSON
 * @throws {400} VALIDATION_ERROR - Input validation failed (with field details)
 * @throws {401} UNAUTHORIZED - Authentication required
 * @throws {403} LIMIT_EXCEEDED - Pattern limit reached for subscription tier
 * @throws {409} DUPLICATE_PATTERN - Pattern with identical parameters exists
 * @throws {500} DATABASE_ERROR - Failed to save pattern
 * @throws {500} INTERNAL_ERROR - Unexpected error
 *
 * @see {@link CreatePatternSchema} Zod schema for validation rules
 * @see {@link PatternParamsSchema} Zod schema for parameter validation
 *
 * @example
 * // Request
 * POST /api/patterns
 * {
 *   "name": "Golden Spiral",
 *   "parameters": { "family": "spirograph", "R": 200, "r": 80 },
 *   "isPublic": true
 * }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  const { session, user } = await locals.safeGetSession();

  if (!session || !user) {
    errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    errorResponse('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  // Validate input using Zod schema
  const validation = validate(CreatePatternSchema, body);
  if (!validation.success) {
    errorResponse('VALIDATION_ERROR', 'Invalid input data', 400, validation.errors);
  }

  const { name, description, parameters, isPublic, isListed, tags } = validation.data!;

  try {
    // Check pattern limit based on subscription tier
    const { data: profile } = await locals.supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    const tier = profile?.subscription_tier || 'free';
    const limit = PATTERN_LIMITS[tier] ?? PATTERN_LIMITS.free;

    const { count } = await locals.supabase
      .from('patterns')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if ((count || 0) >= limit) {
      errorResponse(
        'LIMIT_EXCEEDED',
        `Pattern limit reached (${limit} patterns). Upgrade your plan to save more patterns.`,
        403
      );
    }

    // Create parameter hash for duplicate detection
    const parameterHash = createHash('sha256')
      .update(JSON.stringify(parameters))
      .digest('hex')
      .substring(0, 16);

    const { data: pattern, error: insertError } = await locals.supabase
      .from('patterns')
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        parameters,
        parameter_hash: parameterHash,
        is_public: isPublic || false,
        is_listed: isListed || false,
        tags: tags || [],
      })
      .select()
      .single();

    if (insertError) {
      console.error('Pattern insert error:', insertError);

      // Check for duplicate constraint violation
      if (insertError.code === '23505') {
        errorResponse('DUPLICATE_PATTERN', 'A pattern with identical parameters already exists', 409);
      }

      errorResponse('DATABASE_ERROR', 'Failed to save pattern', 500);
    }

    return successResponse({ pattern }, 201);
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Pattern POST error:', err);
    errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
};
