/**
 * Export Status Endpoint
 *
 * Poll this endpoint to check export job status and get download URL when ready.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ExportStatusResponse } from '$lib/api/schemas';

export const GET: RequestHandler = async ({ params, locals }) => {
  // 1. Auth check
  if (!locals.session?.user) {
    throw error(401, 'Authentication required');
  }
  const session = locals.session;

  const exportId = params.id;
  const userId = session.user.id;

  // 2. Fetch export job
  const { data: exportJob, error: fetchError } = await locals.supabase
    .from('exports')
    .select('*')
    .eq('id', exportId)
    .eq('user_id', userId) // RLS ensures this, but explicit is good
    .single();

  if (fetchError || !exportJob) {
    throw error(404, 'Export job not found');
  }

  // 3. Calculate progress (if processing)
  let progress: number | undefined;
  if (exportJob.status === 'processing' && exportJob.started_at) {
    const startTime = new Date(exportJob.started_at).getTime();
    const elapsed = Date.now() - startTime;
    // Estimate based on format (rough heuristic)
    const estimatedDuration = exportJob.format === 'svg' ? 2000 : exportJob.format === 'png' ? 5000 : 15000;
    progress = Math.min(95, Math.round((elapsed / estimatedDuration) * 100));
  } else if (exportJob.status === 'done') {
    progress = 100;
  }

  // 4. Build download URL if done
  let downloadUrl: string | undefined;
  if (exportJob.status === 'done' && exportJob.file_path) {
    // Generate signed URL from Supabase Storage
    const { data: signedUrl } = await locals.supabase.storage
      .from('exports')
      .createSignedUrl(exportJob.file_path, 3600); // 1 hour expiry

    downloadUrl = signedUrl?.signedUrl;
  }

  // 5. Return response
  const response: ExportStatusResponse = {
    exportId: exportJob.id,
    status: exportJob.status,
    progress,
    downloadUrl,
    expiresAt: exportJob.expires_at || undefined,
    errorMessage: exportJob.error_message || undefined,
  };

  return json(response);
};
