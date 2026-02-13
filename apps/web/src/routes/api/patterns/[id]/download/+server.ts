/**
 * Pattern Download API Endpoint
 * @module /api/patterns/[id]/download
 * @description Handles downloading pattern data for owned or purchased patterns.
 * Returns pattern as a downloadable JSON file with metadata.
 *
 * @see {@link https://guilloche.studio/static/openapi.json OpenAPI Specification}
 *
 * @example
 * // Download a pattern (triggers file download)
 * GET /api/patterns/123e4567-e89b-12d3-a456-426614174000/download
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import {
  SecurityMiddleware,
  createSecurityErrorResponse,
} from '$lib/services/security-middleware';

// =============================================================================
// Response Helpers
// =============================================================================

function errorResponse(code: string, message: string, status: number): never {
  throw error(status, JSON.stringify({
    success: false,
    error: { code, message },
  }));
}

// =============================================================================
// Validation
// =============================================================================

const PatternIdSchema = z.string().uuid('Invalid pattern ID format');

// =============================================================================
// GET /api/patterns/[id]/download - Download pattern data
// =============================================================================

/**
 * Download pattern data
 * @name GET /api/patterns/:id/download
 * @function
 * @description Downloads pattern data as a JSON file. Requires ownership or prior
 * purchase of the pattern. Increments download count asynchronously.
 *
 * @param {Object} context - SvelteKit request context
 * @param {Object} context.params - Route parameters
 * @param {string} context.params.id - Pattern UUID
 * @param {App.Locals} context.locals - Request-scoped locals with session data
 *
 * @returns {Response} JSON file download response
 * @returns {string} response.name - Pattern name
 * @returns {Object} response.parameters - Pattern render parameters
 * @returns {string} response.exported_at - ISO 8601 export timestamp
 * @returns {string} response.source - Application name ("Guilloche Studio Pro")
 * @returns {string} response.version - Export format version
 *
 * @responseHeader {string} Content-Type - "application/json"
 * @responseHeader {string} Content-Disposition - "attachment; filename=\"{name}.json\""
 * @responseHeader {string} Cache-Control - "no-store, no-cache, must-revalidate"
 *
 * @throws {400} INVALID_ID - Pattern ID is not a valid UUID
 * @throws {401} UNAUTHORIZED - Authentication required for private pattern
 * @throws {403} FORBIDDEN - User does not own and has not purchased this pattern
 * @throws {404} NOT_FOUND - Pattern does not exist
 * @throws {500} INTERNAL_ERROR - Unexpected error
 *
 * @example
 * // Downloaded file content
 * {
 *   "name": "Golden Spiral",
 *   "parameters": { "family": "spirograph", "R": 200 },
 *   "exported_at": "2024-01-15T10:30:00.000Z",
 *   "source": "Guilloche Studio Pro",
 *   "version": "1.0"
 * }
 */
export const GET: RequestHandler = async (event) => {
  const { params, locals } = event;

  // Security check - authentication required
  const security = new SecurityMiddleware(locals.supabase);
  const securityResult = await security.check(event, {
    action: 'export',
  });

  if (!securityResult.allowed) {
    return createSecurityErrorResponse(securityResult);
  }

  const userId = securityResult.context!.userId;
  const patternId = params.id;

  // Validate pattern ID format
  const idValidation = PatternIdSchema.safeParse(patternId);
  if (!idValidation.success) {
    errorResponse('INVALID_ID', 'Invalid pattern ID format', 400);
  }

  try {
    // Get pattern details
    const { data: pattern, error: patternError } = await locals.supabase
      .from('patterns')
      .select('id, name, parameters, user_id, is_public')
      .eq('id', patternId)
      .single();

    if (patternError || !pattern) {
      errorResponse('NOT_FOUND', 'Pattern not found', 404);
    }

    // Check access rights
    const isOwner = userId === pattern.user_id;
    let hasPurchased = false;

    if (!isOwner) {
      const { data: purchase } = await locals.supabase
        .from('purchases')
        .select('id')
        .eq('user_id', userId)
        .eq('pattern_id', patternId)
        .single();

      hasPurchased = !!purchase;
    }

    // Deny access if not owner and not purchased
    if (!isOwner && !hasPurchased) {
      errorResponse('FORBIDDEN', 'You do not have permission to download this pattern. Please purchase it first.', 403);
    }

    // Track export usage and increment download count (fire and forget, don't block response)
    void Promise.all([
      locals.supabase.rpc('increment_pattern_download', { pattern_uuid: patternId }),
      security.recordUsage(userId, 'exports_count', 1),
    ]).catch((err: Error) => {
      console.error('Failed to track download:', err);
    });

    // Sanitize filename
    const safeFilename = pattern.name
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .slice(0, 100);

    // Return pattern data as JSON file
    const patternData = {
      name: pattern.name,
      parameters: pattern.parameters,
      exported_at: new Date().toISOString(),
      source: 'Guilloche Studio Pro',
      version: '1.0',
    };

    return new Response(JSON.stringify(patternData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${safeFilename}.json"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Pattern download error:', err);
    errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
};
