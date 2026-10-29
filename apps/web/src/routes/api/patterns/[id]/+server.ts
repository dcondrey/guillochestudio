/**
 * Single Pattern API Endpoint
 * @module /api/patterns/[id]
 * @description Handles retrieval, update, and deletion of individual patterns.
 * Supports both owner access (full CRUD) and public access (read-only for public patterns).
 *
 * @see {@link https://guilloche.studio/static/openapi.json OpenAPI Specification}
 * @see {@link UpdatePatternSchema} Zod validator for pattern updates
 *
 * @example
 * // Get a pattern
 * GET /api/patterns/123e4567-e89b-12d3-a456-426614174000
 *
 * // Update a pattern
 * PATCH /api/patterns/123e4567-e89b-12d3-a456-426614174000
 * { "name": "Updated Name" }
 *
 * // Delete a pattern
 * DELETE /api/patterns/123e4567-e89b-12d3-a456-426614174000
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createHash } from 'node:crypto';
import { UpdatePatternSchema, validate } from '$lib/utils/validation';
import { getCacheHeaders } from '$lib/utils/cache';
import { z } from 'zod';
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

function successResponse<T>(
  data: T,
  status = 200,
  cacheType?: 'USER_DATA' | 'PATTERNS' | 'API'
): Response {
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
// Validation Schemas
// =============================================================================

const PatternIdSchema = z.string().uuid('Invalid pattern ID format');

// =============================================================================
// GET /api/patterns/[id] - Get a specific pattern
// =============================================================================

/**
 * Get a specific pattern
 * @name GET /api/patterns/:id
 * @function
 * @description Retrieves a pattern by its UUID. Public patterns can be accessed by
 * anyone; private patterns require ownership. Uses appropriate cache headers based
 * on ownership status.
 *
 * @param {Object} context - SvelteKit request context
 * @param {Object} context.params - Route parameters
 * @param {string} context.params.id - Pattern UUID
 * @param {App.Locals} context.locals - Request-scoped locals with session data
 *
 * @returns {Response} JSON response with pattern data
 * @returns {boolean} response.success - Operation success status
 * @returns {Object} response.data.pattern - Pattern object with all properties
 *
 * @throws {400} INVALID_ID - Pattern ID is not a valid UUID
 * @throws {403} FORBIDDEN - Pattern is private and user is not the owner
 * @throws {404} NOT_FOUND - Pattern does not exist
 * @throws {500} INTERNAL_ERROR - Unexpected error
 *
 * @example
 * // Request
 * GET /api/patterns/123e4567-e89b-12d3-a456-426614174000
 *
 * // Response
 * {
 *   "success": true,
 *   "data": {
 *     "pattern": {
 *       "id": "123e4567-e89b-12d3-a456-426614174000",
 *       "name": "Golden Spiral",
 *       "parameters": { "family": "spirograph", ... }
 *     }
 *   }
 * }
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  const { user } = await locals.safeGetSession();
  const { id } = params;

  // Validate pattern ID format
  const idValidation = PatternIdSchema.safeParse(id);
  if (!idValidation.success) {
    errorResponse('INVALID_ID', 'Invalid pattern ID format', 400);
  }

  try {
    const { data: pattern, error: fetchError } = await locals.supabase
      .from('patterns')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !pattern) {
      errorResponse('NOT_FOUND', 'Pattern not found', 404);
    }

    // Check access - must be owner or pattern must be public
    const isOwner = pattern.user_id === user?.id;
    if (!isOwner && !pattern.is_public) {
      errorResponse('FORBIDDEN', 'You do not have permission to view this pattern', 403);
    }

    // Use public cache for public patterns, private cache for owned patterns
    const cacheType = isOwner ? 'USER_DATA' : 'PATTERNS';
    return successResponse({ pattern }, 200, cacheType);
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Pattern GET error:', err);
    errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
};

// =============================================================================
// PATCH /api/patterns/[id] - Update a pattern
// =============================================================================

/**
 * Update a pattern
 * @name PATCH /api/patterns/:id
 * @function
 * @description Updates an existing pattern. Only the pattern owner can update it.
 * All fields are optional; only provided fields will be updated. Parameter hash
 * is automatically recalculated when parameters change.
 *
 * @requires Authentication - Supabase session token in cookie
 *
 * @param {Object} context - SvelteKit request context
 * @param {Object} context.params - Route parameters
 * @param {string} context.params.id - Pattern UUID
 * @param {Request} context.request - HTTP request with JSON body
 * @param {App.Locals} context.locals - Request-scoped locals with session data
 *
 * @requestBody {Object} body - Pattern update fields (all optional)
 * @requestBody {string} [body.name] - New pattern name (1-100 chars)
 * @requestBody {string} [body.description] - New description (max 1000 chars)
 * @requestBody {Object} [body.parameters] - New render parameters
 * @requestBody {boolean} [body.isPublic] - Update public visibility
 * @requestBody {boolean} [body.isListed] - Update marketplace listing
 * @requestBody {string[]} [body.tags] - Update pattern tags
 *
 * @returns {Response} JSON response with updated pattern
 * @returns {boolean} response.success - Operation success status
 * @returns {Object} response.data.pattern - Updated pattern object
 *
 * @throws {400} INVALID_ID - Pattern ID is not a valid UUID
 * @throws {400} INVALID_JSON - Request body is not valid JSON
 * @throws {400} VALIDATION_ERROR - Input validation failed
 * @throws {401} UNAUTHORIZED - Authentication required
 * @throws {403} FORBIDDEN - User does not own this pattern
 * @throws {404} NOT_FOUND - Pattern does not exist
 * @throws {500} DATABASE_ERROR - Failed to update pattern
 * @throws {500} INTERNAL_ERROR - Unexpected error
 *
 * @see {@link UpdatePatternSchema} Zod schema for validation rules
 */
export const PATCH: RequestHandler = async (event) => {
  const { params, request, locals } = event;

  // Security check - authentication required
  const security = new SecurityMiddleware(locals.supabase);
  const securityResult = await security.check(event, {
    feature: 'pattern.save',
  });

  if (!securityResult.allowed) {
    return createSecurityErrorResponse(securityResult);
  }

  const userId = securityResult.context!.userId;
  const { id } = params;

  // Validate pattern ID format
  const idValidation = PatternIdSchema.safeParse(id);
  if (!idValidation.success) {
    errorResponse('INVALID_ID', 'Invalid pattern ID format', 400);
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    errorResponse('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  // Validate input using Zod schema (partial update)
  const validation = validate(UpdatePatternSchema.partial().omit({ id: true }), body);
  if (!validation.success) {
    errorResponse('VALIDATION_ERROR', 'Invalid input data', 400, validation.errors);
  }

  try {
    // Verify ownership
    const { data: existing } = await locals.supabase
      .from('patterns')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing) {
      errorResponse('NOT_FOUND', 'Pattern not found', 404);
    }

    if (existing.user_id !== userId) {
      errorResponse('FORBIDDEN', 'You do not have permission to modify this pattern', 403);
    }

    // Build update object with validated fields
    const { name, description, parameters, isPublic, isListed, tags } = validation.data!;
    const updates: Record<string, unknown> = {};

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description || null;
    if (parameters !== undefined) {
      updates.parameters = parameters;
      // Update parameter hash when parameters change
      updates.parameter_hash = createHash('sha256')
        .update(JSON.stringify(parameters))
        .digest('hex')
        .substring(0, 16);
    }
    if (isPublic !== undefined) updates.is_public = isPublic;
    if (isListed !== undefined) updates.is_listed = isListed;
    if (tags !== undefined) updates.tags = tags;

    updates.updated_at = new Date().toISOString();

    const { data: pattern, error: updateError } = await locals.supabase
      .from('patterns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Pattern update error:', updateError);
      errorResponse('DATABASE_ERROR', 'Failed to update pattern', 500);
    }

    return successResponse({ pattern }, 200);
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Pattern PATCH error:', err);
    errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
};

// =============================================================================
// DELETE /api/patterns/[id] - Delete a pattern
// =============================================================================

/**
 * Delete a pattern
 * @name DELETE /api/patterns/:id
 * @function
 * @description Permanently deletes a pattern. Only the pattern owner can delete it.
 * This action cannot be undone.
 *
 * @requires Authentication - Supabase session token in cookie
 *
 * @param {Object} context - SvelteKit request context
 * @param {Object} context.params - Route parameters
 * @param {string} context.params.id - Pattern UUID to delete
 * @param {App.Locals} context.locals - Request-scoped locals with session data
 *
 * @returns {Response} JSON response confirming deletion
 * @returns {boolean} response.success - Operation success status
 * @returns {boolean} response.data.deleted - Always true on success
 * @returns {string} response.data.id - ID of deleted pattern
 *
 * @throws {400} INVALID_ID - Pattern ID is not a valid UUID
 * @throws {401} UNAUTHORIZED - Authentication required
 * @throws {403} FORBIDDEN - User does not own this pattern
 * @throws {404} NOT_FOUND - Pattern does not exist
 * @throws {500} DATABASE_ERROR - Failed to delete pattern
 * @throws {500} INTERNAL_ERROR - Unexpected error
 *
 * @example
 * // Response
 * {
 *   "success": true,
 *   "data": {
 *     "deleted": true,
 *     "id": "123e4567-e89b-12d3-a456-426614174000"
 *   }
 * }
 */
export const DELETE: RequestHandler = async (event) => {
  const { params, locals } = event;

  // Security check - authentication required
  const security = new SecurityMiddleware(locals.supabase);
  const securityResult = await security.check(event, {
    feature: 'pattern.save',
  });

  if (!securityResult.allowed) {
    return createSecurityErrorResponse(securityResult);
  }

  const userId = securityResult.context!.userId;
  const { id } = params;

  // Validate pattern ID format
  const idValidation = PatternIdSchema.safeParse(id);
  if (!idValidation.success) {
    errorResponse('INVALID_ID', 'Invalid pattern ID format', 400);
  }

  try {
    // Verify ownership
    const { data: existing } = await locals.supabase
      .from('patterns')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing) {
      errorResponse('NOT_FOUND', 'Pattern not found', 404);
    }

    if (existing.user_id !== userId) {
      errorResponse('FORBIDDEN', 'You do not have permission to delete this pattern', 403);
    }

    const { error: deleteError } = await locals.supabase.from('patterns').delete().eq('id', id);

    if (deleteError) {
      console.error('Pattern delete error:', deleteError);
      errorResponse('DATABASE_ERROR', 'Failed to delete pattern', 500);
    }

    return successResponse({ deleted: true, id }, 200);
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Pattern DELETE error:', err);
    errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
};
