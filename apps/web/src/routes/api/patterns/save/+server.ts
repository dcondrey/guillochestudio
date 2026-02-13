/**
 * Pattern Save Endpoint
 *
 * Handles saving patterns with version control and conflict detection.
 * Implements optimistic locking via base_version_id.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  savePatternRequestSchema,
  validateRequest,
  ValidationError,
  type SavePatternResponse,
} from '$lib/api/schemas';

export const POST: RequestHandler = async ({ request, locals }) => {
  // 1. Auth check
  if (!locals.session?.user) {
    throw error(401, 'Authentication required');
  }
  const session = locals.session;

  // 2. Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  let data;
  try {
    data = validateRequest(savePatternRequestSchema, body);
  } catch (e) {
    if (e instanceof ValidationError) {
      return json(e.toJSON(), { status: 400 });
    }
    throw e;
  }

  const userId = session.user.id;
  const { patternId, name, description, baseVersionId, isAutosave, params, visibility } = data;

  // 3. Check tier limits (if creating new pattern)
  if (!patternId) {
    const { data: limitCheck } = await locals.supabase.rpc('check_tier_limit', {
      p_user_id: userId,
      p_action: 'patterns_saved',
    });

    if (limitCheck && !limitCheck.allowed) {
      return json(
        {
          success: false,
          error: {
            code: 'LIMIT_EXCEEDED',
            message: `Pattern limit reached (${limitCheck.current}/${limitCheck.limit})`,
            details: { tier: limitCheck.tier },
          },
        },
        { status: 403 }
      );
    }
  }

  // 4. Create or update pattern
  let finalPatternId = patternId;

  if (!patternId) {
    // Create new pattern
    const { data: newPattern, error: createError } = await locals.supabase
      .from('patterns')
      .insert({
        user_id: userId,
        name,
        description: description || null,
        parameters: params,
        parameter_hash: '', // Will be set by version
        visibility,
      })
      .select('id')
      .single();

    if (createError || !newPattern) {
      console.error('Failed to create pattern:', createError);
      throw error(500, 'Failed to create pattern');
    }

    finalPatternId = newPattern.id;

    // Increment usage
    await locals.supabase.rpc('increment_usage', {
      p_user_id: userId,
      p_action: 'patterns_saved',
    });
  } else {
    // Verify ownership for existing pattern
    const { data: existing } = await locals.supabase
      .from('patterns')
      .select('user_id')
      .eq('id', patternId)
      .single();

    if (!existing || existing.user_id !== userId) {
      throw error(403, 'Not authorized to edit this pattern');
    }

    // Update pattern metadata
    await locals.supabase
      .from('patterns')
      .update({
        name,
        description: description || null,
        visibility,
        updated_at: new Date().toISOString(),
      })
      .eq('id', patternId);
  }

  // 5. Create new version with conflict detection
  const { data: versionResult, error: versionError } = await locals.supabase.rpc(
    'create_pattern_version',
    {
      p_pattern_id: finalPatternId,
      p_author_id: userId,
      p_snapshot: params,
      p_base_version_id: baseVersionId || null,
      p_name: isAutosave ? `Autosave ${new Date().toISOString()}` : name,
      p_is_autosave: isAutosave,
    }
  );

  if (versionError) {
    console.error('Failed to create version:', versionError);
    throw error(500, 'Failed to save version');
  }

  const result = versionResult?.[0];

  // 6. Build response
  const response: SavePatternResponse = {
    success: true,
    patternId: finalPatternId!,
    versionId: result?.version_id,
    conflict: result?.conflict || false,
    currentVersionId: result?.current_version_id || undefined,
  };

  // Get DNA code for the version
  if (result?.version_id) {
    const { data: version } = await locals.supabase
      .from('pattern_versions')
      .select('dna_code')
      .eq('id', result.version_id)
      .single();

    if (version?.dna_code) {
      response.dnaCode = version.dna_code;
    }
  }

  // Return 409 for conflicts to signal client
  const status = result?.conflict ? 409 : 200;

  return json(response, { status });
};
