/**
 * Export Creation Endpoint
 *
 * Creates an export job that runs in the background.
 * Returns immediately with job ID for polling.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  exportRequestSchema,
  validateRequest,
  ValidationError,
  type ExportResponse,
} from '$lib/api/schemas';

// Pro-only formats
const PRO_FORMATS = ['pdf', 'dxf', 'gcode', 'hpgl'];

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
    data = validateRequest(exportRequestSchema, body);
  } catch (e) {
    if (e instanceof ValidationError) {
      return json(e.toJSON(), { status: 400 });
    }
    throw e;
  }

  const userId = session.user.id;
  const { patternId, versionId, format, settings } = data;

  // 3. Check if user has access to pattern
  const { data: pattern } = await locals.supabase
    .from('patterns')
    .select('id, user_id, visibility, current_version_id')
    .eq('id', patternId)
    .single();

  if (!pattern) {
    throw error(404, 'Pattern not found');
  }

  // Check access: owner, public, or purchased
  const isOwner = pattern.user_id === userId;
  const isPublic = pattern.visibility === 'public' || pattern.visibility === 'listed';

  if (!isOwner && !isPublic) {
    // Check if user has purchased
    const { data: purchase } = await locals.supabase
      .from('purchases')
      .select('id')
      .eq('pattern_id', patternId)
      .eq('user_id', userId)
      .single();

    if (!purchase) {
      throw error(403, 'Not authorized to export this pattern');
    }
  }

  // 4. Check tier for pro formats
  if (PRO_FORMATS.includes(format)) {
    const { data: tier } = await locals.supabase.rpc('get_user_tier', {
      user_uuid: userId,
    });

    if (tier === 'free') {
      return json(
        {
          success: false,
          error: {
            code: 'PRO_REQUIRED',
            message: `${format.toUpperCase()} export requires Pro subscription`,
            details: { requiredTier: 'pro' },
          },
        },
        { status: 403 }
      );
    }
  }

  // 5. Check export limits
  const { data: limitCheck } = await locals.supabase.rpc('check_tier_limit', {
    p_user_id: userId,
    p_action: `exports_${format}`,
  });

  if (limitCheck && !limitCheck.allowed) {
    return json(
      {
        success: false,
        error: {
          code: 'LIMIT_EXCEEDED',
          message: `Export limit reached for ${format.toUpperCase()} (${limitCheck.current}/${limitCheck.limit})`,
          details: { tier: limitCheck.tier },
        },
      },
      { status: 403 }
    );
  }

  // 6. Determine version to export
  const targetVersionId = versionId || pattern.current_version_id;

  if (!targetVersionId) {
    throw error(400, 'No version specified and pattern has no current version');
  }

  // 7. Create export job
  const { data: exportJob, error: createError } = await locals.supabase
    .from('exports')
    .insert({
      pattern_id: patternId,
      version_id: targetVersionId,
      user_id: userId,
      format,
      settings,
      status: 'queued',
    })
    .select('id')
    .single();

  if (createError || !exportJob) {
    console.error('Failed to create export job:', createError);
    throw error(500, 'Failed to create export job');
  }

  // 8. Increment usage
  await locals.supabase.rpc('increment_usage', {
    p_user_id: userId,
    p_action: `exports_${format}`,
  });

  // 9. Trigger background processing
  // In production, this would be a Supabase Edge Function or external worker
  // For now, we process inline for simple formats
  if (format === 'svg' || format === 'png') {
    // These can be processed quickly inline
    // Mark as processing
    await locals.supabase
      .from('exports')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', exportJob.id);

    // TODO: Actual export logic would go here
    // For now, mark as done (the actual implementation would be in a service)
  }

  // 10. Return response
  const response: ExportResponse = {
    exportId: exportJob.id,
    status: 'queued',
    estimatedWaitSeconds: format === 'svg' ? 2 : format === 'png' ? 5 : 15,
  };

  return json(response, { status: 202 }); // 202 Accepted for async processing
};
