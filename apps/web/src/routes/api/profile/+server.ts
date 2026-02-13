/**
 * Profile API Endpoint
 * @module /api/profile
 * @description Handles user profile retrieval and updates. All endpoints require authentication.
 *
 * @see {@link https://guilloche.studio/static/openapi.json OpenAPI Specification}
 * @see {@link ProfileUpdateSchema} Zod validator for profile updates
 *
 * @example
 * // Get current user's profile
 * GET /api/profile
 *
 * // Update profile
 * PATCH /api/profile
 * { "username": "newname", "bio": "Updated bio" }
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ProfileUpdateSchema, validate } from '$lib/utils/validation';
import { getCacheHeaders } from '$lib/utils/cache';
import { SecurityMiddleware, createSecurityErrorResponse } from '$lib/services/security-middleware';

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
// GET /api/profile - Retrieve current user's profile
// =============================================================================

/**
 * Retrieve current user's profile
 * @name GET /api/profile
 * @function
 * @description Retrieves the authenticated user's profile information including
 * username, display name, bio, website, and subscription tier.
 *
 * @requires Authentication - Supabase session token in cookie
 *
 * @param {Object} context - SvelteKit request context
 * @param {App.Locals} context.locals - Request-scoped locals with session data
 *
 * @returns {Response} JSON response with profile data
 * @returns {boolean} response.success - Operation success status
 * @returns {Object} response.data.profile - User profile object
 * @returns {string} response.data.profile.id - User UUID
 * @returns {string} response.data.profile.username - Unique username
 * @returns {string} response.data.profile.display_name - Display name
 * @returns {string} response.data.profile.bio - User biography
 * @returns {string} response.data.profile.website - Personal website URL
 * @returns {('free'|'pro'|'enterprise')} response.data.profile.subscription_tier - Subscription tier
 *
 * @throws {401} UNAUTHORIZED - Authentication required
 * @throws {404} NOT_FOUND - Profile not found
 * @throws {500} DATABASE_ERROR - Failed to fetch profile
 * @throws {500} INTERNAL_ERROR - Unexpected error
 *
 * @example
 * // Response
 * {
 *   "success": true,
 *   "data": {
 *     "profile": {
 *       "id": "123e4567-e89b-12d3-a456-426614174000",
 *       "username": "artist123",
 *       "display_name": "Pattern Artist",
 *       "subscription_tier": "pro"
 *     }
 *   }
 * }
 */
export const GET: RequestHandler = async (event) => {
  const { locals } = event;

  // Security check - authentication required
  const security = new SecurityMiddleware(locals.supabase);
  const securityResult = await security.check(event, {});

  if (!securityResult.allowed) {
    return createSecurityErrorResponse(securityResult);
  }

  const userId = securityResult.context!.userId;

  try {
    const { data: profile, error: fetchError } = await locals.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Profile fetch error:', fetchError);
      errorResponse('DATABASE_ERROR', 'Failed to fetch profile', 500);
    }

    if (!profile) {
      errorResponse('NOT_FOUND', 'Profile not found', 404);
    }

    return successResponse({ profile }, 200, 'USER_DATA');
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Profile GET error:', err);
    errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
};

// =============================================================================
// PATCH /api/profile - Update current user's profile
// =============================================================================

/**
 * Update current user's profile
 * @name PATCH /api/profile
 * @function
 * @description Updates the authenticated user's profile. All fields are optional;
 * only provided fields will be updated. Validates against ProfileUpdateSchema.
 *
 * @requires Authentication - Supabase session token in cookie
 *
 * @param {Object} context - SvelteKit request context
 * @param {Request} context.request - HTTP request with JSON body
 * @param {App.Locals} context.locals - Request-scoped locals with session data
 *
 * @requestBody {Object} body - Profile update fields (all optional)
 * @requestBody {string} [body.username] - New username (3-30 chars, alphanumeric with _ and -)
 * @requestBody {string} [body.displayName] - New display name (1-100 chars)
 * @requestBody {string} [body.bio] - New biography (max 500 chars)
 * @requestBody {string} [body.website] - New website URL (valid URL or empty string)
 *
 * @returns {Response} JSON response with updated profile
 * @returns {boolean} response.success - Operation success status
 * @returns {Object} response.data.profile - Updated profile object
 *
 * @throws {400} INVALID_JSON - Request body is not valid JSON
 * @throws {400} VALIDATION_ERROR - Input validation failed (with field details)
 * @throws {401} UNAUTHORIZED - Authentication required
 * @throws {409} USERNAME_TAKEN - Requested username is already in use
 * @throws {500} DATABASE_ERROR - Failed to update profile
 * @throws {500} INTERNAL_ERROR - Unexpected error
 *
 * @see {@link ProfileUpdateSchema} Zod schema for validation rules
 *
 * @example
 * // Request
 * PATCH /api/profile
 * { "username": "newname", "bio": "Updated bio" }
 *
 * // Response
 * {
 *   "success": true,
 *   "data": {
 *     "profile": { "id": "...", "username": "newname", "bio": "Updated bio" }
 *   }
 * }
 */
export const PATCH: RequestHandler = async (event) => {
  const { request, locals } = event;

  // Security check - authentication required
  const security = new SecurityMiddleware(locals.supabase);
  const securityResult = await security.check(event, {});

  if (!securityResult.allowed) {
    return createSecurityErrorResponse(securityResult);
  }

  const userId = securityResult.context!.userId;

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    errorResponse('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  // Validate input using Zod schema
  const validation = validate(ProfileUpdateSchema, body);
  if (!validation.success) {
    errorResponse('VALIDATION_ERROR', 'Invalid input data', 400, validation.errors);
  }

  const { username, displayName, bio, website } = validation.data!;

  try {
    // Check if username is taken (if being updated)
    if (username) {
      const { data: existing } = await locals.supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('id', userId)
        .single();

      if (existing) {
        errorResponse('USERNAME_TAKEN', 'Username is already taken', 409);
      }
    }

    // Build update object with only provided fields
    const updates: Record<string, string | null> = {};
    if (username !== undefined) updates.username = username || null;
    if (displayName !== undefined) updates.display_name = displayName || null;
    if (bio !== undefined) updates.bio = bio || null;
    if (website !== undefined) updates.website = website || null;

    // Update profile
    const { data, error: updateError } = await locals.supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Profile update error:', updateError);
      errorResponse('DATABASE_ERROR', 'Failed to update profile', 500);
    }

    return successResponse({ profile: data }, 200);
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Profile PATCH error:', err);
    errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
};
